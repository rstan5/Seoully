import { CAMERA_FOV_DEG, type CameraPose } from "./camera";
import {
  clampRoomObject,
  isWallObject,
  roomObjectInBounds,
  type RoomObjectInstance,
} from "./roomObjects";
import type { NativeRoomSurface, NativeRoomVector } from "./model";
import { screenRay } from "./touchEdit";

export const OBJECT_HELD_LIFT = 0.1;
export const WALL_HELD_LIFT = 0.08;

export type HeldRoomObject = {
  objectId: string;
  origin: RoomObjectInstance;
  current: RoomObjectInstance;
  valid: boolean;
  placing: boolean;
};

export function cloneHeldObject(object: RoomObjectInstance): RoomObjectInstance {
  return { ...object };
}

export function acquireRoomObject(origin: RoomObjectInstance, placing = false): HeldRoomObject {
  return {
    objectId: origin.id,
    origin: cloneHeldObject(origin),
    current: cloneHeldObject(origin),
    valid: !placing,
    placing,
  };
}

export function liftRoomObject(object: RoomObjectInstance, reducedMotion = false): RoomObjectInstance {
  const lift = reducedMotion ? 0.04 : isWallObject(object.kind) ? WALL_HELD_LIFT : OBJECT_HELD_LIFT;
  if (isWallObject(object.kind)) {
    return { ...object, z: object.z + lift };
  }
  return { ...object, y: object.y + lift };
}

export function projectRoomObjectOntoWorld(
  locX: number,
  locY: number,
  width: number,
  height: number,
  pose: CameraPose,
  origin: RoomObjectInstance,
): { current: RoomObjectInstance; valid: boolean; surfaceKind: NativeRoomSurface["kind"] } | null {
  const ray = screenRay(locX, locY, width, height, pose, CAMERA_FOV_DEG);
  if (isWallObject(origin.kind)) {
    if (Math.abs(ray.dir.z) < 1e-5) return null;
    const z = origin.z;
    const t = (z - ray.origin.z) / ray.dir.z;
    if (t < 0.08) return null;
    const point = along(ray, t);
    const current = clampRoomObject({ ...origin, x: point.x, y: point.y, z });
    return { current, valid: true, surfaceKind: "wall" };
  }
  if (Math.abs(ray.dir.y) < 1e-5) return null;
  const y = origin.y;
  const t = (y - ray.origin.y) / ray.dir.y;
  if (t < 0.08) return null;
  const point = along(ray, t);
  const current = clampRoomObject({ ...origin, x: point.x, z: point.z });
  return {
    current,
    valid: roomObjectInBounds({ ...origin, x: point.x, y, z: point.z }),
    surfaceKind: "horizontal",
  };
}

export function objectsMatch(a: RoomObjectInstance, b: RoomObjectInstance) {
  return a.id === b.id
    && a.kind === b.kind
    && Math.abs(a.x - b.x) < 0.04
    && Math.abs(a.y - b.y) < 0.04
    && Math.abs(a.z - b.z) < 0.04
    && a.rotateY === b.rotateY;
}

function along(ray: { origin: NativeRoomVector; dir: NativeRoomVector }, t: number): NativeRoomVector {
  return {
    x: ray.origin.x + ray.dir.x * t,
    y: ray.origin.y + ray.dir.y * t,
    z: ray.origin.z + ray.dir.z * t,
  };
}
