/** Portable owner-layout contract. SQL parity is checked by Repair 08 checks. */
export const ROOM_OBJECT_KINDS = ["shelf", "desk", "case", "chair", "lamp", "plant", "rug", "archive", "wall-frame", "photo-string"] as const;
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
