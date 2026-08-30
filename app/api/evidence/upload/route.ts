import { put } from "@vercel/blob";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import { verifyEvidenceAuthorization } from "@/lib/evidence-auth-server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5_000_000;
const SUPPORTED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".txt", ".md", ".json", ".csv"];

function safeSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function requiredFormText(
  formData: FormData,
  key: string,
) {
  const value = formData.get(key);

  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${key} is required.`);
  }

  return value.trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Evidence file is required." },
        { status: 400 },
      );
    }

    const claimId = requiredFormText(
      formData,
      "claimId",
    );

    const claimant = requiredFormText(
      formData,
      "claimant",
    );

    const timestampText = requiredFormText(
      formData,
      "timestamp",
    );

    const signature = requiredFormText(
      formData,
      "signature",
    );

    const timestamp = Number(timestampText);

    if (!Number.isSafeInteger(timestamp)) {
      return NextResponse.json(
        { error: "Authorization timestamp is invalid." },
        { status: 400 },
      );
    }

    const pathClaimId = safeSegment(claimId);
    const filename = safeSegment(file.name);

    const lowerFilename = file.name.toLowerCase();
    if (!SUPPORTED_EXTENSIONS.some((ext) => lowerFilename.endsWith(ext))) {
      return NextResponse.json({ error: "Unsupported evidence format. Use PNG, JPG, JPEG, WEBP, TXT, MD, JSON, or CSV." }, { status: 415 });
    }

    if (!pathClaimId || !filename) {
      return NextResponse.json(
        { error: "Invalid claim ID or filename." },
        { status: 400 },
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        { error: "Evidence file is empty." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Evidence files are limited to 5,000,000 bytes." },
        { status: 413 },
      );
    }

    /*
     * Compute the digest from the exact bytes that
     * will later be uploaded to Vercel Blob.
     */
    const bytes = Buffer.from(
      await file.arrayBuffer(),
    );

    const sha256 = createHash("sha256")
      .update(bytes)
      .digest("hex");

    /*
     * Nothing is written to Blob until the wallet
     * signature and Bradbury claimant ownership
     * have both been verified.
     */
    await verifyEvidenceAuthorization({
      action: "upload-evidence",
      claimId,
      claimant,
      sha256,
      timestamp,
      signature,
    });

    const pathname =
      `claims/${pathClaimId}/evidence/` +
      `${Date.now()}-${filename}`;

    const blob = await put(
      pathname,
      bytes,
      {
        access: "public",
        contentType:
          file.type ||
          "application/octet-stream",
        addRandomSuffix: false,
      },
    );

    return NextResponse.json({
      claimId,
      filename: file.name,
      mimeType:
        file.type ||
        "application/octet-stream",
      size: file.size,
      sha256,
      url: blob.url,
      pathname: blob.pathname,
    });
  } catch (caught) {
    console.error(
      "Evidence upload failed:",
      caught,
    );

    const message =
      caught instanceof Error
        ? caught.message
        : "Evidence upload failed.";

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
