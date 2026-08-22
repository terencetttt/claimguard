import type { ClaimDraft, FinalizedClaim } from "./claim-types";

const DRAFT_PREFIX = "claimguard.claim-draft.v1";
export const CLAIMS_STORAGE_KEY = "claimguard.claims.v1";
export const CLAIMS_CHANGED_EVENT = "claimguard:claims-changed";
let cachedClaimsRaw: string | null | undefined;
let cachedClaims: FinalizedClaim[] = [];

function canUseStorage() { return typeof window !== "undefined"; }
function scopeKey(walletAddress: string | null) { return walletAddress?.toLowerCase() ?? "guest"; }
function draftKey(walletAddress: string | null) { return `${DRAFT_PREFIX}:${scopeKey(walletAddress)}`; }

function parse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export const claimStorage = {
  loadDraft(walletAddress: string | null): ClaimDraft | null {
    if (!canUseStorage()) return null;
    return parse<ClaimDraft | null>(window.localStorage.getItem(draftKey(walletAddress)), null);
  },
  saveDraft(walletAddress: string | null, draft: ClaimDraft) {
    if (!canUseStorage()) return;
    window.localStorage.setItem(draftKey(walletAddress), JSON.stringify(draft));
  },
  clearDraft(walletAddress: string | null) {
    if (!canUseStorage()) return;
    window.localStorage.removeItem(draftKey(walletAddress));
  },
  listClaims(): FinalizedClaim[] {
    if (!canUseStorage()) return [];
    const raw = window.localStorage.getItem(CLAIMS_STORAGE_KEY);
    if (raw === cachedClaimsRaw) return cachedClaims;
    cachedClaimsRaw = raw;
    cachedClaims = parse<FinalizedClaim[]>(raw, []);
    return cachedClaims;
  },
  saveClaim(claim: FinalizedClaim) {
    if (!canUseStorage()) return;
    const claims = this.listClaims();
    window.localStorage.setItem(CLAIMS_STORAGE_KEY, JSON.stringify([claim, ...claims.filter((item) => item.id !== claim.id)]));
    cachedClaimsRaw = undefined;
    window.dispatchEvent(new Event(CLAIMS_CHANGED_EVENT));
  },
  generateClaimId() {
    const reserved = new Set(["CG-20481", "CG-20463", "CG-20439", "CG-20422", "CG-20405", ...this.listClaims().map((claim) => claim.id)]);
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const id = `CG-${Math.floor(10_000 + Math.random() * 90_000)}`;
      if (!reserved.has(id)) return id;
    }
    return `CG-${Date.now().toString().slice(-5)}`;
  },
  subscribe(listener: () => void) {
    if (!canUseStorage()) return () => undefined;
    const onStorage = (event: StorageEvent) => { if (event.key === CLAIMS_STORAGE_KEY) { cachedClaimsRaw = undefined; listener(); } };
    const onLocalChange = () => listener();
    window.addEventListener("storage", onStorage);
    window.addEventListener(CLAIMS_CHANGED_EVENT, onLocalChange);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(CLAIMS_CHANGED_EVENT, onLocalChange); };
  },
};
