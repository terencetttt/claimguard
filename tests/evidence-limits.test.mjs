import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { EVIDENCE_ACCEPT, SUPPORTED_EXTENSIONS, validateEvidenceFile, validateEvidenceFiles, preflightEvidenceAddition, validateLocalEvidenceAddition } from "../lib/evidence-limits.ts";
const file = (name, size = 1) => ({ name, size });
const hash = async bytes => createHash("sha256").update(bytes).digest("hex");
const emptyClaim = { evidence_revision: 0, evidence_manifest_uri: "", evidence_manifest_hash: "" };
for (const extension of SUPPORTED_EXTENSIONS) test(`accepts supported extension ${extension}`, () => {
  assert.doesNotThrow(() => validateEvidenceFile(file("evidence" + extension)));
  assert.doesNotThrow(() => validateEvidenceFile(file("EVIDENCE" + extension.toUpperCase())));
});
for (const name of ["malware.exe", "report.pdf", "no-extension", "image.png.exe"]) test(`rejects ${name}`, () => assert.throws(() => validateEvidenceFile(file(name)), /Unsupported/));
test("rejects empty files", () => assert.throws(() => validateEvidenceFile(file("a.txt", 0)), /empty/));
test("rejects unknown sizes", () => assert.throws(() => validateEvidenceFile(file("a.txt", NaN)), /known/));
test("rejects more than 5,000,000 bytes", () => assert.throws(() => validateEvidenceFile(file("a.png", 5_000_001)), /5,000,000/));
test("accepts exactly 5,000,000 bytes", () => assert.doesNotThrow(() => validateEvidenceFiles([file("a.png", 5_000_000)])));
test("rejects an 11th item", () => assert.throws(() => validateEvidenceFiles(Array.from({ length: 11 }, () => file("a.txt"))), /10 evidence/));
test("accepts exactly 10 items", () => assert.doesNotThrow(() => validateEvidenceFiles(Array.from({ length: 10 }, () => file("a.txt")))));
test("rejects a third image regardless of MIME or category", () => assert.throws(() => validateEvidenceFiles([file("a.png"), file("b.JPG"), file("c.webp")]), /2 image/));
test("accepts exactly 2 images", () => assert.doesNotThrow(() => validateEvidenceFiles([file("a.png"), file("b.jpg")])));
test("rejects cumulative text over 200,000 bytes", () => assert.throws(() => validateEvidenceFiles([file("a.txt", 100_000), file("b.csv", 100_001)]), /200,000/));
test("accepts exactly 200,000 text bytes with images excluded", () => assert.doesNotThrow(() => validateEvidenceFiles([file("a.txt", 100_000), file("b.md", 100_000), file("c.png", 5_000_000)])));
test("file picker extensions are exact", () => assert.equal(EVIDENCE_ACCEPT, ".png,.jpg,.jpeg,.webp,.txt,.md,.json,.csv"));
async function fixture(data = new TextEncoder().encode("verified text")) {
  const item = { evidence_type: "Report", source: "Claimant", filename: "old.txt", uri: "https://evidence.example/old.txt", content_hash: await hash(data), description: "Description length is not a byte count" };
  const manifest = new TextEncoder().encode(JSON.stringify({ evidence: [item] }));
  const claim = { evidence_revision: 1, evidence_manifest_uri: "https://evidence.example/manifest.json", evidence_manifest_hash: await hash(manifest) };
  const fetcher = async uri => new Response(uri === claim.evidence_manifest_uri ? manifest : data);
  return { item, manifest, claim, fetcher };
}
test("first evidence does not fetch previous files", async () => {
  assert.deepEqual(await preflightEvidenceAddition(emptyClaim, file("new.png"), hash, () => { throw Error("must not fetch"); }), []);
});
test("first evidence still enforces total text limit", async () => assert.rejects(preflightEvidenceAddition(emptyClaim, file("a.txt", 200_001), hash), /200,000/));
test("valid previous evidence is preserved unchanged", async () => {
  const { item, claim, fetcher } = await fixture();
  assert.deepEqual(await preflightEvidenceAddition(claim, file("new.jpg"), hash, fetcher), [item]);
});
test("cumulative previous text uses exact verified UTF-8 bytes", async () => {
  const { claim, fetcher } = await fixture(new TextEncoder().encode("\u00e9".repeat(50_000)));
  await assert.rejects(preflightEvidenceAddition(claim, file("new.txt", 100_001), hash, fetcher), /200,000/);
  assert.equal((await preflightEvidenceAddition(claim, file("new.txt", 100_000), hash, fetcher)).length, 1);
});
test("manifest hash mismatch fails closed", async () => {
  const { claim, fetcher } = await fixture();
  await assert.rejects(preflightEvidenceAddition({ ...claim, evidence_manifest_hash: "0".repeat(64) }, file("new.png"), hash, fetcher), /manifest SHA-256/);
});
test("previous file hash mismatch fails closed", async () => {
  const { claim, manifest } = await fixture();
  await assert.rejects(preflightEvidenceAddition(claim, file("new.png"), hash, async uri => new Response(uri === claim.evidence_manifest_uri ? manifest : "tampered")), /evidence SHA-256/);
});
test("missing manifest reference fails closed", async () => assert.rejects(preflightEvidenceAddition({ ...emptyClaim, evidence_revision: 1 }, file("new.png"), hash), /missing manifest/));
test("unreadable previous evidence fails closed", async () => {
  const { claim } = await fixture();
  await assert.rejects(preflightEvidenceAddition(claim, file("new.png"), hash, async () => new Response("", { status: 503 })), /could not be loaded/);
});
test("non-HTTPS previous manifest fails closed", async () => {
  const { claim } = await fixture();
  await assert.rejects(preflightEvidenceAddition({ ...claim, evidence_manifest_uri: "http://example.test/manifest" }, file("new.png"), hash), /HTTPS/);
});
test("oversized previous response is bounded regardless of content-length", async () => {
  const { claim } = await fixture();
  await assert.rejects(preflightEvidenceAddition(claim, file("new.png"), hash, async () => new Response(new Uint8Array(5_000_001), { headers: { "content-length": "1" } })), /5,000,000/);
});
test("local cumulative size comes from actual blob, not record metadata", async () => {
  const previous = [{ filename: "old.txt", size: 1 }];
  await assert.rejects(validateLocalEvidenceAddition(previous, file("new.txt", 100_001), async () => new Blob([new Uint8Array(100_000)])), /200,000/);
  await validateLocalEvidenceAddition(previous, file("new.txt", 100_000), async () => new Blob([new Uint8Array(100_000)]));
});
test("unavailable local evidence fails closed", async () => assert.rejects(validateLocalEvidenceAddition([{ filename: "old.txt" }], file("new.png"), async () => null), /unavailable/));
test("local 11th record and third image are rejected", async () => {
  await assert.rejects(validateLocalEvidenceAddition(Array.from({ length: 10 }, () => ({ filename: "old.txt" })), file("new.png"), async () => new Blob(["a"])), /10 evidence/);
  await assert.rejects(validateLocalEvidenceAddition([{ filename: "a.png" }, { filename: "b.jpg" }], file("new.webp"), async () => new Blob(["a"])), /2 image/);
});
test("uploader preflight precedes signatures and upload; intake submission remains manifest-free", () => {
  const uploader = readFileSync(new URL("../components/onchain-evidence-uploader.tsx", import.meta.url), "utf8");
  assert.ok(uploader.indexOf("await preflightEvidenceAddition") < uploader.indexOf("await signMessage("));
  assert.ok(uploader.indexOf("await preflightEvidenceAddition") < uploader.indexOf('"/api/evidence/upload"'));
  assert.match(uploader, /accept=\{EVIDENCE_ACCEPT\}/);
  const intake = readFileSync(new URL("../components/claim-intake.tsx", import.meta.url), "utf8");
  assert.match(intake, /accept=\{EVIDENCE_ACCEPT\}/);
  assert.match(intake, /evidenceManifestUri:""/);
  assert.match(intake, /evidenceManifestHash:""/);
});
