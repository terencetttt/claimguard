"use client";

import { useEffect } from "react";
import { evidenceBlobId, evidenceBlobStorage } from "@/lib/evidence-blob-storage";

/** Persists selected intake files before the draft reduces them to JSON metadata. */
export function useEvidenceFilePersistence() {
  useEffect(() => {
    const captureFile = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file") return;
      const file = input.files?.[0];
      if (!file) return;
      const id = evidenceBlobId(file.name, file.size, file.type);
      void evidenceBlobStorage.save(id, file).catch(() => undefined);
    };
    document.addEventListener("change", captureFile, true);
    return () => document.removeEventListener("change", captureFile, true);
  }, []);
}
