import type { FinalizedClaim } from "./claim-types";
import type { Claim } from "./data";
import type { ClaimDecision } from "./decision-types";
import { decisionStatusForClaim } from "./decision-types";
export function finalizedClaimToSummary(claim: FinalizedClaim,decision?:ClaimDecision): Claim {return {id:claim.id,claimant:claim.walletAddress??"Guest submission",coverage:claim.policy.coverageType,amount:claim.financialLoss.requestedAmount,evidence:decision?.evidenceReviews.length?`${decision.evidenceReviews.length}/${claim.evidence.length} reviewed`:`${claim.evidence.length} uploaded`,risk:"Not assessed",status:decisionStatusForClaim(decision),activity:new Date(decision?.updatedAt??claim.updatedAt).toLocaleString("en-NG")}}
