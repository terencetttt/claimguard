"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, FilePlus2, Files, Scale, ShieldCheck, Settings, Wifi } from "lucide-react";
import { Logo } from "./logo";
import { WalletControl } from "./wallet-control";

const nav = [{label:"Overview",href:"/dashboard",icon:LayoutDashboard},{label:"Claims",href:"/claims",icon:FileText},{label:"New Claim",href:"/claims/new",icon:FilePlus2},{label:"Evidence",href:"/evidence",icon:Files},{label:"Decisions",href:"/decisions",icon:Scale},{label:"Policies",href:"/policies",icon:ShieldCheck}];

export function Sidebar() {
  const path = usePathname();
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-white/[.035] bg-[#08111F] px-5 py-7 text-[#9EABBE] shadow-[10px_0_35px_rgba(8,17,31,.04)] lg:flex">
    <div className="px-3"><Logo dark/></div>
    <nav className="mt-10 space-y-1">{nav.map(({label,href,icon:Icon})=>{const active=href==="/dashboard"?path===href:path.startsWith(href);return <Link key={href} href={href} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${active?"bg-[#14243A] text-white":"hover:bg-white/[.04] hover:text-white"}`}><Icon size={17}/><span>{label}</span>{active&&<span className="ml-auto size-1.5 rounded-full bg-[#4D8DFF]"/>}</Link>})}</nav>
    <div className="mt-auto space-y-2"><div className="rounded-xl border border-white/8 bg-white/[.025] p-3"><div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[.12em] text-[#6F7E92]"><Wifi size={13} className="text-[#21C58E]"/>Network</div><div className="mt-2 flex items-center justify-between text-xs text-white"><span>GenLayer Bradbury</span><span className="size-2 rounded-full bg-[#21C58E] shadow-[0_0_0_4px_rgba(33,197,142,.1)]"/></div></div><WalletControl dark/><Link href="#" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/[.04] hover:text-white"><Settings size={17}/>Settings</Link></div>
  </aside>;
}
