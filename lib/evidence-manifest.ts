export type EvidenceManifestItem = {
  evidence_type: string;
  source: string;
  filename: string;
  uri: string;
  content_hash: string;
  description: string;
};

export function serializeEvidenceManifest(
  evidence: EvidenceManifestItem[],
) {
  return `${JSON.stringify({ evidence }, null, 2)}\n`;
}
