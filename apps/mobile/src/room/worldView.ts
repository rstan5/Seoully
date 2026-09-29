/**
 * Native world navigation is a camera state machine, matching web `WorldView`.
 * Back means zoom out one spatial level — never a history stack.
 */

export const CANONICAL_ZONE_KINDS = ["shelf", "wall", "case", "desk", "binder", "archive"] as const;
export type CanonicalZoneKind = (typeof CANONICAL_ZONE_KINDS)[number];

export const CANONICAL_ZONE_LABELS: Record<CanonicalZoneKind, string> = {
  shelf: "Shelf",
  wall: "Wall",
  case: "Case",
  desk: "Desk",
  binder: "Binder",
  archive: "Archive",
};

export type NativeWorldView =
  | { kind: "home" }
  | { kind: "zone"; zone: CanonicalZoneKind }
  | { kind: "inspect"; zone: CanonicalZoneKind; holdingId: string }
  | { kind: "binder"; spread: number; heldHoldingId?: string }
  | { kind: "edit" };

export function isCanonicalZoneKind(value: string): value is CanonicalZoneKind {
  return (CANONICAL_ZONE_KINDS as readonly string[]).includes(value);
}

export function focusedZoneOf(view: NativeWorldView): CanonicalZoneKind | null {
  if (view.kind === "zone" || view.kind === "inspect") return view.zone;
  if (view.kind === "binder") return "binder";
  return null;
}

export function zoneInteractive(view: NativeWorldView, zone: CanonicalZoneKind) {
  if (view.kind === "edit" || view.kind === "binder") return false;
  const focused = focusedZoneOf(view);
  return focused === null || focused === zone;
}

/**
 * One step out along the spatial hierarchy.
 * Card focus → binder spread → desk/binder context → room → app layer.
 */
export function stepBack(view: NativeWorldView): NativeWorldView | "leave" {
  switch (view.kind) {
    case "inspect":
      return { kind: "zone", zone: view.zone };
    case "binder":
      if (view.heldHoldingId) return { kind: "binder", spread: view.spread };
      return { kind: "zone", zone: "desk" };
    case "zone":
    case "edit":
      return { kind: "home" };
    case "home":
      return "leave";
    default:
      return "leave";
  }
}

export function openBinderView(spread = 0): NativeWorldView {
  return { kind: "binder", spread: Math.max(0, spread) };
}

export function inspectView(zone: CanonicalZoneKind, holdingId: string): NativeWorldView {
  return { kind: "inspect", zone, holdingId };
}

export function zoneFromSurfaceId(surfaceId: string | null | undefined, roomId: string): CanonicalZoneKind | "floor" {
  if (!surfaceId) return "desk";
  if (surfaceId.startsWith(`${roomId}-shelf`)) return "shelf";
  if (surfaceId.startsWith(`${roomId}-display-case`) || surfaceId.includes("case")) return "case";
  if (surfaceId === `${roomId}-wall` || surfaceId.endsWith("-wall")) return "wall";
  if (surfaceId === `${roomId}-archive` || surfaceId.includes("archive")) return "archive";
  if (surfaceId === `${roomId}-binder` || surfaceId.includes("binder")) return "binder";
  if (surfaceId === `${roomId}-desk` || surfaceId.includes("desk")) return "desk";
  return "floor";
}
