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
  const photocards = holdings.filter((holding) => holding.template.kind === "photocard");
  const groups = new Map<string, { name: string; holdings: NativeHolding[] }>();
  const ungrouped: NativeHolding[] = [];
  for (const holding of photocards) {
    const releaseId = holding.template.releaseId;
    const groupId = holding.template.groupId;
    if (releaseId) {
      const key = `${groupId}:${releaseId}`;
      const current = groups.get(key) ?? {
        name: [holding.template.groupName, holding.template.releaseName].filter(Boolean).join(" · "),
        holdings: [],
      };
      current.holdings.push(holding);
      groups.set(key, current);
      continue;
    }
    if (groupId && holding.template.groupName) {
      const key = `${groupId}:general`;
      const current = groups.get(key) ?? { name: holding.template.groupName, holdings: [] };
      current.holdings.push(holding);
      groups.set(key, current);
      continue;
    }
    ungrouped.push(holding);
  }
  const pages: NativeBinderPage[] = [];
  for (const [setId, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    appendSetPages(pages, setId, group.name, stableHoldings(group.holdings), true);
  }
  if (ungrouped.length) appendSetPages(pages, "seoully-general-photocards", generalName, stableHoldings(ungrouped), false);
  if (!pages.length) appendSetPages(pages, "seoully-general-photocards", generalName, [], false);
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

export function binderSpreads(pages: NativeBinderPage[]): NativeBinderSpread[] {
  const spreads: NativeBinderSpread[] = [];
  for (let index = 0; index < pages.length; index += 2) {
    spreads.push({ index: index / 2, left: pages[index]!, right: pages[index + 1] ?? blankPage("blank", "", 0) });
  }
  return spreads;
}

function appendSetPages(target: NativeBinderPage[], setId: string, setName: string, holdings: NativeHolding[], freshSpread: boolean) {
  if (freshSpread && target.length % 2 === 1) {
    const prior = target.at(-1)!;
    target.push(blankPage(prior.setId, prior.setName, prior.pageInSet + 1));
  }
  const count = Math.max(freshSpread ? 2 : 1, Math.ceil(holdings.length / BINDER_POCKETS_PER_PAGE));
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
    a.template.name.localeCompare(b.template.name) || a.id.localeCompare(b.id),
  );
}
