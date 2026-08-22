"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FileText, ImageIcon, X } from "lucide-react";
import type { EvidenceRepositoryItem } from "@/lib/evidence-data";
import { evidenceBlobStorage } from "@/lib/evidence-blob-storage";

export function EvidencePreviewModal({ item, onClose }: { item: EvidenceRepositoryItem | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(item?.blobId));

  useEffect(() => {
    if (!item) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [item, onClose]);

  useEffect(() => {
    let active = true;
    let url: string | null = null;
    if (!item?.blobId) return;
    evidenceBlobStorage.load(item.blobId).then((record) => {
      if (!active || !record) return;
      url = URL.createObjectURL(record.blob);
      setObjectUrl(url);
    }).catch(() => undefined).finally(() => { if (active) setLoading(false); });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [item]);

  if (!item) return null;
  const isImage = item.mimeType?.startsWith("image/") ?? false;
  return <div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-[#07111F]/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="evidence-preview-title" className="panel my-6 w-full max-w-5xl overflow-hidden shadow-[0_30px_90px_rgba(3,12,25,.35)]">
      <header className="flex items-start justify-between gap-5 border-b border-[#E1E7EF] px-6 py-5">
        <div><p className="eyebrow">Evidence preview</p><h2 id="evidence-preview-title" className="mt-2 text-xl font-semibold tracking-[-.03em] text-[#172437]">{item.title}</h2></div>
        <button ref={closeRef} type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#D6DFEA] text-[#617086] transition hover:bg-[#F1F4F8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4D8DFF]" aria-label="Close evidence preview"><X size={18}/></button>
      </header>
      <div className="grid min-h-[420px] lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,.65fr)]">
        <div className="grid min-h-[360px] place-items-center bg-[#0B1628] p-5">
          {loading ? <p className="text-sm text-white/70">Loading stored evidence…</p> : isImage && objectUrl ? <Image unoptimized src={objectUrl} alt={item.title} width={1400} height={900} className="max-h-[68vh] max-w-full rounded-lg object-contain shadow-2xl"/> : <div className="max-w-sm text-center text-white/70">{isImage ? <ImageIcon className="mx-auto" size={34}/> : <FileText className="mx-auto" size={34}/>}<p className="mt-4 text-sm font-semibold text-white">Preview unavailable</p><p className="mt-2 text-xs leading-5">{item.isSeeded ? "This seeded demonstration record contains metadata only." : "The evidence metadata is preserved, but this browser does not contain the original file bytes. Legacy uploads must be added again to enable preview."}</p></div>}
        </div>
        <dl className="space-y-5 p-6 text-sm">
          <Metadata label="Related claim" value={item.relatedClaim}/><Metadata label="Category" value={item.category}/><Metadata label="Source" value={item.source}/><Metadata label="Filename" value={item.filename}/><Metadata label="Description" value={item.description || "No description supplied"}/><Metadata label="Submitted wallet" value={item.submittedBy}/><Metadata label="Timestamp" value={item.timestamp ? new Date(item.timestamp).toLocaleString("en-NG") : "Seeded demonstration record"}/>
        </dl>
      </div>
    </section>
  </div>;
}

function Metadata({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] uppercase tracking-[.08em] text-[#8A96A6]">{label}</dt><dd className="mt-1.5 break-words font-medium leading-5 text-[#344359]">{value}</dd></div>; }
