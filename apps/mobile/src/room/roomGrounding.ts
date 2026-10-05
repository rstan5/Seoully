import type { RoomObjectKind } from "seoully-domain/room-object-schema";
/** Visible geometry lower bounds in the authored pivot frame; excludes invisible hit meshes/contact decals. */
export const FLOOR_Y = -2.08;
export const CONTACT_EPSILON = 0.002;
export const FURNITURE_LOWER_BOUND: Record<Exclude<RoomObjectKind, "wall-frame" | "photo-string">, number> = {
  shelf: -1.575, desk: -1.09, case: -1.575, chair: -0.9,
  lamp: 0.01, plant: 0, archive: -0.28, rug: -0.01,
};
export const DESK_TABLETOP_TOP = 0.0825;
export const DESK_DRAWER_CENTERS = [-0.16, -0.42, -0.68] as const;
export function groundedOrigin(surfaceY: number, visibleLowerBound: number, offset = 0) {
  return surfaceY - visibleLowerBound + offset;
}
export function furnitureGroundY(kind: RoomObjectKind) {
  if (kind === "wall-frame" || kind === "photo-string") throw new Error("wall_object_has_no_floor_origin");
  return groundedOrigin(FLOOR_Y, FURNITURE_LOWER_BOUND[kind], kind === "rug" ? CONTACT_EPSILON : 0);
}
