import type { EvidenceManifestItem } from "./evidence-manifest";

export const MAX_EVIDENCE_FILE_SIZE = 5_000_000;
export const MAX_EVIDENCE_ITEMS = 10;
export const MAX_IMAGE_ITEMS = 2;
export const MAX_TOTAL_TEXT_BYTES = 200_000;
export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"] as const;
export const TEXT_EXTENSIONS = [".txt", ".md", ".json", ".csv"] as const;
export const SUPPORTED_EXTENSIONS = [...IMAGE_EXTENSIONS, ...TEXT_EXTENSIONS];
export const EVIDENCE_ACCEPT = SUPPORTED_EXTENSIONS.join(",");
export const EVIDENCE_LIMITS_HELP = "PNG, JPG, JPEG, WebP, TXT, MD, JSON or CSV only. Up to 10 files, including 2 images; 5,000,000 bytes per file and 200,000 text bytes total. No PDF.";

export type EvidenceFileSize = { name: string; size: number };
export function evidenceExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot).toLowerCase();
}
export function evidenceKind(name: string): "image" | "text" {
  const extension = evidenceExtension(name);
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(extension)) return "image";
  if ((TEXT_EXTENSIONS as readonly string[]).includes(extension)) return "text";
  throw new Error("Unsupported evidence extension. " + EVIDENCE_LIMITS_HELP);
}
export function validateEvidenceFile(file: EvidenceFileSize) {
  const kind = evidenceKind(file.name);
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new Error("Evidence files must not be empty and their byte size must be known.");
  if (file.size > MAX_EVIDENCE_FILE_SIZE) throw new Error("Evidence files must not exceed 5,000,000 bytes.");
  return kind;
}
export function validateEvidenceFiles(files: readonly EvidenceFileSize[]) {
  if (files.length > MAX_EVIDENCE_ITEMS) throw new Error("A claim may contain at most 10 evidence items.");
  let images = 0;
  let textBytes = 0;
  for (const file of files) {
    if (validateEvidenceFile(file) === "image") images++;
    else textBytes += file.size;
  }
  if (images > MAX_IMAGE_ITEMS) throw new Error("A claim may contain at most 2 image items.");
  if (textBytes > MAX_TOTAL_TEXT_BYTES) throw new Error("Combined text evidence must not exceed 200,000 bytes.");
}

function requireHttps(uri: string) {
  if (new URL(uri).protocol !== "https:") throw new Error("Existing evidence must use HTTPS.");
}
async function fetchBytes(uri: string, fetcher: typeof fetch) {
  requireHttps(uri);
  const response = await fetcher(uri, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Existing evidence could not be loaded. No evidence was uploaded or replaced.");
  if (response.url) requireHttps(response.url);
  if (!response.body) throw new Error("Existing evidence is empty.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_EVIDENCE_FILE_SIZE) throw new Error("Existing evidence exceeds 5,000,000 bytes.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

type ManifestReference = { evidence_revision: number; evidence_manifest_uri: string; evidence_manifest_hash: string };
type HashBytes = (bytes: Uint8Array) => Promise<string>;
/** Verify exact committed bytes before using previous records or counting text. */
export async function preflightEvidenceAddition(
  claim: ManifestReference, file: EvidenceFileSize, hash: HashBytes, fetcher: typeof fetch = fetch,
): Promise<EvidenceManifestItem[]> {
  validateEvidenceFile(file);
  if (claim.evidence_revision === 0 && !claim.evidence_manifest_uri && !claim.evidence_manifest_hash) {
    validateEvidenceFiles([file]);
    return [];
  }
  if (!claim.evidence_manifest_uri || !/^[a-fA-F0-9]{64}$/.test(claim.evidence_manifest_hash)) {
    throw new Error("Existing evidence cannot be safely validated: missing manifest reference.");
  }
  const bytes = await fetchBytes(claim.evidence_manifest_uri, fetcher);
  if (await hash(bytes) !== claim.evidence_manifest_hash.toLowerCase()) throw new Error("Existing manifest SHA-256 verification failed.");
  const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const keys = ["evidence_type", "source", "filename", "uri", "content_hash", "description"];
  if (!body || Object.keys(body).length !== 1 || !Array.isArray(body.evidence) || !body.evidence.length ||
      !body.evidence.every((item: unknown) => item && typeof item === "object" &&
        Object.keys(item).length === keys.length && keys.every(key =>
          typeof (item as Record<string, unknown>)[key] === "string" &&
          ((item as Record<string, string>)[key]).trim()))) {
    throw new Error("Existing evidence manifest has an invalid structure.");
  }
  const evidence = body.evidence as EvidenceManifestItem[];
  // Reject counts before fetching potentially unnecessary files; sizes below are never estimates.
  if (evidence.length + 1 > MAX_EVIDENCE_ITEMS) throw new Error("A claim may contain at most 10 evidence items.");
  if ([...evidence.map(item => item.filename), file.name].filter(name => evidenceKind(name) === "image").length > MAX_IMAGE_ITEMS) {
    throw new Error("A claim may contain at most 2 image items.");
  }
  const files: EvidenceFileSize[] = [];
  for (const item of evidence) {
    const data = await fetchBytes(item.uri, fetcher);
    if (!/^[a-fA-F0-9]{64}$/.test(item.content_hash) || await hash(data) !== item.content_hash.toLowerCase()) {
      throw new Error("Existing evidence SHA-256 verification failed.");
    }
    if (evidenceKind(item.filename) === "text") new TextDecoder("utf-8", { fatal: true }).decode(data);
    files.push({ name: item.filename, size: data.byteLength });
  }
  validateEvidenceFiles([...files, file]);
  return evidence;
}

/** Local drafts use actual files/blobs, never descriptions or saved size claims. */
export async function validateLocalEvidenceAddition<T extends { filename: string }>(
  previous: readonly T[], file: EvidenceFileSize, load: (record: T) => Promise<Blob | null>,
) {
  validateEvidenceFile(file);
  if (previous.length + 1 > MAX_EVIDENCE_ITEMS) throw new Error("A claim may contain at most 10 evidence items.");
  const sizes: EvidenceFileSize[] = [];
  for (const record of previous) {
    const blob = await load(record);
    if (!blob) throw new Error("A previous local evidence file is unavailable. Remove and reselect that record before adding evidence.");
    sizes.push({ name: record.filename, size: blob.size });
  }
  validateEvidenceFiles([...sizes, file]);
}
