"use client";

import { useState } from "react";
import {
  FileUp,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { useWallet } from "@/components/wallet-provider";
import {
  updateEvidenceOnBradbury,
  type OnchainClaim,
} from "@/lib/claim-guard-chain";
import {
  buildEvidenceAuthorizationMessage,
} from "@/lib/evidence-auth";
import {
  serializeEvidenceManifest,
  type EvidenceManifestItem,
} from "@/lib/evidence-manifest";

type Props = {
  claim: OnchainClaim;
  onUpdated: () => void;
};

type UploadResponse = {
  error?: string;
  filename?: string;
  sha256?: string;
  url?: string;
};

type ManifestResponse = {
  error?: string;
  manifestUrl?: string;
  manifestSha256?: string;
};

async function sha256Hex(
  input: ArrayBuffer | Uint8Array,
) {
  let buffer: ArrayBuffer;

  if (input instanceof ArrayBuffer) {
    buffer = input;
  } else {
    const copy = new Uint8Array(input.byteLength);
    copy.set(input);
    buffer = copy.buffer;
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    buffer,
  );

  return Array.from(
    new Uint8Array(digest),
  )
    .map((byte) =>
      byte.toString(16).padStart(2, "0"),
    )
    .join("");
}

function isEvidenceManifestItem(
  value: unknown,
): value is EvidenceManifestItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;

  return (
    typeof item.evidence_type === "string" &&
    typeof item.source === "string" &&
    typeof item.filename === "string" &&
    typeof item.uri === "string" &&
    typeof item.content_hash === "string" &&
    typeof item.description === "string"
  );
}

async function loadPreviousEvidence(
  claim: OnchainClaim,
) {
  if (
    claim.evidence_revision <= 0 ||
    !claim.evidence_manifest_uri
  ) {
    return [] as EvidenceManifestItem[];
  }

  const response = await fetch(
    claim.evidence_manifest_uri,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Existing evidence manifest could not be loaded. ClaimGuard will not replace it with an incomplete revision.",
    );
  }

  const body = (await response.json()) as {
    evidence?: unknown;
  };

  if (
    !Array.isArray(body.evidence) ||
    !body.evidence.every(isEvidenceManifestItem)
  ) {
    throw new Error(
      "Existing evidence manifest has an invalid structure.",
    );
  }

  return body.evidence;
}

async function responseJson<T>(
  response: Response,
): Promise<T> {
  const body = (await response.json()) as T & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      body.error ||
        `Request failed with status ${response.status}.`,
    );
  }

  return body;
}

