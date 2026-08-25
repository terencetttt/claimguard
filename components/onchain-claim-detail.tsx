"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { useWallet } from "@/components/wallet-provider";
import {
  CLAIM_GUARD_CONTRACT,
  getOnchainClaim,
  type OnchainClaim,
} from "@/lib/claim-guard-chain";
import { naira } from "@/lib/data";
import { shortenAddress } from "@/lib/wallet";

function onchainNaira(value: number) {
  return naira(value / 100);
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#E8EDF3] py-3 last:border-b-0">
      <dt className="text-xs text-[#7B8899]">{label}</dt>
      <dd
        className={`max-w-[68%] text-right text-xs font-semibold text-[#344359] ${
          mono ? "break-all font-mono" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel p-6">
      <h2 className="text-sm font-semibold text-[#27364A]">{title}</h2>
      <dl className="mt-3">{children}</dl>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const rejected = status.toLowerCase() === "rejected";
  const approved = status.toLowerCase() === "approved";
  const partial = status.toLowerCase().includes("partial");

  const className = rejected
    ? "bg-[#FFF0F0] text-[#B42318] ring-[#FED7D7]"
    : approved
      ? "bg-[#ECFDF3] text-[#067647] ring-[#ABEFC6]"
      : partial
        ? "bg-[#FFF8E7] text-[#9A6700] ring-[#F7D774]"
        : "bg-[#EEF4FF] text-[#326DCA] ring-[#C7D7FE]";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1.5 text-[11px] font-semibold ring-1 ring-inset ${className}`}
    >
      {status || "Unknown"}
    </span>
  );
}

