import type { NativeHolding } from "../api";

export const BINDER_POCKETS_PER_PAGE = 6;

export type NativeBinderPocket = { index: number; holding?: NativeHolding };
export type NativeBinderPage = {
  setId: string;
  setName: string;
  pageInSet: number;
  pockets: NativeBinderPocket[];
};
export type NativeBinderSpread = { index: number; left: NativeBinderPage; right: NativeBinderPage };

export function buildNativeBinderPages(holdings: NativeHolding[], generalName: string): NativeBinderPage[] {
  // Binder membership is Holding-backed; catalog release/group metadata does
  // not reserve pages or persist slots. Pack every eligible Holding exactly once.
  const photocards = [...new Map(holdings.filter((holding) => holding.template.kind === "photocard").map(holding => [holding.id, holding])).values()];
  const pages: NativeBinderPage[] = [];
  appendSetPages(pages, "seoully-general-photocards", generalName, stableHoldings(photocards));
  if (pages.length % 2 === 1) {
    const last = pages.at(-1)!;
    pages.push(blankPage(last.setId, last.setName, last.pageInSet + 1));
  }
  return pages;
}

export function binderSectionStarts(spreads: NativeBinderSpread[]) {
  const seen = new Set<string>();
  const sections: { setId: string; setName: string; spreadIndex: number }[] = [];
  for (const spread of spreads) {
    if (seen.has(spread.left.setId)) continue;
    seen.add(spread.left.setId);
    sections.push({ setId: spread.left.setId, setName: spread.left.setName, spreadIndex: spread.index });
  }
  return sections;
}

export function spreadIndexForHolding(spreads: NativeBinderSpread[], holdingId: string) {
  return spreads.findIndex((spread) =>
    spread.left.pockets.some((pocket) => pocket.holding?.id === holdingId)
    || spread.right.pockets.some((pocket) => pocket.holding?.id === holdingId),
  );
}

export function binderSpreads(pages: NativeBinderPage[]): NativeBinderSpread[] {
  const spreads: NativeBinderSpread[] = [];
  for (let index = 0; index < pages.length; index += 2) {
    spreads.push({ index: index / 2, left: pages[index]!, right: pages[index + 1] ?? blankPage("blank", "", 0) });
  }
  return spreads;
}

function appendSetPages(target: NativeBinderPage[], setId: string, setName: string, holdings: NativeHolding[]) {
  const count = Math.max(1, Math.ceil(holdings.length / BINDER_POCKETS_PER_PAGE));
  for (let page = 0; page < count; page += 1) {
    const pockets = Array.from({ length: BINDER_POCKETS_PER_PAGE }, (_, slot) => {
      const holding = holdings[page * BINDER_POCKETS_PER_PAGE + slot];
      return { index: page * BINDER_POCKETS_PER_PAGE + slot, ...(holding ? { holding } : {}) };
    });
    target.push({ setId, setName, pageInSet: page, pockets });
  }
}

function blankPage(setId: string, setName: string, pageInSet: number): NativeBinderPage {
  return { setId, setName, pageInSet, pockets: Array.from({ length: BINDER_POCKETS_PER_PAGE }, (_, index) => ({ index })) };
}

function stableHoldings(holdings: NativeHolding[]) {
  return [...holdings].sort((a, b) =>
    (a.template.memberName ?? "").localeCompare(b.template.memberName ?? "")
    || a.template.name.localeCompare(b.template.name)
    || a.id.localeCompare(b.id),
  );
}
