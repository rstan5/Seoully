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

/** Selected aliases and actual catalog UUIDs both identify the same saved choice. */
export function unselectedIdentityOptions<T extends { id: string; catalogId?: string }>(options: T[], selected: string[]): T[] {
  return [...new Map(options.map(option => [option.id, option])).values()].filter(option => !selected.includes(option.id) && !(option.catalogId && selected.includes(option.catalogId)));
}
