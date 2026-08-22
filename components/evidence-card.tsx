import { FileCheck2, MoreHorizontal } from "lucide-react";
import type { EvidenceRepositoryItem } from "@/lib/evidence-data";
import { StatusBadge } from "./status-badge";

export function EvidenceCard({ item, onOpen }: { item: EvidenceRepositoryItem; onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="panel group min-h-[250px] w-full p-6 text-left transition hover:-translate-y-0.5 hover:border-[#C3D2E5] hover:shadow-[0_16px_35px_rgba(27,45,70,.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4D8DFF]">
    <div className="flex items-start gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[#EDF4FF] text-[#326DCA]"><FileCheck2 size={20}/></span><div className="min-w-0 flex-1"><h3 className="truncate text-[15px] font-semibold text-[#172437]">{item.title}</h3><p className="mt-1.5 truncate text-xs text-[#7B8899]">{item.source}</p></div><span className="grid size-9 place-items-center rounded-lg text-[#8A96A6] transition group-hover:bg-[#F1F4F8] group-hover:text-[#4D8DFF]" aria-hidden="true"><MoreHorizontal size={18}/></span></div>
    <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 border-t border-[#E4E9F0] pt-5 text-xs"><CardField label="Submitted by" value={item.submittedBy}/><CardField label="Evidence type" value={item.category}/><CardField label="Related claim" value={item.relatedClaim} accent/><CardField label="Relevance" value={item.relevance}/></div><div className="mt-5"><StatusBadge status={item.status}/></div>
  </button>;
}
function CardField({label,value,accent=false}:{label:string;value:string;accent?:boolean}){return <div className="min-w-0"><p className="text-[#929DAC]">{label}</p><p className={`mt-1.5 truncate font-medium ${accent?"font-semibold text-[#326DCA]":"text-[#435168]"}`}>{value}</p></div>}
