import { ROOM_OBJECT_KINDS } from "./room-object-schema";
export type PublicPhotoStringVisual = { objectId: string; slot: number; templateId: string; template: Record<string, unknown>; catalogImageUrl?: string };
/** Defense in depth: explicit geometry and catalog identity allowlists, never owner config or media. */
export function publicVisualRoomLayout(raw: Record<string, unknown>): Record<string, unknown> {
  if (Object.keys(raw).length === 0) return {};
  return { version: 1, firstRoomEditCompleted: true, objects: (Array.isArray(raw.objects) ? raw.objects : []).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const o = value as Record<string, unknown>;
    if (typeof o.id !== "string" || !(ROOM_OBJECT_KINDS as readonly unknown[]).includes(o.kind)) return [];
    return [{ id: o.id, kind: o.kind, x: o.x, y: o.y, z: o.z, rotateY: o.rotateY, ...(o.binderDesk === true && o.kind === "desk" ? { binderDesk: true } : {}), ...(o.parent && typeof o.parent === "object" && !Array.isArray(o.parent) && typeof (o.parent as Record<string,unknown>).objectId === "string" && typeof (o.parent as Record<string,unknown>).surfaceId === "string" && (o.kind === "plant" || o.kind === "table-lamp") ? { parent: { objectId: (o.parent as Record<string,unknown>).objectId, surfaceId: (o.parent as Record<string,unknown>).surfaceId } } : {}) }];
  }) };
}
export function publicPhotoStringVisuals(raw: unknown): PublicPhotoStringVisual[] {
  if (!Array.isArray(raw)) return [];
  const result: PublicPhotoStringVisual[] = [];
  const seen = new Set<string>();
  for (const value of raw) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>, t = v.template as Record<string, unknown> | undefined;
    if (typeof v.objectId !== "string" || typeof v.templateId !== "string" || typeof v.slot !== "number" || !Number.isInteger(v.slot) || v.slot < 0 || v.slot >= 5 || !t || t.kind !== "photocard" || t.status === "restricted") continue;
    const key = `${v.objectId}:${v.slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const template: Record<string, unknown> = {};
    for (const field of ["id", "kind", "name", "descriptor", "groupId", "groupName", "memberId", "memberName", "releaseId", "releaseName"]) {
      if (typeof t[field] === "string" || t[field] === null) template[field] = t[field];
    }
    result.push({ objectId: v.objectId, slot: v.slot, templateId: v.templateId, template });
  }
  return result;
}
