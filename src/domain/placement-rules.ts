import { FLOOR_Y, ROOM_DEPTH, ROOM_WIDTH } from "./fixtures/collectors";
import type { Room, RoomObject, Transform3D } from "./types";
import { DECOR_BY_ID } from "./fixtures/decor";

export type SurfaceKind = "floor" | "wall" | "table";

/**
 * A landing plane. Surfaces suggest where an object can sit; they do not
 * forbid anywhere else. Proximity during a drag is how the room reads intent.
 */
export interface Surface {
  id: string;
  kind: SurfaceKind;
  /** Center of the plane in world space. */
  origin: Transform3D;
  /** Extent: w along x, d along z (floor/table) or along y (wall). */
  size: { w: number; d: number };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Soft walls of the diorama — keep objects in the room, not on a slot. */
export function clampToRoom(transform: Transform3D): Transform3D {
  return {
    ...transform,
    x: clamp(transform.x, -ROOM_WIDTH / 2 + 40, ROOM_WIDTH / 2 - 40),
    y: clamp(transform.y, -ROOM_DEPTH * 0.55, FLOOR_Y - 8),
    z: clamp(transform.z, -ROOM_DEPTH + 20, -40),
  };
}

/**
 * Horizontal and wall planes the pointer can "find" while dragging.
 *
 * Built from the room's furniture, not from the object's type — a speaker
 * does not own a list of legal homes. The table is just a table.
 */
export function surfacesForRoom(room: Room, objects: RoomObject[] = []): Surface[] {
  const surfaces: Surface[] = [
    {
      id: `${room.id}-floor`,
      kind: "floor",
      origin: { x: 0, y: FLOOR_Y, z: -ROOM_DEPTH / 2 },
      size: { w: ROOM_WIDTH - 80, d: ROOM_DEPTH - 40 },
    },
    {
      id: `${room.id}-wall`,
      kind: "wall",
      origin: { x: 0, y: -40, z: -ROOM_DEPTH + 18 },
      size: { w: ROOM_WIDTH - 120, d: 980 },
    },
  ];

  for (const zone of room.zones) {
    switch (zone.kind) {
      case "desk":
        surfaces.push({
          id: zone.id,
          kind: "table",
          origin: {
            x: zone.transform.x,
            y: zone.transform.y - zone.size.h / 2 + 18,
            z: zone.transform.z,
          },
          size: { w: zone.size.w * 1.05, d: 320 },
        });
        break;
      case "shelf": {
        const frame = 20;
        const board = 16;
        const interior = zone.size.h - frame * 2;
        const bayH = (interior - board * 2) / 3;
        for (let i = 0; i < 3; i++) {
          const top = frame + i * (bayH + board);
          surfaces.push({
            id: `${zone.id}-bay-${i}`,
            kind: "table",
            origin: {
              x: zone.transform.x,
              y: zone.transform.y - zone.size.h / 2 + top + bayH,
              z: zone.transform.z,
            },
            size: { w: zone.size.w - 24, d: 220 },
          });
        }
        break;
      }
      case "display-case":
        surfaces.push({
          id: `${zone.id}-top`,
          kind: "table",
          origin: {
            x: zone.transform.x,
            y: zone.transform.y - zone.size.h / 2 + 8,
            z: zone.transform.z,
          },
          size: { w: zone.size.w * 0.95, d: 180 },
        });
        surfaces.push({
          id: `${zone.id}-shelf`,
          kind: "table",
          origin: {
            x: zone.transform.x,
            y: zone.transform.y,
            z: zone.transform.z,
          },
          size: { w: zone.size.w * 0.88, d: 180 },
        });
        break;
      case "archive":
        surfaces.push({
          id: zone.id,
          kind: "table",
          origin: {
            x: zone.transform.x,
            y: zone.transform.y - zone.size.h * 0.22,
            z: zone.transform.z,
          },
          size: { w: zone.size.w, d: 160 },
        });
        break;
      default:
        break;
    }
  }

  for (const object of objects) {
    if (object.stored) continue;
    const asset = DECOR_BY_ID.get(object.assetId);
    if (!asset) continue;
    if (asset.id === "storage-crate" || asset.id === "display-stand" || asset.id === "speaker") {
      surfaces.push({
        id: object.id,
        kind: "table",
        origin: {
          x: object.transform.x,
          y: object.transform.y - asset.size.h / 2 + 8,
          z: object.transform.z,
        },
        size: { w: asset.size.w * 0.9, d: (asset.size.d ?? 80) * 0.9 },
      });
    }
    if (asset.id === "chair") {
      surfaces.push({
        id: `${object.id}-seat`,
        kind: "table",
        origin: {
          x: object.transform.x,
          y: object.transform.y - 10,
          z: object.transform.z,
        },
        size: { w: asset.size.w * 0.7, d: 90 },
      });
    }
  }

  return surfaces;
}

export function sitY(surface: Surface, objectHeight: number): number {
  if (surface.kind === "wall") return surface.origin.y;
  return surface.origin.y - objectHeight / 2;
}

/**
 * How close the pointer is to a surface's footprint.
 *
 * Height is ignored on purpose. A speaker sitting on the floor is still
 * "over the desk" if the user dragged it there — that is the intention.
 * Scoring by rise made the floor win every time, because the floor is
 * enormous and the object is already on it.
 */
function footprintDistance(point: Transform3D, surface: Surface): number {
  const dx = point.x - surface.origin.x;
  if (surface.kind === "wall") {
    const dy = point.y - surface.origin.y;
    const plane = Math.abs(point.z - surface.origin.z);
    const ox = Math.max(0, Math.abs(dx) - surface.size.w / 2);
    const oy = Math.max(0, Math.abs(dy) - surface.size.d / 2);
    return Math.hypot(ox, oy, plane);
  }
  const dz = point.z - surface.origin.z;
  const ox = Math.max(0, Math.abs(dx) - surface.size.w / 2);
  const oz = Math.max(0, Math.abs(dz) - surface.size.d / 2);
  return Math.hypot(ox, oz);
}

export function nearestSurface(
  point: Transform3D,
  surfaces: Surface[],
  _objectHeight: number,
  reach = 180,
): { surface: Surface; distance: number } | null {
  let bestTable: { surface: Surface; distance: number } | null = null;
  let bestWall: { surface: Surface; distance: number } | null = null;
  let floor: Surface | null = null;

  for (const surface of surfaces) {
    if (surface.kind === "floor") {
      floor = surface;
      continue;
    }
    const distance = footprintDistance(point, surface);
    if (surface.kind === "wall") {
      if (distance <= reach && (!bestWall || distance < bestWall.distance)) {
        bestWall = { surface, distance };
      }
      continue;
    }
    if (distance <= reach && (!bestTable || distance < bestTable.distance)) {
      bestTable = { surface, distance };
    }
  }

  if (bestTable) return bestTable;
  if (bestWall && bestWall.distance < 90) return bestWall;
  if (floor) return { surface: floor, distance: footprintDistance(point, floor) };
  return bestWall;
}

/**
 * Soft pull toward a nearby plane. Strength falls off with footprint
 * distance so an object lifts onto a table as you drag over it, and
 * drops back when you leave.
 */
export function assistTowardSurface(
  point: Transform3D,
  surface: Surface,
  distance: number,
  objectHeight: number,
  reach = 180,
): Transform3D {
  const inside = distance <= 1;
  const t = inside ? 0.9 : Math.max(0, 1 - distance / reach) * 0.82;
  if (t <= 0.04) return point;
  if (surface.kind === "wall") {
    return {
      ...point,
      z: point.z + (surface.origin.z + 10 - point.z) * t,
    };
  }
  const targetY = sitY(surface, objectHeight);
  return {
    ...point,
    y: point.y + (targetY - point.y) * t,
  };
}

export function settleOnSurface(
  point: Transform3D,
  surface: Surface,
  objectHeight: number,
): Transform3D {
  if (surface.kind === "wall") {
    return { ...point, z: surface.origin.z + 10 };
  }
  return { ...point, y: sitY(surface, objectHeight) };
}
