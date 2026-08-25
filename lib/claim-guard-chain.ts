import { createClient } from "genlayer-js";
import { CalldataAddress } from "genlayer-js/types";

export const CLAIM_GUARD_CONTRACT =
  "0xD45a74b411536b8E5C80c7213482BFeECE3300ee" as const;

type GenLayerClient = ReturnType<typeof createClient>;

function toCalldataAddress(value: `0x${string}`): CalldataAddress {
  const hex = value.slice(2);

  if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
    throw new Error("Invalid GenLayer address.");
  }

  const bytes = new Uint8Array(20);

  for (let index = 0; index < 20; index += 1) {
    bytes[index] = Number.parseInt(
      hex.slice(index * 2, index * 2 + 2),
      16,
    );
  }

  return new CalldataAddress(bytes);
}

export type OnchainClaimSummary = {
  approved_amount: number;
  claim_id: string;
  claimant_wallet: string;
  decision_reason: string;
  final_decision: string;
  finalized: boolean;
  insurer_wallet: string;
  maximum_payable: number;
  policy_active_on_incident_date: boolean;
  workflow_status: string;
};

export type OnchainEvidenceReference = {
  evidence_changed: boolean;
  evidence_manifest_hash: string;
  evidence_manifest_uri: string;
  evidence_revision: number;
};

export type OnchainClaim = OnchainClaimSummary & {
  coverage_limit: number;
  created: boolean;
  deductible: number;
  documented_loss: number;
  eligible_loss: number;
  evidence_changed: boolean;
  evidence_manifest_hash: string;
  evidence_manifest_uri: string;
  evidence_revision: number;
  incident_date: string;
  incident_summary: string;
  insured_asset: string;
  policy_end_date: string;
  policy_number: string;
  policy_start_date: string;
  requested_amount: number;
  validator_confidence: number;
  validator_supported_loss_amount: number;
};

function requireRecord(value: unknown, method: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`ClaimGuard ${method} returned an invalid response.`);
  }

  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function bool(value: unknown): boolean {
  return value === true;
}

