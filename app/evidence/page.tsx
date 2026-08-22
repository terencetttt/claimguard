"use client";

import { useCallback, useMemo, useState } from "react";
import { Search, ChevronDown, Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { EvidenceCard } from "@/components/evidence-card";
import { EvidencePreviewModal } from "@/components/evidence-preview-modal";
import { useClaims } from "@/components/claims-provider";
import { allEvidenceItems, type EvidenceRepositoryItem } from "@/lib/evidence-data";
import { useDecisions } from "@/components/decisions-provider";

export default function Evidence() {
  const { localClaims } = useClaims();
  const { decisions } = useDecisions();
  const records = useMemo(() => allEvidenceItems(localClaims,decisions), [localClaims,decisions]);
  const [selected, setSelected] = useState<EvidenceRepositoryItem | null>(null);
  const closePreview = useCallback(() => setSelected(null), []);
  const submittedCount = records.filter((item) => !item.isSeeded).length;
  return <AppShell title="Evidence Repository" subtitle="Documents, records and verification states"><div className="page-reveal space-y-7">
    <section className="panel flex flex-wrap gap-3 p-5 2xl:p-6"><label className="relative min-w-[280px] flex-[2_1_400px]"><Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8190A3]"/><input className="field !pl-11" placeholder="Search evidence or related claim" aria-label="Search evidence"/></label>{["Evidence type","Verification status","Source","Related claim"].map((item)=><button type="button" className="btn-secondary" key={item}>{item}<ChevronDown size={14}/></button>)}<button type="button" className="btn-primary"><Upload size={15}/>Add evidence</button></section>
    <div className="flex min-h-10 items-center justify-between"><div><p className="text-base font-semibold text-[#243248]">{records.length} evidence records</p><p className="mt-1 text-xs text-[#8894A4]">Evidence library across the active claims portfolio</p></div><p className="text-xs text-[#7C899A]">{submittedCount} locally submitted · {records.length-submittedCount} seeded</p></div>
    <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{records.map((item)=><EvidenceCard key={item.id} item={item} onOpen={()=>setSelected(item)}/>)}</div>
  </div>{selected&&<EvidencePreviewModal item={selected} onClose={closePreview}/>}</AppShell>;
}
