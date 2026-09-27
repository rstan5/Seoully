import type { NativeHolding, NativeRoomPlacement } from "../api";

export type NativeRoomVector = { x: number; y: number; z: number };
export type NativeRoomSurface = { id: string; x: number; y: number; z: number; width: number; depth: number };
export type RoomRenderable = {
  holding: NativeHolding;
  position: NativeRoomVector;
  rotation: NativeRoomVector;
  scale: number;
  geometry: "photocard" | "album" | "object" | "generic";
  imageUrl?: string;
  placement?: NativeRoomPlacement;
};

const WORLD_SCALE = 240;

export function buildRoomRenderables(holdings: NativeHolding[], placements: NativeRoomPlacement[]): RoomRenderable[] {
  const placementByHolding = new Map(placements.map((placement) => [placement.holdingId, placement]));
  return holdings.filter((holding) => placementByHolding.has(holding.id)).slice(0, 24).map((holding, index) => {
    const placement = placementByHolding.get(holding.id);
    return roomRenderable(holding, placement, index);
  });
}

export function createInitialRoomRenderable(holding: NativeHolding, index: number): RoomRenderable {
  return roomRenderable(holding, undefined, index);
}

export function toPersistedTransform(renderable: RoomRenderable) {
  return {
    x: renderable.position.x * WORLD_SCALE,
    y: -renderable.position.y * WORLD_SCALE,
    z: renderable.position.z * WORLD_SCALE,
    rotateX: renderable.rotation.x * 180 / Math.PI,
    rotateY: renderable.rotation.y * 180 / Math.PI,
    rotateZ: renderable.rotation.z * 180 / Math.PI,
    scale: renderable.scale,
  };
}

export function moveRenderable(renderable: RoomRenderable, dx: number, dz: number): RoomRenderable {
  return {
    ...renderable,
    position: {
      ...renderable.position,
      x: clamp(renderable.position.x + dx, -4.1, 4.1),
      z: clamp(renderable.position.z + dz, -3.4, 1.5),
    },
  };
}

export function settleRoomRenderable(renderable: RoomRenderable, roomId: string) {
  const surfaces = nativeRoomSurfaces(roomId);
  const surface = surfaces
    .map((candidate) => ({ candidate, distance: footprintDistance(renderable.position, candidate) }))
    .sort((a, b) => a.distance - b.distance)[0]!.candidate;
  const halfHeight = renderable.geometry === "photocard" ? 0.52 : renderable.geometry === "album" ? 0.46 : 0.35;
  return {
    renderable: { ...renderable, position: { ...renderable.position, y: surface.y + halfHeight } },
    surfaceId: surface.id,
  };
}

export function nativeRoomSurfaces(roomId: string): NativeRoomSurface[] {
  return [
    { id: `${roomId}-shelf-lower`, x: -3.15, y: -1.4, z: -3.48, width: 2.1, depth: 0.8 },
    { id: `${roomId}-shelf-middle`, x: -3.15, y: -0.5, z: -3.48, width: 2.1, depth: 0.8 },
    { id: `${roomId}-shelf-upper`, x: -3.15, y: 0.4, z: -3.48, width: 2.1, depth: 0.8 },
    { id: `${roomId}-desk`, x: 1.45, y: -0.72, z: -2.85, width: 3.25, depth: 1.65 },
    { id: `${roomId}-floor`, x: 0, y: -2.15, z: -1.2, width: 9.2, depth: 5.8 },
  ];
}

function fallbackPosition(index: number): NativeRoomVector {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return { x: 0.45 + column * 0.68, y: -0.15, z: -2.9 + row * 0.45 };
}

function roomRenderable(holding: NativeHolding, placement: NativeRoomPlacement | undefined, index: number): RoomRenderable {
  const transform = placement?.transform;
  const fallback = fallbackPosition(index);
  return {
    holding,
    ...(placement ? { placement } : {}),
    geometry: geometryForKind(holding.template.kind),
    ...(holding.personalMediaUrl ? { imageUrl: holding.personalMediaUrl } : {}),
    position: transform ? {
      x: numberAt(transform.x, fallback.x * WORLD_SCALE) / WORLD_SCALE,
      y: -numberAt(transform.y, -fallback.y * WORLD_SCALE) / WORLD_SCALE,
      z: numberAt(transform.z, fallback.z * WORLD_SCALE) / WORLD_SCALE,
    } : fallback,
    rotation: {
      x: degreesToRadians(numberAt(transform?.rotateX, 0)),
      y: degreesToRadians(numberAt(transform?.rotateY, 0)),
      z: degreesToRadians(numberAt(transform?.rotateZ, 0)),
    },
    scale: numberAt(transform?.scale, 1),
  };
}

function geometryForKind(kind: string): RoomRenderable["geometry"] {
  if (kind === "photocard" || kind === "poster") return "photocard";
  if (kind === "album" || kind === "vinyl" || kind === "book") return "album";
  if (["lightstick", "plushie", "figure", "apparel", "memorabilia"].includes(kind)) return "object";
  return "generic";
}

function numberAt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function degreesToRadians(value: number) {
  return value * Math.PI / 180;
}
function footprintDistance(point: NativeRoomVector, surface: NativeRoomSurface) {
  const outsideX = Math.max(0, Math.abs(point.x - surface.x) - surface.width / 2);
  const outsideZ = Math.max(0, Math.abs(point.z - surface.z) - surface.depth / 2);
  return Math.hypot(outsideX, outsideZ, Math.abs(point.y - surface.y) * 0.25);
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
