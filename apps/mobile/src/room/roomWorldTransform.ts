import { surfaceFitScale } from "./surfaceFit";
import { nativeRoomSurfaces } from "./model";
import { visibleLowerBound, type NativeRepresentationKind } from "./representation";
import { FLOOR_Y, CONTACT_EPSILON, groundedOrigin } from "./roomGrounding";
import { ZONE_DOCKS, type CameraPose } from "./camera";
import type { NativeRoomVector, RoomRenderable } from "./model";
import {
  CARRIER_ROOM_OBJECT_KINDS,
  objectSurfaceTop,
  objectPointFromAuthored,
  objectPointToAuthored,
  furnitureDelta,
  objectByKind,
  surfaceOwner,
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
  return surfaceOwner(roomId, objects, surfaceId);
}

export function liveParentObject(
  roomId: string | undefined,
  surfaceId: string | null | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): RoomObjectInstance | null {
  if (carry && roomId && parentObjectForSurface(roomId, surfaceId, objects)?.id === carry.origin.id) {
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
 * translation and yaw are applied exactly once here.
 */
export function resolveRoomWorldTransform(
  item: RoomTransformSource,
  roomId: string | undefined,
  objects: RoomObjectInstance[],
  carry?: FurnitureCarry | null,
): { position: NativeRoomVector; rotation: NativeRoomVector; fittedScale: number } {
  const parent = liveParentObject(roomId, item.placement?.surfaceId, objects, carry);
  const position = parent ? objectPointFromAuthored(item.position, parent) : item.position;
  const rotation = composeParentYaw(item.rotation ?? ZERO, parent?.rotateY ?? 0);
  const surfaceId = item.placement?.surfaceId;
  const liveObjects = carry ? objects.map((obj) => obj.id === carry.current.id ? carry.current : obj) : objects;
  const surfaceY = surfaceId?.endsWith("-floor") ? FLOOR_Y
    : roomId && surfaceId ? objectSurfaceTop(roomId, liveObjects, surfaceId) : undefined;
  const surface = roomId && surfaceId ? nativeRoomSurfaces(roomId, liveObjects).find(s => s.id === surfaceId) : undefined;
  const fittedScale = item.geometry ? surfaceFitScale(item.geometry, item.scale ?? 1, item.rotation ?? ZERO, surface) : item.scale ?? 1;
  const contactY = item.geometry && surfaceY !== undefined
    ? groundedOrigin(surfaceY, visibleLowerBound(item.geometry, fittedScale, rotation), CONTACT_EPSILON)
    : position.y;
  const contact = { ...position, y: contactY };
  return {
    position: contact,
    rotation,
    fittedScale,
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
  const parent = liveParentObject(roomId, surfaceId, objects, carry);
  return parent ? objectPointToAuthored(world, parent) : { ...world };
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
    ...(item.rotation ? { rotation: composeParentYaw(item.rotation, -(liveParentObject(roomId, item.placement?.surfaceId, objects, carry)?.rotateY ?? 0)) } : {}),
  };
}

export function liveZoneDock(zone: CanonicalZoneKind, objects: RoomObjectInstance[], instanceId?: string): CameraPose {
  const dock = ZONE_DOCKS[zone];
  const kind = zone === "binder" ? "desk" : zone;
  if (kind === "wall" || !CARRIER_ROOM_OBJECT_KINDS.has(kind as RoomObjectInstance["kind"])) return dock;
  const object = instanceId ? objects.find((object) => object.id === instanceId && object.kind === kind) : objectByKind(objects, kind as RoomObjectInstance["kind"]);
  if (!object) return dock;
  return {
    position: objectPointFromAuthored(dock.position, object),
    lookAt: objectPointFromAuthored(dock.lookAt, object),
  };
}

export function inspectItemAtWorld(item: RoomRenderable, roomId: string | undefined, objects: RoomObjectInstance[], carry?: FurnitureCarry | null): RoomRenderable {
  return withResolvedWorld(item, roomId, objects, carry);
}

/** Compose parent yaw with the child's XYZ Euler pose, including tilted legacy collectibles. */
export function composeParentYaw(rotation: NativeRoomVector, degrees: number): NativeRoomVector {
  if (degrees === 0) return { ...rotation };
  if (rotation.x === 0 && rotation.z === 0) return { ...rotation, y: rotation.y + degrees * Math.PI / 180 };
  const a = Math.cos(rotation.x), b = Math.sin(rotation.x);
  const c = Math.cos(rotation.y), d = Math.sin(rotation.y);
  const e = Math.cos(rotation.z), f = Math.sin(rotation.z);
  const yaw = degrees * Math.PI / 180, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const m11 = cy*c*e + sy*(b*f-a*d*e), m12 = -cy*c*f + sy*(b*e+a*d*f), m13 = cy*d+sy*a*c;
  const m22 = a*e-b*d*f, m23 = -b*c;
  const m32 = sy*c*f+cy*(b*e+a*d*f), m33 = -sy*d+cy*a*c;
  const y = Math.asin(Math.max(-1, Math.min(1, m13)));
  return Math.abs(m13) < 0.9999999 ? { x: Math.atan2(-m23,m33), y, z: Math.atan2(-m12,m11) } : { x: Math.atan2(m32,m22), y, z: 0 };
}