function num(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export async function getOnchainClaimSummary(
  client: GenLayerClient,
  claimId: string,
): Promise<OnchainClaimSummary> {
  const result = await client.readContract({
    address: CLAIM_GUARD_CONTRACT,
    functionName: "get_claim_summary",
    args: [claimId],
  });

  const claim = requireRecord(result, "get_claim_summary");

  return {
    approved_amount: num(claim.approved_amount),
    claim_id: text(claim.claim_id),
    claimant_wallet: text(claim.claimant_wallet),
    decision_reason: text(claim.decision_reason),
    final_decision: text(claim.final_decision),
    finalized: bool(claim.finalized),
    insurer_wallet: text(claim.insurer_wallet),
    maximum_payable: num(claim.maximum_payable),
    policy_active_on_incident_date: bool(
      claim.policy_active_on_incident_date,
    ),
    workflow_status: text(claim.workflow_status),
  };
}

export async function getOnchainEvidenceReference(
  client: GenLayerClient,
  claimId: string,
): Promise<OnchainEvidenceReference> {
  const result = await client.readContract({
    address: CLAIM_GUARD_CONTRACT,
    functionName: "get_evidence_reference",
    args: [claimId],
  });

  const evidence = requireRecord(result, "get_evidence_reference");

  return {
    evidence_changed: bool(evidence.evidence_changed),
    evidence_manifest_hash: text(evidence.evidence_manifest_hash),
    evidence_manifest_uri: text(evidence.evidence_manifest_uri),
    evidence_revision: num(evidence.evidence_revision),
  };
}

export async function getOnchainClaim(
  client: GenLayerClient,
  claimId: string,
): Promise<OnchainClaim> {
  const result = await client.readContract({
    address: CLAIM_GUARD_CONTRACT,
    functionName: "get_claim",
    args: [claimId],
  });

  const claim = requireRecord(result, "get_claim");

  return {
    approved_amount: num(claim.approved_amount),
    claim_id: text(claim.claim_id),
    claimant_wallet: text(claim.claimant_wallet),
    coverage_limit: num(claim.coverage_limit),
    created: bool(claim.created),
    decision_reason: text(claim.decision_reason),
    deductible: num(claim.deductible),
    documented_loss: num(claim.documented_loss),
    eligible_loss: num(claim.eligible_loss),
    evidence_changed: bool(claim.evidence_changed),
    evidence_manifest_hash: text(claim.evidence_manifest_hash),
    evidence_manifest_uri: text(claim.evidence_manifest_uri),
    evidence_revision: num(claim.evidence_revision),
    final_decision: text(claim.final_decision),
    finalized: bool(claim.finalized),
    incident_date: text(claim.incident_date),
    incident_summary: text(claim.incident_summary),
    insured_asset: text(claim.insured_asset),
    insurer_wallet: text(claim.insurer_wallet),
    maximum_payable: num(claim.maximum_payable),
    policy_active_on_incident_date: bool(
      claim.policy_active_on_incident_date,
    ),
    policy_end_date: text(claim.policy_end_date),
    policy_number: text(claim.policy_number),
    policy_start_date: text(claim.policy_start_date),
    requested_amount: num(claim.requested_amount),
    validator_confidence: num(claim.validator_confidence),
    validator_supported_loss_amount: num(
      claim.validator_supported_loss_amount,
    ),
    workflow_status: text(claim.workflow_status),
  };
}

export type SubmitOnchainClaimInput = {
  claimId: string;
  insurerWallet: `0x${string}`;
  policyNumber: string;
  incidentDate: string;
  policyStartDate: string;
  policyEndDate: string;
  incidentSummary: string;
  insuredAsset: string;
  requestedAmount: bigint;
  documentedLoss: bigint;
  deductible: bigint;
  coverageLimit: bigint;
  evidenceManifestUri?: string;
  evidenceManifestHash?: string;
};

export async function isAuthorizedClaimGuardInsurer(
  client: GenLayerClient,
  insurerWallet: `0x${string}`,
): Promise<boolean> {
  const result = await client.readContract({
    address: CLAIM_GUARD_CONTRACT,
    functionName: "is_authorized_insurer",
    args: [toCalldataAddress(insurerWallet)],
  });

  return result === true;
}

function receiptText(
  receipt: unknown,
  key: string,
): string {
  if (!receipt || typeof receipt !== "object") return "";

  const value = (receipt as Record<string, unknown>)[key];

  return typeof value === "string" ? value : "";
}

async function waitForClaimToAppear(
  client: GenLayerClient,
  claimId: string,
  claimantWallet: string,
) {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const claim = await getOnchainClaimSummary(client, claimId);

      if (
        claim.claim_id === claimId &&
        claim.claimant_wallet.toLowerCase() ===
          claimantWallet.toLowerCase()
      ) {
        return;
      }
    } catch (caught) {
      lastError = caught;
    }

    await new Promise((resolve) =>
      window.setTimeout(resolve, 3000),
    );
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        "The transaction was submitted, but ClaimGuard could not confirm the new claim on Bradbury.",
      );
}

export async function submitClaimToBradbury(
  client: GenLayerClient,
  claimantWallet: `0x${string}`,
  input: SubmitOnchainClaimInput,
): Promise<`0x${string}`> {
  const insurerAuthorized =
    await isAuthorizedClaimGuardInsurer(
      client,
      input.insurerWallet,
    );

  if (!insurerAuthorized) {
    throw new Error(
      "The insurer wallet is not authorized by the ClaimGuard contract.",
    );
  }

  if (
    claimantWallet.toLowerCase() ===
    input.insurerWallet.toLowerCase()
  ) {
    throw new Error(
      "The claimant and insurer must use different wallets.",
    );
  }

  const transactionHash = (await client.writeContract({
    address: CLAIM_GUARD_CONTRACT,
    functionName: "submit_claim",
    args: [
      input.claimId,
      toCalldataAddress(input.insurerWallet),
      input.policyNumber,
      input.incidentDate,
      input.policyStartDate,
      input.policyEndDate,
      input.incidentSummary,
      input.insuredAsset,
      input.requestedAmount,
      input.documentedLoss,
      input.deductible,
      input.coverageLimit,
      input.evidenceManifestUri ?? "",
      input.evidenceManifestHash ?? "",
    ],
    value: BigInt(0),
  })) as unknown as `0x${string}`;

  // Bradbury receipt reads can be unreliable after submission.
  // Confirm success from the committed ClaimGuard state instead.

  await waitForClaimToAppear(
    client,
    input.claimId,
    claimantWallet,
  );

  return transactionHash;
}