export function OnchainClaimDetail({ id }: { id: string }) {
  const {
    address,
    client,
    isOnBradbury,
    openModal,
    switchNetwork,
  } = useWallet();

  const [claim, setClaim] = useState<OnchainClaim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!client || !isOnBradbury) {
      setClaim(null);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await getOnchainClaim(client!, id);

        if (!result.created) {
          throw new Error(`Claim ${id} was not found on ClaimGuard.`);
        }

        if (!cancelled) {
          setClaim(result);
        }
      } catch (caught) {
        if (!cancelled) {
          setClaim(null);
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to read this claim from Bradbury.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [client, id, isOnBradbury, reloadKey]);

  if (!address) {
    return (
      <AppShell
        title={`Claim ${id}`}
        subtitle="Live GenLayer claim record"
      >
        <section className="panel mx-auto max-w-2xl p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-xl bg-[#EDF4FF] text-[#326DCA]">
            <Wallet size={21} />
          </div>

          <h2 className="mt-4 text-lg font-semibold">
            Connect a wallet to read Bradbury
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718094]">
            ClaimGuard will load this claim directly from the deployed
            intelligent contract.
          </p>

          <button
            type="button"
            onClick={openModal}
            className="btn-primary mt-5"
          >
            Connect Wallet
          </button>
        </section>
      </AppShell>
    );
  }

  if (!isOnBradbury) {
    return (
      <AppShell
        title={`Claim ${id}`}
        subtitle="Live GenLayer claim record"
      >
        <section className="panel mx-auto max-w-2xl p-8 text-center">
          <ShieldCheck
            size={28}
            className="mx-auto text-[#326DCA]"
          />

          <h2 className="mt-4 text-lg font-semibold">
            Bradbury network required
          </h2>

          <p className="mt-2 text-sm text-[#718094]">
            Switch your connected wallet to GenLayer Bradbury to verify this
            claim.
          </p>

          <button
            type="button"
            onClick={() => void switchNetwork()}
            className="btn-primary mt-5"
          >
            Switch to Bradbury
          </button>
        </section>
      </AppShell>
    );
  }

  if (loading) {
    return (
      <AppShell title={`Claim ${id}`} subtitle="Reading Bradbury state">
        <div className="panel p-8 text-sm text-[#718094]">
          Reading ClaimGuard on-chain state...
        </div>
      </AppShell>
    );
  }

  if (error || !claim) {
    return (
      <AppShell title={`Claim ${id}`} subtitle="Live GenLayer claim record">
        <section className="panel p-8">
          <h2 className="text-base font-semibold">
            Unable to load on-chain claim
          </h2>

          <p className="mt-2 text-sm text-[#718094]">
            {error ?? "Claim data is unavailable."}
          </p>

          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="btn-primary mt-5 inline-flex items-center gap-2"
          >
            <RefreshCw size={15} />
            Retry
          </button>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={`Claim ${claim.claim_id}`}
      subtitle="Live Bradbury intelligent-contract record"
    >
      <div className="page-reveal space-y-5">
        <header className="panel p-6">
          <div className="flex flex-wrap items-start gap-5">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#0B1628] text-white">
              <ShieldCheck size={21} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold tracking-[-.03em]">
                  Claim {claim.claim_id}
                </h2>

                <StatusPill status={claim.workflow_status} />

                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] px-3 py-1.5 text-[11px] font-semibold text-[#067647] ring-1 ring-inset ring-[#ABEFC6]">
                  <CheckCircle2 size={12} />
                  Bradbury verified
                </span>
              </div>

              <p className="mt-2 text-sm text-[#718094]">
                {claim.insured_asset}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="ml-auto inline-flex items-center gap-2 rounded-lg border border-[#D9E1EA] px-3 py-2 text-xs font-semibold text-[#44546A] transition hover:bg-[#F8FAFC]"
            >
              <RefreshCw size={14} />
              Refresh chain state
            </button>
          </div>

          <div className="mt-6 grid gap-4 border-t border-[#E5EAF0] pt-5 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">
                Final decision
              </p>
              <p className="mt-1 text-sm font-semibold">
                {claim.final_decision || "Pending"}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">
                Evidence revision
              </p>
              <p className="mt-1 text-sm font-semibold">
                Revision {claim.evidence_revision}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">
                Maximum payable
              </p>
              <p className="mt-1 text-sm font-semibold">
                {onchainNaira(claim.maximum_payable)}
              </p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">
                Finalized
              </p>
              <p className="mt-1 text-sm font-semibold">
                {claim.finalized ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </header>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <div className="space-y-5">
            <Panel title="On-chain claim record">
              <Row
                label="Workflow status"
                value={<StatusPill status={claim.workflow_status} />}
              />
              <Row
                label="Final decision"
                value={claim.final_decision || "Pending"}
              />
              <Row
                label="Claimant wallet"
                value={shortenAddress(claim.claimant_wallet)}
                mono
              />
              <Row
                label="Insurer wallet"
                value={shortenAddress(claim.insurer_wallet)}
                mono
              />
              <Row
                label="Contract"
                value={shortenAddress(CLAIM_GUARD_CONTRACT)}
                mono
              />
            </Panel>

            <Panel title="Policy and incident">
              <Row label="Policy number" value={claim.policy_number} />
              <Row label="Incident date" value={claim.incident_date} />
              <Row label="Policy start" value={claim.policy_start_date} />
              <Row label="Policy end" value={claim.policy_end_date} />
              <Row
                label="Policy active"
                value={
                  claim.policy_active_on_incident_date ? "Yes" : "No"
                }
              />
              <Row label="Insured asset" value={claim.insured_asset} />
              <Row
                label="Coverage limit"
                value={onchainNaira(claim.coverage_limit)}
              />
              <Row
                label="Deductible"
                value={onchainNaira(claim.deductible)}
              />
            </Panel>

            <Panel title="Financial adjudication">
              <Row
                label="Requested amount"
                value={onchainNaira(claim.requested_amount)}
              />
              <Row
                label="Documented loss"
                value={onchainNaira(claim.documented_loss)}
              />
              <Row
                label="Validator-supported loss"
                value={onchainNaira(
                  claim.validator_supported_loss_amount,
                )}
              />
              <Row
                label="Maximum payable"
                value={onchainNaira(claim.maximum_payable)}
              />
              <Row
                label="Approved amount"
                value={onchainNaira(claim.approved_amount)}
              />
            </Panel>
          </div>

          <div className="space-y-5">
            <section className="panel overflow-hidden">
              <div className="border-b border-[#E1E7EF] px-6 py-5">
                <div className="flex items-center gap-2">
                  <FileCheck2 size={17} className="text-[#326DCA]" />
                  <h2 className="text-sm font-semibold">
                    Verified evidence reference
                  </h2>
                </div>

                <p className="mt-1 text-xs text-[#7B8899]">
                  Evidence commitment stored by the ClaimGuard intelligent
                  contract.
                </p>
              </div>

              <dl className="px-6 py-3">
                <Row
                  label="Revision"
                  value={`Revision ${claim.evidence_revision}`}
                />
                <Row
                  label="Evidence changed"
                  value={claim.evidence_changed ? "Yes" : "No"}
                />
                <Row
                  label="Manifest SHA-256"
                  value={claim.evidence_manifest_hash}
                  mono
                />
              </dl>

              <div className="border-t border-[#E7ECF2] px-6 py-5">
                <a
                  href={claim.evidence_manifest_uri}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#326DCA] hover:underline"
                >
                  Open validator-accessible manifest
                  <ExternalLink size={13} />
                </a>
              </div>
            </section>

            <section className="panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">
                    Validator decision
                  </h2>
                  <p className="mt-1 text-xs text-[#7B8899]">
                    Consensus-derived adjudication stored on Bradbury.
                  </p>
                </div>

                <StatusPill
                  status={claim.final_decision || claim.workflow_status}
                />
              </div>

              <div className="mt-5 rounded-xl bg-[#F8FAFC] p-5">
                <p className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">
                  Decision reason
                </p>

                <p className="mt-3 text-sm leading-7 text-[#44546A]">
                  {claim.decision_reason ||
                    "No validator reasoning has been committed yet."}
                </p>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E3E9F0] p-4">
                  <p className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">
                    Validator confidence
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {claim.validator_confidence}%
                  </p>
                </div>

                <div className="rounded-xl border border-[#E3E9F0] p-4">
                  <p className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">
                    Chain
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    GenLayer Bradbury
                  </p>
                </div>
              </div>
            </section>

            <section className="panel p-6">
              <h2 className="text-sm font-semibold">Incident statement</h2>
              <p className="mt-3 text-sm leading-7 text-[#566579]">
                {claim.incident_summary}
              </p>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
