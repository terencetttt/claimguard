# ClaimGuard intelligent contract

`claim_guard.py` owns the consensus-sensitive adjudication state transition. It
does not replace the existing Next.js interface and is not deployed by this
change.

Money is stored as nonnegative integers in the integrating application's
smallest currency unit. For NGN, callers should submit kobo. Floating-point
money is never accepted.

## Trust and evidence model

- The transaction sender authenticates the claimant wallet at submission.
- The deployer authorizes insurer wallets; each claim is assigned one authorized
  insurer that must differ from its claimant.
- Raw evidence is external. State stores only an immutable/public manifest URI
  and its SHA-256 digest. Validators fetch the manifest, verify the digest, then
  fetch and SHA-256 verify every referenced evidence object independently. IPFS
  content must be supplied through a stable HTTPS gateway URI that validators
  can fetch.
- ClaimGuard's current browser IndexedDB/Blob evidence is **not** accessible to
  validators. A later integration must publish an authenticated manifest and
  evidence objects to validator-accessible HTTPS before submitting their
  references on-chain.
- GenLayer consensus evaluates relevance, consistency, contradictions,
  sufficiency, and evidence-supported loss. Evidence content is untrusted and
  cannot direct the evaluator.
- Deterministic contract code checks the inclusive policy period and computes
  `max(min(documented_loss, coverage_limit) - deductible, 0)`. Consensus cannot
  increase a payout beyond that bound.
- No private keys, credentials, access tokens, or other secrets belong in
  contract state or evidence manifests.

`MORE_EVIDENCE_REQUIRED` is deliberately non-final. The claimant must replace
both manifest URI and hash, after which the assigned insurer may adjudicate
again. Approved, partially approved, and rejected outcomes are immutable.

## Evidence manifest and supported formats

The manifest is UTF-8 JSON with exactly one `evidence` array. Every item must
contain non-empty `evidence_type`, `source`, `filename`, `uri`, `content_hash`,
and `description` strings. Item URIs must use validator-accessible HTTPS and
`content_hash` must be the lowercase-compatible SHA-256 digest of the exact
downloaded bytes.

The pinned GenLayer runtime supports true multimodal evaluation through
`gl.nondet.exec_prompt(..., images=[raw_bytes])`. ClaimGuard passes verified
PNG, JPEG, and WebP bytes through that API. GenLayer currently documents a
maximum of two images per prompt, so manifests exceeding that limit fail rather
than silently omitting evidence. Validators must use vision-capable models.

UTF-8 TXT, Markdown, JSON, and CSV evidence is decoded only after its hash is
verified and its actual contents are embedded in the evaluation prompt. Empty
manifests, inaccessible objects, hash mismatches, malformed items, and binary
formats that cannot be substantively inspected by this contract (including raw
PDF files) fail safely before an LLM decision. Claimant-authored descriptions
are retained only as context and cannot substitute for verified content.

For an unsupported image/document format, the safe attestation path is to
publish both the original object and a validator-inspectable HTTPS rendition
(for example PNG pages), hash each rendition as its own manifest item, and name
the independent source. A claimant-authored textual description or attestation
alone is not accepted as proof. Higher-assurance integrations should add a
separately signed insurer, police, repairer, or oracle attestation as another
independently retrievable and hashed evidence item; the claimant must not sign
both sides.
