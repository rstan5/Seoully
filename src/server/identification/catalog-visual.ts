import "server-only";

import { lookup } from "node:dns/promises";

/**
 * Seoully-native visual catalog seam. Reference images are private storage
 * assets; this function returns short-lived server-authorized URLs only.
 */
import { listActiveCatalogReferenceImages, type CatalogReferenceImageDTO } from "@/server/dal/catalog-reference-images";

export interface CatalogVisualCandidate {
  id: string;
  templateId: string;
  referenceUrl: string;
  metadata?: Record<string, string>;
}

function isUnsafeHostname(hostname: string): boolean {
  const value = hostname.toLowerCase();
  if (value === "localhost" || value.endsWith(".localhost") || value.endsWith(".local")) return true;
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:")) return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(value)) return true;
  const match = value.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

/** Candidate reference images must remain server-fetched and SSRF-safe. */
export async function isSafeExternalUrl(value: string): Promise<boolean> {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:" || isUnsafeHostname(url.hostname)) return false;
  try {
    const records = await lookup(url.hostname, { all: true });
    return records.length > 0 && records.every((record) => !isUnsafeHostname(record.address));
  } catch { return false; }
}

export async function searchCatalogVisualCandidates(input: {
  templateIds: string[];
  metadata?: Map<string, Record<string, string>>;
}): Promise<CatalogVisualCandidate[]> {
  const references = await listActiveCatalogReferenceImages(input.templateIds);
  return references.slice(0, 150).map((reference: CatalogReferenceImageDTO) => ({
    id: reference.id,
    templateId: reference.templateId,
    referenceUrl: reference.url,
    ...(input.metadata?.get(reference.templateId) ? { metadata: input.metadata.get(reference.templateId) } : {}),
  }));
}
