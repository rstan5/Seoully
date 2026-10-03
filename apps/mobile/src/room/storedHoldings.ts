import type { NativeHolding } from "../api";

/** Client-side search over already-loaded unplaced owned Holdings. Does not mutate. */
export function filterStoredHoldings(holdings: NativeHolding[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return holdings;
  return holdings.filter((holding) => {
    const template = holding.template;
    return [template.name, template.groupName, template.memberName, template.releaseName, template.kind, template.descriptor]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(needle));
  });
}
