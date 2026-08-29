import "server-only";

import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import {
  getAddress,
  recoverMessageAddress,
  type Hex,
} from "viem";

import {
  CLAIM_GUARD_CONTRACT,
} from "@/lib/claim-guard-chain";

import {
  buildEvidenceAuthorizationMessage,
  EVIDENCE_AUTH_MAX_AGE_MS,
  type EvidenceAuthorizationAction,
} from "@/lib/evidence-auth";

const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

type VerifyEvidenceAuthorizationInput = {
  action: EvidenceAuthorizationAction;
  claimId: string;
  claimant: string;
  sha256: string;
  timestamp: number;
  signature: string;
};

function requireRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`${label} returned an invalid response.`);
  }

  return value as Record<string, unknown>;
}

function requireText(
  value: unknown,
  label: string,
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} is unavailable.`);
  }

  return value.trim();
}

export async function verifyEvidenceAuthorization(
  input: VerifyEvidenceAuthorizationInput,
) {
  if (!input.claimId.trim()) {
    throw new Error("Claim ID is required.");
  }

  if (!ADDRESS_PATTERN.test(input.claimant)) {
    throw new Error("Claimant wallet address is invalid.");
  }

  if (!SHA256_PATTERN.test(input.sha256)) {
    throw new Error(
      "Evidence SHA-256 must be a 64-character hex digest.",
    );
  }

  if (
    !Number.isSafeInteger(input.timestamp) ||
    input.timestamp <= 0
  ) {
    throw new Error("Authorization timestamp is invalid.");
  }

  const age = Math.abs(Date.now() - input.timestamp);

  if (age > EVIDENCE_AUTH_MAX_AGE_MS) {
    throw new Error(
      "Evidence authorization expired. Sign a new request.",
    );
  }

  if (!/^0x[a-fA-F0-9]{130}$/.test(input.signature)) {
    throw new Error("Evidence authorization signature is invalid.");
  }

  const claimant = getAddress(input.claimant);

  const message = buildEvidenceAuthorizationMessage({
    action: input.action,
    claimId: input.claimId.trim(),
    claimant,
    sha256: input.sha256.toLowerCase(),
    timestamp: input.timestamp,
  });

  let recovered: `0x${string}`;

  try {
    recovered = await recoverMessageAddress({
      message,
      signature: input.signature as Hex,
    });
  } catch {
    throw new Error(
      "Evidence authorization signature is invalid.",
    );
  }

  if (
    recovered.toLowerCase() !==
    claimant.toLowerCase()
  ) {
    throw new Error(
      "Evidence authorization was not signed by the claimant wallet.",
    );
  }

  const client = createClient({
    chain: testnetBradbury,
  });

  const result = await client.readContract({
    address: CLAIM_GUARD_CONTRACT,
    functionName: "get_claim_summary",
    args: [input.claimId.trim()],
  });

  const claim = requireRecord(
    result,
    "ClaimGuard get_claim_summary",
  );

  const onchainClaimant = requireText(
    claim.claimant_wallet,
    "On-chain claimant wallet",
  );

  if (
    onchainClaimant.toLowerCase() !==
    claimant.toLowerCase()
  ) {
    throw new Error(
      "Connected wallet is not the claimant for this Bradbury claim.",
    );
  }

  return {
    claimant,
    message,
  };
}