export function OnchainEvidenceUploader({
  claim,
  onUpdated,
}: Props) {
  const {
    address,
    client,
    isOnBradbury,
    signMessage,
  } = useWallet();

  const [file, setFile] = useState<File | null>(
    null,
  );

  const [evidenceType, setEvidenceType] =
    useState("Damage photograph");

  const [source, setSource] =
    useState("Claimant upload");

  const [description, setDescription] =
    useState("");

  const [state, setState] = useState<
    | "idle"
    | "hashing"
    | "signing-file"
    | "uploading"
    | "building-manifest"
    | "signing-manifest"
    | "publishing-manifest"
    | "updating-chain"
  >("idle");

  const [error, setError] =
    useState<string>("");

  const [success, setSuccess] =
    useState<string>("");

  const busy = state !== "idle";

  const claimantConnected =
    !!address &&
    address.toLowerCase() ===
      claim.claimant_wallet.toLowerCase();

  async function submitEvidence() {
    if (!file) {
      setError("Choose an evidence file first.");
      return;
    }

    if (!description.trim()) {
      setError(
        "Describe what this evidence proves.",
      );
      return;
    }

    if (!address || !client) {
      setError(
        "Connect the claimant wallet first.",
      );
      return;
    }

    if (!isOnBradbury) {
      setError(
        "Switch to GenLayer Bradbury first.",
      );
      return;
    }

    if (!claimantConnected) {
      setError(
        "Only the claimant wallet for this claim can update its evidence.",
      );
      return;
    }

    if (claim.finalized) {
      setError(
        "This claim is finalized and cannot accept new evidence.",
      );
      return;
    }

    setError("");
    setSuccess("");

    try {
      /*
       * STEP 1
       * Hash exact file bytes in the browser.
       */
      setState("hashing");

      const fileBytes =
        await file.arrayBuffer();

      const fileSha256 =
        await sha256Hex(fileBytes);

      /*
       * STEP 2
       * Claimant signs authorization bound
       * to this exact file digest.
       */
      setState("signing-file");

      const uploadTimestamp = Date.now();

      const uploadMessage =
        buildEvidenceAuthorizationMessage({
          action: "upload-evidence",
          claimId: claim.claim_id,
          claimant: address,
          sha256: fileSha256,
          timestamp: uploadTimestamp,
        });

      const uploadSignature =
        await signMessage(uploadMessage);

      /*
       * STEP 3
       * Secure server route independently
       * recomputes hash + verifies claimant.
       */
      setState("uploading");

      const uploadForm = new FormData();

      uploadForm.set("file", file);
      uploadForm.set(
        "claimId",
        claim.claim_id,
      );
      uploadForm.set(
        "claimant",
        address,
      );
      uploadForm.set(
        "timestamp",
        String(uploadTimestamp),
      );
      uploadForm.set(
        "signature",
        uploadSignature,
      );

      const uploadResponse =
        await responseJson<UploadResponse>(
          await fetch(
            "/api/evidence/upload",
            {
              method: "POST",
              body: uploadForm,
            },
          ),
        );

      if (
        !uploadResponse.url ||
        !uploadResponse.sha256
      ) {
        throw new Error(
          "Evidence upload returned an incomplete response.",
        );
      }

      if (
        uploadResponse.sha256.toLowerCase() !==
        fileSha256.toLowerCase()
      ) {
        throw new Error(
          "Uploaded evidence SHA-256 does not match the browser digest.",
        );
      }

      /*
       * STEP 4
       * Preserve prior manifest records and
       * append the newly uploaded evidence.
       */
      setState("building-manifest");

      const previousEvidence =
        await loadPreviousEvidence(claim);

      const evidence: EvidenceManifestItem[] = [
        ...previousEvidence,
        {
          evidence_type:
            evidenceType.trim(),
          source: source.trim(),
          filename:
            uploadResponse.filename ||
            file.name,
          uri: uploadResponse.url,
          content_hash:
            uploadResponse.sha256.toLowerCase(),
          description:
            description.trim(),
        },
      ];

      const manifestText =
        serializeEvidenceManifest(evidence);

      const manifestBytes =
        new TextEncoder().encode(
          manifestText,
        );

      const manifestSha256 =
        await sha256Hex(manifestBytes);

      /*
       * STEP 5
       * Claimant signs authorization bound
       * to exact deterministic manifest bytes.
       */
      setState("signing-manifest");

      const manifestTimestamp =
        Date.now();

      const manifestMessage =
        buildEvidenceAuthorizationMessage({
          action: "create-manifest",
          claimId: claim.claim_id,
          claimant: address,
          sha256: manifestSha256,
          timestamp: manifestTimestamp,
        });

      const manifestSignature =
        await signMessage(
          manifestMessage,
        );

      /*
       * STEP 6
       * Server verifies every evidence URL,
       * every file hash and claimant ownership,
       * then publishes manifest.json.
       */
      setState("publishing-manifest");

      const manifestResponse =
        await responseJson<ManifestResponse>(
          await fetch(
            "/api/evidence/manifest",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                claimId:
                  claim.claim_id,
                claimant: address,
                timestamp:
                  manifestTimestamp,
                signature:
                  manifestSignature,
                expectedManifestSha256:
                  manifestSha256,
                evidence,
              }),
            },
          ),
        );

      if (
        !manifestResponse.manifestUrl ||
        !manifestResponse.manifestSha256
      ) {
        throw new Error(
          "Manifest publication returned an incomplete response.",
        );
      }

      if (
        manifestResponse.manifestSha256.toLowerCase() !==
        manifestSha256.toLowerCase()
      ) {
        throw new Error(
          "Published manifest SHA-256 does not match the claimant-signed digest.",
        );
      }

      /*
       * STEP 7
       * Wallet submits update_evidence()
       * to ClaimGuard on Bradbury.
       */
      setState("updating-chain");

      await updateEvidenceOnBradbury(
        client,
        claim.claim_id,
        manifestResponse.manifestUrl,
        manifestResponse.manifestSha256,
      );

      setSuccess(
        "Evidence committed successfully. Bradbury confirmed the new evidence revision.",
      );

      setFile(null);
      setDescription("");

      onUpdated();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Evidence update failed.",
      );
    } finally {
      setState("idle");
    }
  }

  function stateLabel() {
    switch (state) {
      case "hashing":
        return "Hashing evidence...";
      case "signing-file":
        return "Approve file authorization...";
      case "uploading":
        return "Publishing evidence...";
      case "building-manifest":
        return "Building manifest...";
      case "signing-manifest":
        return "Approve manifest authorization...";
      case "publishing-manifest":
        return "Publishing manifest...";
      case "updating-chain":
        return "Updating Bradbury...";
      default:
        return "Add validator evidence";
    }
  }

  return (
    <section className="panel p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EDF4FF] text-[#326DCA]">
          <FileUp size={18} />
        </div>

        <div>
          <h2 className="text-sm font-semibold">
            Add validator evidence
          </h2>

          <p className="mt-1 text-xs leading-5 text-[#7B8899]">
            Publish claimant evidence to
            validator-accessible HTTPS storage
            and commit its manifest to Bradbury.
          </p>
        </div>
      </div>

      {!claimantConnected && (
        <div className="mt-5 rounded-xl border border-[#F5D9A8] bg-[#FFF9ED] p-4 text-xs leading-5 text-[#8A6116]">
          Connect the claimant wallet shown in
          the on-chain claim record to add
          evidence.
        </div>
      )}

      {claim.finalized && (
        <div className="mt-5 rounded-xl border border-[#E3E9F0] bg-[#F8FAFC] p-4 text-xs text-[#68778A]">
          This claim is finalized. Evidence
          updates are disabled.
        </div>
      )}

      <div className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-[#44546A]">
            Evidence file
          </span>

          <input
            type="file"
            disabled={
              busy ||
              claim.finalized ||
              !claimantConnected
            }
            onChange={(event) =>
              setFile(
                event.target.files?.[0] ??
                  null,
              )
            }
            className="field"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-[#44546A]">
            Evidence type
          </span>

          <input
            value={evidenceType}
            disabled={busy}
            onChange={(event) =>
              setEvidenceType(
                event.target.value,
              )
            }
            className="field"
            placeholder="Damage photograph"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-[#44546A]">
            Source
          </span>

          <input
            value={source}
            disabled={busy}
            onChange={(event) =>
              setSource(event.target.value)
            }
            className="field"
            placeholder="Claimant upload"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-semibold text-[#44546A]">
            Description
          </span>

          <textarea
            value={description}
            disabled={busy}
            onChange={(event) =>
              setDescription(
                event.target.value,
              )
            }
            className="field min-h-24 resize-y"
            placeholder="Describe what the file shows and why it is relevant to this claim."
          />
        </label>
      </div>

      <div className="mt-5 rounded-xl bg-[#F8FAFC] p-4">
        <div className="flex gap-3">
          <ShieldCheck
            size={17}
            className="mt-0.5 shrink-0 text-[#326DCA]"
          />

          <p className="text-xs leading-5 text-[#68778A]">
            You will approve two wallet
            signatures and one Bradbury
            transaction. The signatures do not
            spend gas; the final transaction
            commits the manifest on-chain.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[#F3C7C7] bg-[#FFF5F5] p-4 text-xs leading-5 text-[#B42318]">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-xl border border-[#ABEFC6] bg-[#ECFDF3] p-4 text-xs leading-5 text-[#067647]">
          {success}
        </div>
      )}

      <button
        type="button"
        disabled={
          busy ||
          !file ||
          !claimantConnected ||
          claim.finalized
        }
        onClick={() =>
          void submitEvidence()
        }
        className="btn-primary mt-5 inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Loader2
            size={15}
            className="animate-spin"
          />
        ) : (
          <FileUp size={15} />
        )}

        {stateLabel()}
      </button>
    </section>
  );
}
