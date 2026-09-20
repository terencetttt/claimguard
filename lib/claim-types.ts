export type DraftStatus = "Draft" | "Submitted";
export type ThirdPartyInvolvement = "Yes" | "No" | "Not sure" | "";
export type EvidenceType = "Police report" | "Damage photographs" | "Repair estimate" | "Medical document" | "Policy document" | "Invoice / receipt" | "Witness statement" | "Other";
export type EvidenceVerificationStatus = "Uploaded" | "Unverified" | "Ready for review";

export type ClaimEvidenceRecord = {
  id: string;
  blobId?: string;
  type: EvidenceType;
  filename: string;
  title: string;
  description: string;
  source: string;
  createdAt: string;
  size: number;
  mimeType: string;
  verificationStatus: EvidenceVerificationStatus;
};

export type ClaimDraft = {
  id: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  walletAddress: string | null;
  incident: {
    incidentType: string;
    incidentDate: string;
    location: string;
    vehicleRegistration: string;
    description: string;
    thirdPartyInvolved: ThirdPartyInvolvement;
  };
  policy: {
    policyNumber: string;
    insurer: string;
    insurerWallet: string;
    coverageType: string;
    policyStartDate: string;
    policyEndDate: string;
    coverageLimit: number;
    deductible: number;
    insuredAsset: string;
  };
  financialLoss: {
    repairEstimate: number;
    propertyDamage: number;
    medicalExpenses: number;
    otherExpenses: number;
    requestedAmount: number;
    currency: "NGN";
  };
  evidence: ClaimEvidenceRecord[];
  review: {
    declarationAccepted: boolean;
    submittedAt: string | null;
  };
};

export type FinalizedClaim = ClaimDraft & {
  status: "Submitted";
  review: ClaimDraft["review"] & { submittedAt: string };
};

export function finalizeClaimDraft(draft:ClaimDraft,id:string,submittedAt:string):FinalizedClaim {
  return {...draft,id,status:"Submitted",updatedAt:submittedAt,incident:{...draft.incident,incidentDate:draft.incident.incidentDate},policy:{...draft.policy,policyStartDate:draft.policy.policyStartDate,policyEndDate:draft.policy.policyEndDate},review:{...draft.review,declarationAccepted:true,submittedAt}};
}

export type ClaimStep = 0 | 1 | 2 | 3 | 4;

export function createClaimDraft(walletAddress: string | null): ClaimDraft {
  const now = new Date().toISOString();
  return {
    id: `draft-${crypto.randomUUID()}`,
    status: "Draft",
    createdAt: now,
    updatedAt: now,
    walletAddress,
    incident: {
      incidentType: "",
      incidentDate: "",
      location: "",
      vehicleRegistration: "",
      description: "",
      thirdPartyInvolved: "Not sure",
    },
    policy: {
      policyNumber: "",
      insurer: "",
      insurerWallet: "",
      coverageType: "",
      policyStartDate: "",
      policyEndDate: "",
      coverageLimit: 0,
      deductible: 0,
      insuredAsset: "",
    },
    financialLoss: {
      repairEstimate: 0,
      propertyDamage: 0,
      medicalExpenses: 0,
      otherExpenses: 0,
      requestedAmount: 0,
      currency: "NGN",
    },
    evidence: [],
    review: { declarationAccepted: false, submittedAt: null },
  };
}

export function documentedLoss(draft: ClaimDraft) {
  const loss = draft.financialLoss;
  return loss.repairEstimate + loss.propertyDamage + loss.medicalExpenses + loss.otherExpenses;
}





