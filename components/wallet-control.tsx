"use client";

/* EIP-6963 wallet icons are provider-supplied data URIs, not optimizable assets. */
/* eslint-disable @next/next/no-img-element */

import { AlertCircle, Check, ChevronRight, LoaderCircle, Wallet, X } from "lucide-react";
import { useEffect } from "react";
import { BRADBURY_LABEL, shortenAddress } from "@/lib/wallet";
import { useWallet } from "./wallet-provider";

export function WalletControl({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const wallet = useWallet();
  if (!wallet.address) return <button type="button" onClick={wallet.openModal} className={dark ? "inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-medium text-white hover:bg-white/5" : "btn-secondary whitespace-nowrap"}><Wallet size={14}/>Connect Wallet</button>;
  return <button type="button" onClick={wallet.isOnBradbury ? wallet.openModal : wallet.switchNetwork} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left ${dark ? "border-white/10 bg-white/[.035] text-white hover:bg-white/[.07]" : "border-[#DDE4ED] bg-white text-[#142033] hover:bg-[#F8FAFC]"}`}>
    <span className={`size-2 shrink-0 rounded-full ${wallet.isOnBradbury ? "bg-[#21C58E] shadow-[0_0_0_4px_rgba(33,197,142,.1)]" : "bg-[#D59A3A]"}`}/>
    <span><span className="block text-xs font-semibold leading-none">{shortenAddress(wallet.address)}</span>{!compact&&<span className={`mt-1 block text-[10px] ${dark ? "text-[#8FA0B7]" : "text-[#718096]"}`}>{wallet.isOnBradbury ? BRADBURY_LABEL : "Switch to Bradbury"}</span>}</span>
  </button>;
}

export function WalletModal() {
  const wallet = useWallet();
  const { isModalOpen, closeModal } = wallet;
  useEffect(() => {
    if (!isModalOpen) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") closeModal(); };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [isModalOpen, closeModal]);
  if (!isModalOpen) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#050B14]/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeModal(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="wallet-title" className="page-reveal w-full max-w-[480px] overflow-hidden rounded-[20px] border border-white/10 bg-[#0B1628] text-white shadow-[0_32px_100px_rgba(0,0,0,.55)]">
      <div className="flex items-start justify-between border-b border-white/8 px-6 py-5"><div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-[#6682A8]">GenLayer · {BRADBURY_LABEL}</p><h2 id="wallet-title" className="mt-2 text-xl font-semibold tracking-[-.035em]">Connect to ClaimGuard</h2></div><button type="button" onClick={closeModal} className="grid size-9 place-items-center rounded-lg text-[#8FA0B7] hover:bg-white/5 hover:text-white" aria-label="Close wallet dialog"><X size={18}/></button></div>
      <div className="p-6"><p className="text-sm leading-6 text-[#9DACC0]">Connect your wallet to submit claims, verify evidence, and interact with ClaimGuard on GenLayer.</p>
        <div className="mt-6 space-y-2">
          {wallet.address && !wallet.isOnBradbury ? <button type="button" onClick={wallet.switchNetwork} disabled={wallet.isConnecting} className="flex w-full items-center gap-3 rounded-xl border border-[#D59A3A]/25 bg-[#D59A3A]/10 p-4 text-left hover:bg-[#D59A3A]/15 disabled:opacity-60"><AlertCircle size={20} className="text-[#E9B45C]"/><span className="flex-1"><span className="block text-sm font-semibold">Wrong network</span><span className="mt-1 block text-xs text-[#B7A88D]">Switch your wallet to GenLayer Bradbury Testnet.</span></span>{wallet.isConnecting ? <LoaderCircle size={18} className="animate-spin"/> : <ChevronRight size={18}/>}</button> : wallet.address && wallet.isOnBradbury ? <div className="flex items-center gap-3 rounded-xl border border-[#21C58E]/20 bg-[#21C58E]/10 p-4"><span className="grid size-9 place-items-center rounded-full bg-[#21C58E]/15 text-[#65DEB5]"><Check size={18}/></span><span><span className="block text-sm font-semibold">Wallet connected</span><span className="mt-1 block text-xs text-[#83BBAA]">{shortenAddress(wallet.address)} · {BRADBURY_LABEL}</span></span></div> : wallet.providers.length ? wallet.providers.map((choice) => <button key={choice.id} type="button" onClick={() => wallet.connect(choice)} disabled={wallet.isConnecting} className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[.025] p-3.5 text-left hover:border-white/15 hover:bg-white/[.055] disabled:opacity-60">{choice.icon ? <img src={choice.icon} alt="" className="size-9 rounded-lg"/> : <span className="grid size-9 place-items-center rounded-lg bg-[#14243A]"><Wallet size={18}/></span>}<span className="flex-1 text-sm font-medium">{choice.name}</span>{wallet.isConnecting ? <LoaderCircle size={18} className="animate-spin text-[#6EA1FF]"/> : <ChevronRight size={18} className="text-[#62758E]"/>}</button>) : <div className="rounded-xl border border-[#B6525E]/25 bg-[#B6525E]/10 p-4"><div className="flex gap-3"><AlertCircle size={20} className="shrink-0 text-[#E38691]"/><div><p className="text-sm font-semibold">No compatible wallet found</p><p className="mt-1 text-xs leading-5 text-[#BA9298]">Install an EIP-1193 compatible browser wallet, then refresh ClaimGuard.</p></div></div></div>}
        </div>
        {wallet.error&&<div role="alert" className="mt-3 flex gap-2 rounded-xl border border-[#B6525E]/25 bg-[#B6525E]/10 p-3 text-xs leading-5 text-[#E7A1AA]"><AlertCircle size={16} className="mt-0.5 shrink-0"/>{wallet.error}</div>}
        <p className="mt-5 text-[11px] leading-5 text-[#61728A]">ClaimGuard never requests a signature or sends a transaction during connection.</p>
      </div>
    </section>
  </div>;
}
