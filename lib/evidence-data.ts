import { evidence as seededEvidence } from "./data";
import type { FinalizedClaim } from "./claim-types";
import { evidenceBlobId } from "./evidence-blob-storage";
import type { ClaimDecision } from "./decision-types";

export type EvidenceRepositoryItem = {
  id: string;
  blobId?: string;
  title: string;
  relatedClaim: string;
  category: string;
  source: string;
  filename: string;
  description: string;
  submittedBy: string;
  timestamp: string | null;
  size: number | null;
  mimeType: string | null;
  status: string;
  relevance: string;
  isSeeded: boolean;
};

export function normalizeEvidenceFilename(filename:string){return filename.replace(/(\.[a-z0-9]{1,8})\1$/i,"$1")}
export function claimEvidenceItems(claim: FinalizedClaim, decision?:ClaimDecision): EvidenceRepositoryItem[] {
  return claim.evidence.map((item) => ({
    id: `${claim.id}:${item.id}`,
    blobId: item.blobId ?? evidenceBlobId(item.filename, item.size, item.mimeType),
    title: item.title,
    relatedClaim: claim.id,
    category: item.type,
    source: item.source,
    filename: normalizeEvidenceFilename(item.filename),
    description: item.description,
    submittedBy: claim.walletAddress ?? "Guest submission",
    timestamp: item.createdAt,
    size: item.size,
    mimeType: item.mimeType,
    status: decision?.evidenceReviews.find(review=>review.evidenceId===item.id)?.status??item.verificationStatus,
    relevance: decision?.evidenceReviews.find(review=>review.evidenceId===item.id)?.relevance??"Not assessed",
    isSeeded: false,
  }));
}

export function allEvidenceItems(claims: FinalizedClaim[], decisions:ClaimDecision[]=[]): EvidenceRepositoryItem[] {
  const submitted = claims.flatMap(claim=>claimEvidenceItems(claim,decisions.find(decision=>decision.claimId===claim.id)));
  const seeded = seededEvidence.map((item, index): EvidenceRepositoryItem => ({
    id: `seeded:${item.claim}:${index}`,
    title: item.title,
    relatedClaim: item.claim,
    category: item.type,
    source: item.source,
    filename: item.title,
    description: "Seeded demonstration evidence record.",
    submittedBy: item.by,
    timestamp: null,
    size: null,
    mimeType: null,
    status: item.state,
    relevance: item.relevance,
    isSeeded: true,
  }));
  return [...submitted, ...seeded];
}
