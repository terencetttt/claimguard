"use client";

import { Bell, Menu, Search } from "lucide-react";
import { WalletControl } from "./wallet-control";

export function Topbar({ title, subtitle }: { title: string; subtitle: string }) {
  return <header className="flex min-h-[92px] items-center justify-between gap-4 border-b border-[#DDE4ED] bg-white px-5 md:px-7 xl:px-8 2xl:px-12">
    <div className="flex min-w-0 items-center gap-3"><button className="grid size-9 place-items-center rounded-lg border border-[#DDE4ED] lg:hidden" aria-label="Open navigation"><Menu size={18}/></button><div><h1 className="truncate text-lg font-semibold tracking-[-.025em] text-[#08111F]">{title}</h1><p className="hidden text-xs text-[#6B788A] sm:block">{subtitle}</p></div></div>
    <div className="flex items-center gap-1"><WalletControl compact/><button className="hidden size-9 place-items-center rounded-lg text-[#66758A] hover:bg-[#F0F3F8] sm:grid" aria-label="Search"><Search size={18}/></button><button className="relative hidden size-9 place-items-center rounded-lg text-[#66758A] hover:bg-[#F0F3F8] sm:grid" aria-label="Notifications"><Bell size={18}/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#4D8DFF]"/></button><button className="ml-2 hidden size-9 place-items-center rounded-full bg-[#0B1628] text-xs font-semibold text-white sm:grid" aria-label="Open profile">CO</button></div>
  </header>;
}
