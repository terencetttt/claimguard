# ClaimGuard

**Evidence-driven insurance claim adjudication powered by GenLayer Intelligent Contracts.**

ClaimGuard combines deterministic insurance rules with GenLayer validator reasoning. Claims, policy terms, financial limits, and cryptographically verifiable evidence are committed to GenLayer Bradbury, where validators can inspect actual evidence before consensus determines the outcome.

## Live Deployment

- **App:** https://claimguard-nu.vercel.app
- **GitHub:** https://github.com/terencetttt/claimguard
- **Network:** GenLayer Bradbury Testnet
- **Intelligent Contract:** `0xD45a74b411536b8E5C80c7213482BFeECE3300ee`
- **Explorer:** https://explorer-bradbury.genlayer.com

## Why ClaimGuard Uses GenLayer

Ordinary smart contracts are effective at deterministic checks such as policy dates, deductibles, coverage limits, wallet authorization, hashes, and maximum payable amounts.

Insurance adjudication also requires reasoning about external evidence:

- Does a photograph actually support the reported incident?
- Does a repair document substantiate the claimed loss?
- Is the available evidence sufficient for approval?
- Is more evidence required?

ClaimGuard uses a GenLayer Intelligent Contract because these questions require evidence inspection and validator reasoning rather than deterministic arithmetic alone.

## Separate Claimant and Insurer Roles

Each claim binds a claimant wallet and a separate insurer wallet.

The claimant submits the claim and can publish evidence. Only the insurer wallet assigned to that claim can request adjudication. The frontend enforces this separation, and the Intelligent Contract independently verifies insurer authorization.

This prevents one wallet from controlling both sides of the claim workflow.

## Validator-Verifiable Evidence

Validators do not make decisions from claimant-written descriptions alone.

```text
Claimant wallet
    |
    v
Signed authorization
    |
    v
Evidence upload API
    |
    v
Public HTTPS evidence storage
    |
    v
SHA-256 evidence hash
    |
    v
Evidence manifest
    |
    v
SHA-256 manifest hash
    |
    v
GenLayer update_evidence()
    |
    v
Validator retrieval and inspection
```

Example manifest:

```json
{
  "evidence": [
    {
      "evidence_type": "Damage photograph",
      "source": "Claimant upload",
      "filename": "damage-photo.png",
      "uri": "https://...",
      "content_hash": "<sha256>",
      "description": "Context supplied by the claimant."
    }
  ]
}
```

Descriptions provide context only. Validators retrieve the actual evidence through the HTTPS URI and verify the cryptographic hash before relying on it.

## Claim Workflow

### 1. Submit Claim

The claimant submits the claimant wallet, insurer wallet, policy details, incident information, insured asset, requested amount, documented loss, deductible, and coverage limit.

The claim is written to the deployed ClaimGuard Intelligent Contract on Bradbury.

### 2. Publish Evidence

The claimant signs an authorization message. ClaimGuard publishes evidence to validator-accessible HTTPS storage, creates a SHA-256 manifest, and commits the evidence reference to the Intelligent Contract.

### 3. Insurer Requests Adjudication

Only the assigned insurer wallet can call:

```text
adjudicate_claim(claim_id)
```

### 4. GenLayer Validators Inspect Evidence

Validators evaluate policy information, financial constraints, and the actual external evidence.

Possible decisions:

```text
APPROVE
PARTIAL_APPROVAL
MORE_EVIDENCE_REQUIRED
REJECT
```

### 5. Final Result Is Stored On-Chain

ClaimGuard reads the resulting state directly from Bradbury and displays workflow status, final decision, evidence revision, approved amount, maximum payable, validator reasoning, validator confidence, and finalized state.

## Deterministic Settlement Protection

Validator reasoning does not have unrestricted control over payout.

ClaimGuard also calculates deterministic financial limits using requested amount, documented loss, deductible, and coverage limit.

