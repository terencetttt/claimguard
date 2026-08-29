export type EvidenceAuthorizationAction =
  | "upload-evidence"
  | "create-manifest";

export type EvidenceAuthorizationInput = {
  action: EvidenceAuthorizationAction;
  claimId: string;
  claimant: `0x${string}`;
  sha256: string;
  timestamp: number;
};

export const EVIDENCE_AUTH_MAX_AGE_MS = 5 * 60 * 1000;

export function buildEvidenceAuthorizationMessage(
  input: EvidenceAuthorizationInput,
) {
  return [
    "ClaimGuard Evidence Authorization",
    "Version: 1",
    `Action: ${input.action}`,
    `Claim ID: ${input.claimId}`,
    `Claimant: ${input.claimant.toLowerCase()}`,
    `SHA-256: ${input.sha256.toLowerCase()}`,
    `Timestamp: ${input.timestamp}`,
  ].join("\n");
}
