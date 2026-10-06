/** Portable owner-layout contract. SQL parity is checked by Repair 08 checks. */
export const ROOM_OBJECT_KINDS = ["shelf", "desk", "case", "chair", "lamp", "table-lamp", "plant", "large-plant", "rug", "archive", "wall-frame", "photo-string"] as const;
export type RoomObjectKind = typeof ROOM_OBJECT_KINDS[number];
export const PHOTO_STRING_CAPACITY = 5;
export type PhotoStringConfig = { slots: (string | null)[] };

export function validPhotoStringConfig(value: unknown): value is PhotoStringConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== 1 || !Array.isArray(row.slots) || row.slots.length !== PHOTO_STRING_CAPACITY) return false;
  const ids = row.slots.filter((id) => id !== null);
  return ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 80)
    && new Set(ids.map((id) => typeof id === "string" ? id.toLowerCase() : id)).size === ids.length;
}

export function eligiblePhotoStringHolding(holding: { ownerUserId: string; template: { kind: string; status: string } }, ownerId: string) {
  return holding.ownerUserId === ownerId && holding.template.kind === "photocard" && holding.template.status !== "restricted";
}

export const ROOM_TURN_DEGREES = 30;
export const ROOM_YAWS = [0,30,60,90,120,150,180,210,240,270,300,330] as const;
export type RoomYaw = typeof ROOM_YAWS[number];
export function normalizeRoomYaw(value: unknown): RoomYaw {
  return (typeof value === "number" && Number.isFinite(value) ? ((Math.round(value / ROOM_TURN_DEGREES) * ROOM_TURN_DEGREES) % 360 + 360) % 360 : 0) as RoomYaw;
}

export type RoomObjectParent = { objectId: string; surfaceId: string };
export const SMALL_DECOR_KINDS = ["plant", "table-lamp"] as const;
export const ROOM_CARRIER_SURFACES: Record<string, readonly string[]> = {
  shelf: ["shelf-bay-0", "shelf-bay-1", "shelf-bay-2", "shelf-bay-3"],
  desk: ["desk"], chair: ["chair-seat"],
  case: ["display-case-shelf", "display-case-lower", "display-case-top", "display-case-crown"],
  archive: ["archive"],
};
/** One level only: no ownership, no recursion, no small-decor parents. */
export function validRoomObjectRelationships(objects: readonly { id: string; kind: string; parent?: RoomObjectParent; binderDesk?: boolean }[]) {
  if (objects.filter(o => o.binderDesk === true).length > 1) return false;
  return objects.every(o => {
    if (o.binderDesk !== undefined && (o.binderDesk !== true || o.kind !== "desk")) return false;
    if (o.parent === undefined) return true;
    const p = o.parent;
    if (!p || typeof p !== "object" || Object.keys(p).length !== 2 || typeof p.objectId !== "string" || typeof p.surfaceId !== "string" || !(SMALL_DECOR_KINDS as readonly string[]).includes(o.kind)) return false;
    const parent = objects.find(candidate => candidate.id === p.objectId);
    return Boolean(parent && !parent.parent && parent.id !== o.id && ROOM_CARRIER_SURFACES[parent.kind]?.includes(p.surfaceId));
  });
}

export const ROOM_BINDER_COLORS = { cream: "#f3e8da", blush: "#e6bac7", lavender: "#c9b9df", sage: "#b5c8b5", sky: "#b8d2e5", cocoa: "#9b7664", charcoal: "#3a3548" } as const;
export type RoomBinderColor = keyof typeof ROOM_BINDER_COLORS;