This combines **deterministic insurance constraints + GenLayer validator reasoning**.

## Proven Bradbury End-to-End Test

ClaimGuard was tested against the deployed Intelligent Contract using live claim `CG-77312`.

```text
Claim submitted
    |
    v
Evidence uploaded to public HTTPS storage
    |
    v
Evidence manifest generated and hashed
    |
    v
Evidence Revision 1 committed to Bradbury
    |
    v
Assigned insurer requested adjudication
    |
    v
GenLayer validators inspected the evidence
    |
    v
Consensus result committed
    |
    v
REJECT
```

Final production state:

- **Workflow:** `Rejected`
- **Final decision:** `REJECT`
- **Evidence Revision:** `1`
- **Finalized:** `Yes`
- **Validator confidence:** `100%`

The test evidence was explicitly labeled as a synthetic ClaimGuard fixture rather than genuine insurance documentation. Validators did not blindly trust it as proof of real monetary loss and ultimately rejected the claim.

## GenLayer Consensus Behaviour

GenLayer adjudication is asynchronous.

During testing, one adjudication round finalized as `Undetermined` without changing the ClaimGuard claim state. ClaimGuard therefore distinguishes between a submitted adjudication transaction and an actual committed claim decision.

A later adjudication completed successfully and committed the final decision.

## Intelligent Contract

Main contract:

```text
contracts/claim_guard.py
```

Write methods:

```python
submit_claim(...)
update_evidence(...)
adjudicate_claim(...)
```

Views:

```python
get_claim(...)
get_claim_summary(...)
get_evidence_reference(...)
get_maximum_payable(...)
list_claim_ids(...)
is_authorized_insurer(...)
```

## Architecture

```text
ClaimGuard Next.js UI
        |
        | wallet actions
        | claim submission
        | signed evidence authorization
        | insurer adjudication
        v
GenLayer Bradbury
ClaimGuard Intelligent Contract
        |
        | deterministic checks
        | wallet authorization
        | evidence references
        | settlement limits
        v
GenLayer Validators
        |
        | retrieve HTTPS evidence
        | verify hashes
        | inspect evidence
        | reason about the claim
        | reach consensus
        v
Final On-Chain Claim Decision
```

## Technology

- Next.js
- React
- TypeScript
- Tailwind CSS
- GenLayer Bradbury Testnet
- GenLayer Intelligent Contracts
- `genlayer-js`
- viem signature recovery
- SHA-256 hashing
- Vercel Blob

## Security Properties

ClaimGuard:

- separates claimant and insurer wallets;
- verifies insurer authorization;
- requires signed evidence publication;
- stores cryptographic evidence references;
- exposes evidence through validator-accessible HTTPS URLs;
- never asks users for private keys or seed phrases;
- prevents further evidence or adjudication once a claim is finalized.

## Local Development

```bash
npm install
npm run dev
```

For the Vercel-backed evidence API:

```bash
npx vercel dev
```

Type check:

```bash
npx tsc --noEmit
```

Production build:

```bash
npm run build
```

Intelligent Contract tests:

```bash
py -3.12 -m pytest .\tests\direct\test_claim_guard.py -q
```

## Judge Demo

1. Open https://claimguard-nu.vercel.app
2. Connect a wallet on GenLayer Bradbury.
3. Open a live Bradbury-backed claim.
4. Inspect the separate claimant and insurer wallets.
5. Inspect the evidence revision and SHA-256 manifest commitment.
6. Open the validator-accessible evidence manifest.
7. Inspect the final validator reasoning and on-chain claim outcome.
8. Confirm finalized claims disable further evidence and adjudication.

## Testnet Disclaimer

ClaimGuard is a prototype deployed on the **GenLayer Bradbury Testnet**.

It is not an insurance company, insurer, broker, claims adjuster, or production financial service.

Development evidence may include clearly labeled synthetic fixtures. Synthetic test evidence must never be represented as genuine insurance or commercial documentation.
