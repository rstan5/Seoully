import { groundedOrigin, CONTACT_EPSILON } from "./roomGrounding";
import { CAMERA_FOV_DEG, type CameraPose } from "./camera";
import { layoutX, layoutZ } from "./roomLayout";
import {
  nativeRoomSurfaces,
  settleRoomRenderable,
  surfaceAcceptsGeometry,
  type NativeRoomSurface,
  type NativeRoomVector,
  type RoomRenderable,
} from "./model";
import type { RoomObjectInstance } from "./roomObjects";
import { visibleLowerBound, extentsForGeometry } from "./representation";

/** Long enough that a normal tap does not acquire; short enough to feel immediate. */
export const LONG_PRESS_MS = 320;
export const LONG_PRESS_SLOP_PX = 12;
export const HELD_LIFT = 0.22;
export const HELD_SCALE = 1.04;
const RAY_MIN_T = 0.08;
const SURFACE_MARGIN = 0.06;

export type HeldEdit = {
  holdingId: string;
  /** Existing RoomPlacement being moved. Null means a new place-from-storage session. */
  origin: RoomRenderable | null;
  rest: RoomRenderable;
  preview: RoomRenderable;
  surfaceId: string | null;
  valid: boolean;
};

/** Lifted takeout pose above the Archive crate — not a fake persisted origin. */
export const STORAGE_TAKEOUT = { x: layoutX(-1.2), y: -1.12, z: layoutZ(-0.65) };

export type PlacementCandidate = {
  surface: NativeRoomSurface;
  point: NativeRoomVector;
  rest: RoomRenderable;
  preview: RoomRenderable;
  valid: boolean;
};

type Ray = { origin: NativeRoomVector; dir: NativeRoomVector };

export function cloneRenderable(item: RoomRenderable): RoomRenderable {
  return {
    ...item,
    position: { ...item.position },
    rotation: { ...item.rotation },
    ...(item.placement ? { placement: { ...item.placement } } : {}),
  };
}

export function compatibleSurfaces(roomId: string, geometry: RoomRenderable["geometry"], objects?: RoomObjectInstance[]) {
  return nativeRoomSurfaces(roomId, objects).filter((surface) => surfaceAcceptsGeometry(surface, geometry));
}

export function orientationForSurface(origin: RoomRenderable, surface: NativeRoomSurface): NativeRoomVector {
  if (surface.kind === "wall") {
    return { x: 0, y: 0, z: 0 };
  }
  return { ...origin.rotation };
}

export function liftHeldRenderable(rest: RoomRenderable, surfaceKind: NativeRoomSurface["kind"], reducedMotion = false): RoomRenderable {
  const lift = reducedMotion ? 0.06 : HELD_LIFT;
  if (surfaceKind === "wall") {
    return {
      ...rest,
      position: { ...rest.position, z: rest.position.z + lift * 0.55 },
      scale: rest.scale,
    };
  }
  return {
    ...rest,
    position: { ...rest.position, y: rest.position.y + lift },
    scale: rest.scale,
  };
}

export function placementsMatch(a: RoomRenderable, b: RoomRenderable) {
  return a.holding.id === b.holding.id
    && Math.abs(a.position.x - b.position.x) < 0.04
    && Math.abs(a.position.y - b.position.y) < 0.04
    && Math.abs(a.position.z - b.position.z) < 0.04
    && (a.placement?.surfaceId ?? "") === (b.placement?.surfaceId ?? "");
}

export function previewOnSurface(origin: RoomRenderable, surface: NativeRoomSurface, point: NativeRoomVector): RoomRenderable {
  const size = extentsForGeometry(origin.geometry);
  const halfX = size.x * origin.scale / 2;
  const halfY = size.y * origin.scale / 2;
  const halfZ = size.z * origin.scale / 2;
  const rotation = orientationForSurface(origin, surface);
  const position = surface.kind === "wall"
    ? {
      x: clamp(point.x, surface.x - surface.width / 2 + Math.min(halfX, surface.width / 2 - 0.02), surface.x + surface.width / 2 - Math.min(halfX, surface.width / 2 - 0.02)),
      y: clamp(point.y, surface.y - surface.depth / 2 + halfY, surface.y + surface.depth / 2 - halfY),
      z: surface.z + 0.06,
    }
    : {
      x: clamp(point.x, surface.x - surface.width / 2 + Math.min(halfX, surface.width / 2 - 0.02), surface.x + surface.width / 2 - Math.min(halfX, surface.width / 2 - 0.02)),
      y: groundedOrigin(surface.y, visibleLowerBound(origin.geometry, origin.scale, rotation), CONTACT_EPSILON),
      z: clamp(point.z, surface.z - surface.depth / 2 + Math.min(halfZ, surface.depth / 2 - 0.02), surface.z + surface.depth / 2 - Math.min(halfZ, surface.depth / 2 - 0.02)),
    };
  return {
    ...origin,
    position,
    rotation,
    ...(origin.placement ? { placement: { ...origin.placement, surfaceId: surface.id } } : {}),
  };
}

