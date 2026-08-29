import { put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  serializeEvidenceManifest,
  type EvidenceManifestItem,
} from "@/lib/evidence-manifest";

import {
  verifyEvidenceAuthorization,
} from "@/lib/evidence-auth-server";

export const runtime = "nodejs";

const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;
const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024;

function safeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function requiredText(
  value: unknown,
  field: string,
  maxLength = 2000,
) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > maxLength
  ) {
    throw new Error(`Invalid ${field}.`);
  }

  return value.trim();
}

function validateItem(
  value: unknown,
): EvidenceManifestItem {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid evidence record.");
  }

  const item = value as Record<string, unknown>;

  const uri = requiredText(
    item.uri,
    "evidence URI",
    2048,
  );

  const contentHash = requiredText(
    item.content_hash,
    "content hash",
    64,
  ).toLowerCase();

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(uri);
  } catch {
    throw new Error(
      "Evidence URI must be a valid URL.",
    );
  }

  if (parsedUrl.protocol !== "https:") {
    throw new Error(
      "Evidence URI must use HTTPS.",
    );
  }

  /*
   * Only allow files from our public Vercel Blob
   * storage path. This prevents the manifest API
   * from becoming a general-purpose URL fetcher.
   */
  if (
    !parsedUrl.hostname.endsWith(
      ".public.blob.vercel-storage.com",
    )
  ) {
    throw new Error(
      "Evidence URI must reference ClaimGuard public Blob storage.",
    );
  }

  if (!SHA256_PATTERN.test(contentHash)) {
    throw new Error(
      "Evidence content hash must be a SHA-256 hex digest.",
    );
  }

  return {
    evidence_type: requiredText(
      item.evidence_type,
      "evidence type",
      120,
    ),
    source: requiredText(
      item.source,
      "source",
      200,
    ),
    filename: requiredText(
      item.filename,
      "filename",
      255,
    ),
    uri,
    content_hash: contentHash,
    description: requiredText(
      item.description,
      "description",
      2000,
    ),
  };
}

async function verifyEvidenceFile(
  item: EvidenceManifestItem,
) {
  const response = await fetch(
    item.uri,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to retrieve evidence file: ${item.filename}`,
    );
  }

  const contentLength = Number(
    response.headers.get("content-length") ?? "0",
  );

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_EVIDENCE_FILE_SIZE
  ) {
    throw new Error(
      `Evidence file exceeds 10 MB: ${item.filename}`,
    );
  }

  const bytes = Buffer.from(
    await response.arrayBuffer(),
  );

  if (bytes.length > MAX_EVIDENCE_FILE_SIZE) {
    throw new Error(
      `Evidence file exceeds 10 MB: ${item.filename}`,
    );
  }

  const actualHash = createHash("sha256")
    .update(bytes)
    .digest("hex");

  if (actualHash !== item.content_hash) {
    throw new Error(
      `SHA-256 mismatch for evidence file: ${item.filename}`,
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      claimId?: unknown;
      claimant?: unknown;
      timestamp?: unknown;
      signature?: unknown;
      expectedManifestSha256?: unknown;
      evidence?: unknown;
    };

    const claimIdRaw = requiredText(
      body.claimId,
      "claim ID",
      64,
    );

    const claimant = requiredText(
      body.claimant,
      "claimant wallet",
      42,
    );

    const signature = requiredText(
      body.signature,
      "signature",
      132,
    );

    const expectedManifestSha256 =
      requiredText(
        body.expectedManifestSha256,
        "expected manifest SHA-256",
        64,
      ).toLowerCase();

    if (
      !SHA256_PATTERN.test(
        expectedManifestSha256,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Expected manifest SHA-256 must be a 64-character hex digest.",
        },
        { status: 400 },
      );
    }

    if (
      typeof body.timestamp !== "number" ||
      !Number.isSafeInteger(body.timestamp)
    ) {
      return NextResponse.json(
        {
          error:
            "Authorization timestamp is invalid.",
        },
        { status: 400 },
      );
    }

    const claimId = safeSegment(
      claimIdRaw,
    );

    if (!claimId) {
      return NextResponse.json(
        { error: "Invalid claim ID." },
        { status: 400 },
      );
    }

    if (
      !Array.isArray(body.evidence) ||
      body.evidence.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "At least one evidence record is required.",
        },
        { status: 400 },
      );
    }

    if (body.evidence.length > 20) {
      return NextResponse.json(
        {
          error:
            "A manifest is limited to 20 evidence records.",
        },
        { status: 400 },
      );
    }

    const evidence =
      body.evidence.map(validateItem);

    /*
     * Re-fetch every public evidence object and
     * verify the exact bytes against its hash.
     */
    for (const item of evidence) {
      await verifyEvidenceFile(item);
    }

    /*
     * Shared deterministic serialization.
     * The browser will use this exact serializer
     * before asking the claimant to sign.
     */
    const manifestText =
      serializeEvidenceManifest(evidence);

    const manifestBytes =
      Buffer.from(
        manifestText,
        "utf8",
      );

    const manifestSha256 =
      createHash("sha256")
        .update(manifestBytes)
        .digest("hex");

    if (
      manifestSha256 !==
      expectedManifestSha256
    ) {
      return NextResponse.json(
        {
          error:
            "Manifest SHA-256 does not match the claimant-signed digest.",
        },
        { status: 400 },
      );
    }

    /*
     * No manifest is written until:
     * - signature is valid,
     * - authorization is recent,
     * - signature binds to this exact manifest hash,
     * - Bradbury confirms signer is the claimant.
     */
    await verifyEvidenceAuthorization({
      action: "create-manifest",
      claimId: claimIdRaw,
      claimant,
      sha256: manifestSha256,
      timestamp: body.timestamp,
      signature,
    });

    const pathname =
      `claims/${claimId}/manifests/` +
      `${Date.now()}-manifest.json`;

    const blob = await put(
      pathname,
      manifestBytes,
      {
        access: "public",
        contentType:
          "application/json; charset=utf-8",
        addRandomSuffix: false,
      },
    );

    return NextResponse.json({
      claimId: claimIdRaw,
      evidenceCount: evidence.length,
      manifestUrl: blob.url,
      manifestSha256,
      pathname: blob.pathname,
    });
  } catch (caught) {
    console.error(
      "Manifest creation failed:",
      caught,
    );

    const message =
      caught instanceof Error
        ? caught.message
        : "Manifest creation failed.";

    const unauthorized =
      /authorization|claimant|wallet|signature|expired/i.test(
        message,
      );

    return NextResponse.json(
      { error: message },
      {
        status: unauthorized ? 401 : 500,
      },
    );
  }
}
