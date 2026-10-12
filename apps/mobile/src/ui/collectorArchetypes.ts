import type { MobileCopy } from "../i18n";
/** Keep all four established web values; extend without renaming saved identities. */
export const COLLECTOR_ARCHETYPES = [
  "Collector", "Collects everything", "Completionist · era-focused", "Bias-focused · aesthetic curator",
  "Photocard Hunter", "Album Archivist", "Multi-Stan", "Trading Enthusiast", "Concert Collector", "Spontaneous Buyer",
] as const;
export function archetypeLabel(value: string | undefined, copy: MobileCopy) {
  const index = COLLECTOR_ARCHETYPES.indexOf(value as typeof COLLECTOR_ARCHETYPES[number]);
  return index < 0 ? value || copy.archetype0 : copy[`archetype${index}` as 'archetype0'];
}
export function toggleIdentitySelection(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter(value => value !== id) : [...new Set([...ids, id])];
}
