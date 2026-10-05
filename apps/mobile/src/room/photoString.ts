import { PHOTO_STRING_CAPACITY, validPhotoStringConfig } from "seoully-domain/room-object-schema";
import type { NativeHolding } from "../api";
import type { RoomObjectInstance } from "./roomObjects";

export { PHOTO_STRING_CAPACITY };
export type PublicPhotoStringCard = { objectId: string; slot: number; templateId: string; template: Record<string, unknown>; catalogImageUrl?: string };
export function eligiblePhotocards(holdings: NativeHolding[]) {
  // This list comes from the authenticated owner's Holdings, never public placements.
  return holdings.filter((h) => h.template.kind === "photocard" && h.template.status !== "restricted");
}
export function photoStringSlot(slot: number) {
  const x = -1.08 + slot * 0.54;
  return { x, y: -0.17 * (1 - (x / 1.35) ** 2), z: 0.035, angle: [-0.045, 0.025, -0.02, 0.04, -0.03][slot] ?? 0 };
}
export function photoStringAttachmentWorld(object: RoomObjectInstance, slot: number) {
  const local = photoStringSlot(slot);
  return { x: object.x + local.x, y: object.y + local.y - 0.27, z: object.z + local.z + 0.014 };
}
export function configuredPhotoString(object: RoomObjectInstance, slots: (string | null)[], owned: NativeHolding[]): RoomObjectInstance {
  const config = { slots };
  const eligible = new Set(eligiblePhotocards(owned).map((h) => h.id));
  if (object.kind !== "photo-string" || !validPhotoStringConfig(config) || slots.some((id) => id !== null && !eligible.has(id))) throw new Error("photo_string_holding_ineligible");
  return { ...object, photoString: { slots: [...slots] } };
}
/** Convert an explicitly safe public catalog DTO; no personal media is accepted. */
export function publicPhotoStringHolding(card: PublicPhotoStringCard): NativeHolding {
  const t = card.template;
  return {
    id: `public-string:${card.objectId}:${card.slot}`, templateId: card.templateId,
    acquiredAt: "", tradeStatus: "not-for-trade",
    template: { ...(card.catalogImageUrl ? { imageUrl: card.catalogImageUrl } : {}), id: card.templateId, kind: "photocard", status: "approved", name: String(t.name ?? "Photocard"),
      descriptor: String(t.descriptor ?? ""), groupId: String(t.groupId ?? ""), groupName: String(t.groupName ?? ""),
      memberId: typeof t.memberId === "string" ? t.memberId : null, memberName: typeof t.memberName === "string" ? t.memberName : null,
      releaseId: typeof t.releaseId === "string" ? t.releaseId : null, releaseName: typeof t.releaseName === "string" ? t.releaseName : null },
  };
}