export function screenRay(
  locX: number,
  locY: number,
  width: number,
  height: number,
  pose: CameraPose,
  fovDeg = CAMERA_FOV_DEG,
): Ray {
  const aspect = width / Math.max(1, height);
  const ndcX = (locX / Math.max(1, width)) * 2 - 1;
  const ndcY = -((locY / Math.max(1, height)) * 2 - 1);
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  const forward = normalize({
    x: pose.lookAt.x - pose.position.x,
    y: pose.lookAt.y - pose.position.y,
    z: pose.lookAt.z - pose.position.z,
  });
  const right = normalize(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = cross(right, forward);
  return {
    origin: { ...pose.position },
    dir: normalize({
      x: right.x * ndcX * tanHalf * aspect + up.x * ndcY * tanHalf + forward.x,
      y: right.y * ndcX * tanHalf * aspect + up.y * ndcY * tanHalf + forward.y,
      z: right.z * ndcX * tanHalf * aspect + up.z * ndcY * tanHalf + forward.z,
    }),
  };
}

export function intersectSurface(ray: Ray, surface: NativeRoomSurface) {
  if (surface.kind === "wall") {
    if (Math.abs(ray.dir.z) < 1e-5) return null;
    const t = (surface.z - ray.origin.z) / ray.dir.z;
    if (t < RAY_MIN_T) return null;
    const point = along(ray, t);
    const inBounds = Math.abs(point.x - surface.x) <= surface.width / 2 + SURFACE_MARGIN
      && Math.abs(point.y - surface.y) <= surface.depth / 2 + SURFACE_MARGIN;
    return { t, point, inBounds };
  }
  if (Math.abs(ray.dir.y) < 1e-5) return null;
  const t = (surface.y - ray.origin.y) / ray.dir.y;
  if (t < RAY_MIN_T) return null;
  const point = along(ray, t);
  const inBounds = Math.abs(point.x - surface.x) <= surface.width / 2 + SURFACE_MARGIN
    && Math.abs(point.z - surface.z) <= surface.depth / 2 + SURFACE_MARGIN;
  return { t, point, inBounds };
}

export function projectTouchOntoSurfaces(
  locX: number,
  locY: number,
  width: number,
  height: number,
  pose: CameraPose,
  roomId: string,
  origin: RoomRenderable,
  reducedMotion = false,
  objects?: RoomObjectInstance[],
): PlacementCandidate | null {
  const ray = screenRay(locX, locY, width, height, pose);
  const surfaces = nativeRoomSurfaces(roomId, objects);
  let bestValid: { surface: NativeRoomSurface; point: NativeRoomVector; t: number } | null = null;
  let bestAny: { surface: NativeRoomSurface; point: NativeRoomVector; t: number } | null = null;
  for (const surface of surfaces) {
    const hit = intersectSurface(ray, surface);
    if (!hit) continue;
    if (!bestAny || hit.t < bestAny.t) bestAny = { surface, point: hit.point, t: hit.t };
    if (hit.inBounds && surfaceAcceptsGeometry(surface, origin.geometry) && (!bestValid || hit.t < bestValid.t)) {
      bestValid = { surface, point: hit.point, t: hit.t };
    }
  }
  if (bestValid) {
    const rest = previewOnSurface(origin, bestValid.surface, bestValid.point);
    const settled = settleRoomRenderable(rest, roomId, bestValid.surface.id, objects);
    return {
      surface: bestValid.surface,
      point: bestValid.point,
      rest: settled.renderable,
      preview: liftHeldRenderable(settled.renderable, bestValid.surface.kind, reducedMotion),
      valid: true,
    };
  }
  if (!bestAny) return null;
  return {
    surface: bestAny.surface,
    point: bestAny.point,
    rest: origin,
    preview: {
      ...origin,
      position: {
        x: bestAny.point.x,
        y: bestAny.surface.kind === "wall" ? bestAny.point.y : bestAny.point.y + (reducedMotion ? 0.06 : HELD_LIFT),
        z: bestAny.point.z,
      },
    },
    valid: false,
  };
}

export function acquireHeld(origin: RoomRenderable, reducedMotion = false): HeldEdit {
  const surfaceKind = origin.placement?.surfaceId?.endsWith("-wall") ? "wall" : "horizontal";
  const rest = cloneRenderable(origin);
  return {
    holdingId: origin.holding.id,
    origin: rest,
    rest,
    preview: liftHeldRenderable(rest, surfaceKind, reducedMotion),
    surfaceId: origin.placement?.surfaceId ?? null,
    valid: Boolean(origin.placement?.surfaceId),
  };
}

export function acquirePlaceFromStorage(draft: RoomRenderable, reducedMotion = false, takeout: NativeRoomVector = STORAGE_TAKEOUT): HeldEdit {
  const rest = cloneRenderable({
    ...draft,
    position: { ...takeout },
  });
  return {
    holdingId: draft.holding.id,
    origin: null,
    rest,
    preview: liftHeldRenderable(rest, "horizontal", reducedMotion),
    surfaceId: null,
    valid: false,
  };
}

function along(ray: Ray, t: number): NativeRoomVector {
  return {
    x: ray.origin.x + ray.dir.x * t,
    y: ray.origin.y + ray.dir.y * t,
    z: ray.origin.z + ray.dir.z * t,
  };
}

function normalize(value: NativeRoomVector): NativeRoomVector {
  const length = Math.hypot(value.x, value.y, value.z) || 1;
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function cross(a: NativeRoomVector, b: NativeRoomVector): NativeRoomVector {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
