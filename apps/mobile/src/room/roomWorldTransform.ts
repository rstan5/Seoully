import { visibleLowerBound, type NativeRepresentationKind } from "./representation";
import { FLOOR_Y, CONTACT_EPSILON, groundedOrigin } from "./roomGrounding";
import { ZONE_DOCKS, type CameraPose } from "./camera";
import type { NativeRoomVector, RoomRenderable } from "./model";
import {
  CARRIER_ROOM_OBJECT_KINDS,
  objectSurfaceTop,
  furnitureDelta,
  objectByKind,
  objectOwnsSurface,
  type RoomObjectInstance,
} from "./roomObjects";
import type { CanonicalZoneKind } from "./worldView";

export type FurnitureCarry = {
  roomId: string;
  origin: RoomObjectInstance;
  current: RoomObjectInstance;
};

export type RoomTransformSource = {
  position: NativeRoomVector;
  rotation?: NativeRoomVector;
  geometry?: NativeRepresentationKind;
  scale?: number;
  placement?: { surfaceId?: string | null };
};

const ZERO: NativeRoomVector = { x: 0, y: 0, z: 0 };

export function parentObjectForSurface(
  roomId: string | undefined,
  surfaceId: string | null | undefined,
  objects: RoomObjectInstance[],
): RoomObjectInstance | null {
  if (!roomId || !surfaceId) return null;
  return objects.find((object) => objectOwnsSurface(roomId, object, surfaceId)) ?? null;
}

export function liveParentObject(
  roomId: string | undefined,
  surfaceId: string | null | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): RoomObjectInstance | null {
  if (carry && roomId && objectOwnsSurface(carry.roomId, carry.origin, surfaceId)) {
    return carry.current;
  }
  return parentObjectForSurface(roomId, surfaceId, objects);
}

export function parentDisplacement(
  roomId: string | undefined,
  surfaceId: string | null | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): NativeRoomVector {
  const parent = liveParentObject(roomId, surfaceId, objects, carry);
  return parent ? furnitureDelta(parent) : ZERO;
}

/**
 * Current effective world transform for a physical Room object.
 * Authored/legacy placement stays default-furniture-relative; live furniture
 * displacement is applied exactly once here.
 */
export function resolveRoomWorldTransform(
  item: RoomTransformSource,
  roomId: string | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): { position: NativeRoomVector; rotation: NativeRoomVector } {
  const delta = parentDisplacement(roomId, item.placement?.surfaceId, objects, carry);
  const surfaceId = item.placement?.surfaceId;
  const liveObjects = carry ? objects.map((obj) => obj.id === carry.current.id ? carry.current : obj) : objects;
  const surfaceY = surfaceId?.endsWith("-floor") ? FLOOR_Y
    : roomId && surfaceId ? objectSurfaceTop(roomId, liveObjects, surfaceId) : undefined;
  const contactY = item.geometry && surfaceY !== undefined
    ? groundedOrigin(surfaceY, visibleLowerBound(item.geometry, item.scale ?? 1, item.rotation ?? ZERO), CONTACT_EPSILON)
    : item.position.y + delta.y;
  return {
    position: {
      x: item.position.x + delta.x,
      y: contactY,
      z: item.position.z + delta.z,
    },
    rotation: item.rotation ?? { x: 0, y: 0, z: 0 },
  };
}

export function withResolvedWorld<T extends RoomTransformSource>(
  item: T,
  roomId: string | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): T {
  const resolved = resolveRoomWorldTransform(item, roomId, objects, carry);
  return { ...item, position: resolved.position, rotation: resolved.rotation };
}

export function authoredPlacementFromWorld(
  world: NativeRoomVector,
  roomId: string | undefined,
  surfaceId: string | null | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): NativeRoomVector {
  const delta = parentDisplacement(roomId, surfaceId, objects, carry);
  return {
    x: world.x - delta.x,
    y: world.y - delta.y,
    z: world.z - delta.z,
  };
}

export function asAuthoredRenderable<T extends RoomTransformSource>(
  item: T,
  roomId: string | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): T {
  return {
    ...item,
    position: authoredPlacementFromWorld(item.position, roomId, item.placement?.surfaceId, objects, carry),
  };
}

export function liveZoneDock(zone: CanonicalZoneKind, objects: RoomObjectInstance[]): CameraPose {
  const dock = ZONE_DOCKS[zone];
  const kind = zone === "binder" ? "desk" : zone;
  if (kind === "wall" || !CARRIER_ROOM_OBJECT_KINDS.has(kind as RoomObjectInstance["kind"])) return dock;
  const object = objectByKind(objects, kind as RoomObjectInstance["kind"]);
  if (!object) return dock;
  const delta = furnitureDelta(object);
  return {
    position: { x: dock.position.x + delta.x, y: dock.position.y + delta.y, z: dock.position.z + delta.z },
    lookAt: { x: dock.lookAt.x + delta.x, y: dock.lookAt.y + delta.y, z: dock.lookAt.z + delta.z },
  };
}

export function inspectItemAtWorld(item: RoomRenderable, roomId: string | undefined, objects: RoomObjectInstance[], carry?: FurnitureCarry | null): RoomRenderable {
  return withResolvedWorld(item, roomId, objects, carry);
}
