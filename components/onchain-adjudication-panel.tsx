"use client";

import { useState } from "react";
import {
  ExternalLink,
  Gavel,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { useWallet } from "@/components/wallet-provider";
import {
  adjudicateClaimOnBradbury,
  type OnchainClaim,
} from "@/lib/claim-guard-chain";

type Props = {
  claim: OnchainClaim;
  onUpdated: () => void;
};

export function OnchainAdjudicationPanel({
  claim,
  onUpdated,
}: Props) {
  const {
    address,
    client,
    isOnBradbury,
  } = useWallet();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [transactionHash, setTransactionHash] = useState("");

  const insurerConnected =
    !!address &&
    address.toLowerCase() ===
      claim.insurer_wallet.toLowerCase();

  async function adjudicate() {
    setError("");
    setSuccess("");

    if (!address || !client) {
      setError(
        "Connect the insurer wallet before adjudicating this claim.",
      );
      return;
    }

    if (!isOnBradbury) {
      setError(
        "Switch the insurer wallet to GenLayer Bradbury first.",
      );
      return;
    }

    if (!insurerConnected) {
      setError(
        "Only the insurer wallet assigned to this claim can request adjudication.",
      );
      return;
    }

    if (claim.finalized) {
      setError(
        "This claim has already been finalized.",
      );
      return;
    }

    setBusy(true);

    try {
      const hash = await adjudicateClaimOnBradbury(
        client,
        claim.claim_id,
      );

      setTransactionHash(hash);

      setSuccess(
        "Adjudication submitted to Bradbury. GenLayer consensus and finalization may take several minutes. Do not submit another adjudication while this transaction is processing.",
      );

      onUpdated();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Claim adjudication failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EDF4FF] text-[#326DCA]">
          <Gavel size={18} />
        </div>

        <div>
          <h2 className="text-sm font-semibold">
            Insurer adjudication
          </h2>

          <p className="mt-1 text-xs leading-5 text-[#7B8899]">
            Request GenLayer validators to inspect the committed
            evidence and determine the claim outcome.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-[#F8FAFC] p-4">
        <div className="flex gap-3">
          <ShieldCheck
            size={17}
            className="mt-0.5 shrink-0 text-[#326DCA]"
          />

          <div className="text-xs leading-5 text-[#68778A]">
            <p>
              Evidence revision:{" "}
              <span className="font-semibold text-[#344054]">
                {claim.evidence_revision}
              </span>
            </p>

            <p className="mt-1">
              The adjudication transaction must be signed by the
              insurer wallet assigned to this claim.
            </p>
          </div>
        </div>
      </div>

      {!insurerConnected && !claim.finalized && (
        <div className="mt-4 rounded-xl border border-[#F5D9A8] bg-[#FFF9ED] p-4 text-xs leading-5 text-[#8A6116]">
          Switch to the insurer wallet shown in the on-chain claim
          record to enable adjudication.
        </div>
      )}

      {claim.finalized && (
        <div className="mt-4 rounded-xl border border-[#E3E9F0] bg-[#F8FAFC] p-4 text-xs text-[#68778A]">
          This claim is finalized. No further adjudication can be
          requested.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-[#F3C7C7] bg-[#FFF5F5] p-4 text-xs leading-5 text-[#B42318]">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-xl border border-[#ABEFC6] bg-[#ECFDF3] p-4 text-xs leading-5 text-[#067647]">
          <p>{success}</p>

          {transactionHash && (
            <a
              href={`https://explorer-bradbury.genlayer.com/tx/${transactionHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 font-semibold hover:underline"
            >
              Open adjudication transaction
              <ExternalLink size={13} />
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={
          busy ||
          claim.finalized ||
          !!transactionHash ||
          !insurerConnected
        }
        onClick={() => void adjudicate()}
        className="btn-primary mt-5 inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? (
          <Loader2
            size={15}
            className="animate-spin"
          />
        ) : (
          <Gavel size={15} />
        )}

        {busy
          ? "Submitting adjudication..."
          : transactionHash
            ? "Adjudication submitted"
            : "Adjudicate claim"}
      </button>
    </section>
  );
}
