import { SETS } from "./fixtures/catalog";
import type { CollectibleKind, CollectibleTemplate, TemplateId, ZoneKind } from "./types";

/**
 * Where a newly confirmed collectible lives until someone moves it.
 *
 * The room is not a dump. A photocard has a binder, an album has a shelf,
 * a poster has a wall. Free placement is something you opt into later.
 */
export interface CollectibleHome {
  zone: ZoneKind;
  /** Confirm-button copy, e.g. "Add to binder". */
  verb: string;
  /** Sentence fragment, e.g. "in your binder". */
  where: string;
}

export function homeForKind(kind: CollectibleKind): CollectibleHome {
  switch (kind) {
    case "photocard":
      return { zone: "binder", verb: "Add to binder", where: "in your binder" };
    case "album":
    case "vinyl":
    case "book":
      return { zone: "shelf", verb: "Add to shelf", where: "on your shelf" };
    case "poster":
      return { zone: "wall", verb: "Add to wall", where: "on your wall" };
    case "lightstick":
    case "figure":
    case "plushie":
      return { zone: "display-case", verb: "Add to display case", where: "in your display case" };
    case "apparel":
      return { zone: "archive", verb: "Add to archive", where: "in your archive" };
    case "memorabilia":
      return { zone: "desk", verb: "Add to desk", where: "on your desk" };
  }
}

export function homeForTemplate(template: CollectibleTemplate): CollectibleHome {
  if (template.kind === "memorabilia" && /kit/i.test(template.name)) {
    return { zone: "archive", verb: "Add to archive", where: "in your archive" };
  }
  return homeForKind(template.kind);
}

export function setForTemplate(templateId: TemplateId) {
  return SETS.find((set) => set.templateIds.includes(templateId));
}

export function nextOpenSlot(used: number[]): number {
  const taken = new Set(used);
  let slot = 0;
  while (taken.has(slot)) slot += 1;
  return slot;
}

/** Binder slots follow the set's pocket index; everything else takes the next bay. */
export function slotForHome(template: CollectibleTemplate, zone: ZoneKind, used: number[]): number {
  if (zone === "binder") {
    const set = setForTemplate(template.id);
    const index = set?.templateIds.indexOf(template.id) ?? -1;
    if (index >= 0) return index;
  }
  return nextOpenSlot(used);
}
