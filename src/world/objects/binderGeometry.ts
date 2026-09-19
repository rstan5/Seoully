import type { CollectibleTemplate, HoldingView, SetProgress, TemplateId } from "@/domain/types";

/**
 * Binder geometry and paging.
 *
 * Kept out of the component so the camera can consume it too: the camera has to
 * know where an opened binder ends up and how tall it is in order to frame it,
 * and importing a React component into the camera math to find that out would
 * be backwards.
 */

/** One page of a spread, closed-binder-sized. */
export const PAGE_W = 178;
export const PAGE_H = 214;
export const SPINE_W = 26;

/** Pocket grid on a page. Three across, two down. */
export const COLS = 3;
export const ROWS = 2;
export const POCKETS_PER_PAGE = COLS * ROWS;

/** Card size inside a sleeve, sized to the grid rather than the other way round. */
export const POCKET_CARD_H = 86;

/**
 * Where the binder comes to rest when opened.
 *
 * It leaves the desk. That's the whole point: a binder flat on a desk is
 * edge-on to any camera standing in the room, so it can only be read by
 * cheating the camera underneath the floor. Lifting and tilting it toward the
 * viewer is both readable and the thing a person actually does — you pick the
 * binder up.
 */
export const OPEN_LIFT = { y: -96, z: 250 };

export interface BinderPocket {
  index: number;
  template?: CollectibleTemplate;
  /** The collector's copy, when they have one. */
  holding?: HoldingView;
}

export interface BinderPage {
  setId: string;
  setName: string;
  /** 0-based page within its set. */
  pageInSet: number;
  pockets: BinderPocket[];
}

export interface BinderSpread {
  left: BinderPage;
  right?: BinderPage;
}

/**
 * Turn a collector's tracked sets into physical pages.
 *
 * Every set starts on a fresh left-hand page, the way collectors actually
 * organize a binder, and short sets leave real empty pockets rather than being
 * repacked to fill space. Those gaps are load-bearing: an empty pocket is the
 * product's whole emotional hook, so the layout must never optimize them away.
 */
export function buildPages(
  progress: SetProgress[],
  holdings: HoldingView[],
  templateOf: (id: TemplateId) => CollectibleTemplate | undefined,
): BinderPage[] {
  const byTemplate = new Map<string, HoldingView>();
  for (const view of holdings) byTemplate.set(view.template.id, view);

  const pages: BinderPage[] = [];

  // Grouped by artist, then stable by set id.
  //
  // The order must not depend on how complete anything is. The repository
  // sorts progress by completion for the profile's benefit, and paging off
  // that list means finishing a set silently renumbers every page after it —
  // so the binder you were reading turns into a different one under your hands
  // the instant a card lands. Which is precisely the moment it must not.
  const ordered = [...progress].sort((a, b) =>
    a.set.groupId === b.set.groupId
      ? a.set.id.localeCompare(b.set.id)
      : a.set.groupId.localeCompare(b.set.groupId),
  );

  for (const entry of ordered) {
    const ids = entry.set.templateIds;
    const pageCount = Math.max(2, Math.ceil(ids.length / POCKETS_PER_PAGE));

    for (let page = 0; page < pageCount; page += 1) {
      const pockets: BinderPocket[] = [];
      for (let slot = 0; slot < POCKETS_PER_PAGE; slot += 1) {
        const idIndex = page * POCKETS_PER_PAGE + slot;
        const templateId = ids[idIndex];
        const template = templateId ? templateOf(templateId) : undefined;
        const holding = templateId ? byTemplate.get(templateId) : undefined;
        pockets.push({
          index: idIndex,
          ...(template ? { template } : {}),
          ...(holding ? { holding } : {}),
        });
      }
      pages.push({
        setId: entry.set.id,
        setName: entry.set.name,
        pageInSet: page,
        pockets,
      });
    }
  }

  return pages;
}

/** Spreads are page pairs, so a spread index is a page index halved. */
export function spreadAt(pages: BinderPage[], spread: number): BinderSpread | undefined {
  const left = pages[spread * 2];
  if (!left) return undefined;
  const right = pages[spread * 2 + 1];
  return right ? { left, right } : { left };
}

export function spreadCount(pages: BinderPage[]): number {
  return Math.ceil(pages.length / 2);
}

/** Spread index a given set's first page lives on. */
export function spreadOfSet(pages: BinderPage[], setId: string): number {
  const index = pages.findIndex((p) => p.setId === setId);
  return index < 0 ? 0 : Math.floor(index / 2);
}

/** Spread that actually holds this card, not just the set's first page. */
export function spreadOfTemplate(pages: BinderPage[], templateId: TemplateId): number {
  const index = pages.findIndex((page) => page.pockets.some((pocket) => pocket.template?.id === templateId));
  return index < 0 ? 0 : Math.floor(index / 2);
}

/**
 * The spread a collector would have the binder open to.
 *
 * The set they're closest to finishing, because that's the page they've been
 * staring at. Opening to page one would be correct and lifeless; opening to
 * the almost-done set is the product noticing what someone cares about.
 */
export function spreadOfInterest(pages: BinderPage[], progress: SetProgress[]): number {
  const contenders = progress
    .filter((entry) => !entry.complete && entry.owned > 0)
    .sort((a, b) => a.total - a.owned - (b.total - b.owned));
  const target = contenders[0] ?? progress[0];
  return target ? spreadOfSet(pages, target.set.id) : 0;
}

/** Full width of an open spread, spine included. */
export const SPREAD_W = PAGE_W * 2 + SPINE_W;

/**
 * World position of one pocket in an open binder.
 *
 * This is what lets a card fly to a *slot* rather than to a rough area. It
 * composes the same offsets the component renders with, ignoring only the few
 * degrees of page splay — and the flight hands off to the real in-sleeve card
 * for the last centimetre, which absorbs that error invisibly.
 */
export function pocketWorldPoint(
  binderAt: { x: number; y: number; z: number },
  side: "left" | "right",
  slot: number,
): { x: number; y: number; z: number } {
  const rect = pocketRect(slot);
  const localX = (side === "right" ? PAGE_W + SPINE_W : 0) + rect.left + rect.w / 2;
  return {
    x: binderAt.x - SPREAD_W / 2 + localX,
    y: binderAt.y + OPEN_LIFT.y - PAGE_H / 2 + rect.top + rect.h / 2,
    z: binderAt.z + OPEN_LIFT.z + 8,
  };
}

/** Which page of a spread a pocket index falls on. */
export function sideOfPocket(pocketIndex: number): "left" | "right" {
  return Math.floor(pocketIndex / POCKETS_PER_PAGE) % 2 === 0 ? "left" : "right";
}

/** Pocket coordinates within a page, for both rendering and flight targeting. */
export function pocketRect(slot: number): { left: number; top: number; w: number; h: number } {
  const cardW = POCKET_CARD_H * (55 / 85);
  const col = slot % COLS;
  const row = Math.floor(slot / COLS);
  const gapX = (PAGE_W - COLS * cardW) / (COLS + 1);
  const gapY = (PAGE_H - ROWS * POCKET_CARD_H) / (ROWS + 1);
  return {
    left: gapX + col * (cardW + gapX),
    top: gapY + row * (POCKET_CARD_H + gapY),
    w: cardW,
    h: POCKET_CARD_H,
  };
}
