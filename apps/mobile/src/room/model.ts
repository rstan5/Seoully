import type { NativeHolding, NativeRoomPlacement } from "../api";
import { extentsForGeometry, representationForHolding, representationKindForHolding, type NativeRepresentationKind } from "./representation";
import { layoutX, layoutZ, ROOM_LAYOUT } from "./roomLayout";

export type NativeRoomVector = { x: number; y: number; z: number };
export type NativeRoomSurface = { id: string; kind: "horizontal" | "wall"; x: number; y: number; z: number; width: number; depth: number };
export type RoomRenderable = {
  holding: NativeHolding;
  position: NativeRoomVector;
  rotation: NativeRoomVector;
  scale: number;
  geometry: NativeRepresentationKind;
  color: string;
  accent: string;
  imageUrl?: string;
  placement?: NativeRoomPlacement;
};

const WORLD_SCALE = 240;
export const ROOM_TEXTURE_BUDGET = 24;

export function buildPublicRoomRenderables(roomId: string, placements: {
  id: string;
  zoneId: string;
  slot: number;
  offset: Record<string, number> | null;
  transform: Record<string, number> | null;
  surfaceId: string | null;
  holding: {
    templateId: string;
    tradeStatus: string;
    template: Record<string, unknown>;
    personalMediaUrl?: string;
  };
}[]): RoomRenderable[] {
  const holdings: NativeHolding[] = placements.map((placement) => {
    const template = placement.holding.template;
    return {
      id: placement.id,
      templateId: placement.holding.templateId,
      acquiredAt: "",
      tradeStatus: placement.holding.tradeStatus === "for-trade" ? "for-trade" : "not-for-trade",
      ...(placement.holding.personalMediaUrl ? { personalMediaUrl: placement.holding.personalMediaUrl } : {}),
      template: {
        id: placement.holding.templateId,
        groupId: stringAt(template.groupId),
        memberId: optionalString(template.memberId),
        releaseId: optionalString(template.releaseId),
        kind: stringAt(template.kind, "memorabilia"),
        name: stringAt(template.name, "Collectible"),
        descriptor: stringAt(template.descriptor),
        status: "active",
        groupName: stringAt(template.groupName),
        memberName: optionalString(template.memberName),
        releaseName: optionalString(template.releaseName),
      },
    };
  });
  const mapped: NativeRoomPlacement[] = placements.map((placement) => ({
    id: placement.id,
    roomId,
    holdingId: placement.id,
    zoneId: placement.zoneId || `${roomId}-floor`,
    slot: placement.slot,
    offset: placement.offset,
    transform: placement.transform,
    surfaceId: placement.surfaceId,
  }));
  return buildRoomRenderables(holdings, mapped);
}

export function buildRoomRenderables(holdings: NativeHolding[], placements: NativeRoomPlacement[]): RoomRenderable[] {
  const placementByHolding = new Map(placements.map((placement) => [placement.holdingId, placement]));
  return holdings.filter((holding) => placementByHolding.has(holding.id)).map((holding, index) => {
    const placement = placementByHolding.get(holding.id);
    return roomRenderable(holding, placement, placement?.slot ?? index);
  });
}

export function nextNativeSlot(used: number[]) {
  const taken = new Set(used);
  let slot = 0;
  while (taken.has(slot)) slot += 1;
  return slot;
}

export function roomTextureIds(items: RoomRenderable[], selectedId: string | null, focusedId: string | null) {
  const ids = new Set<string>();
  if (selectedId) ids.add(selectedId);
  if (focusedId) ids.add(focusedId);
  const ranked = [...items].sort((a, b) => distanceToRoomLook(a.position) - distanceToRoomLook(b.position));
  for (const item of ranked) {
    if (ids.size >= ROOM_TEXTURE_BUDGET) break;
    if (item.imageUrl) ids.add(item.holding.id);
  }
  return ids;
}

export function createInitialRoomRenderable(holding: NativeHolding, index: number, roomId: string): RoomRenderable {
  const home = nativeHomeForHolding(holding, roomId, index);
  return { ...roomRenderable(holding, undefined, index), position: home.position };
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

export function turnRenderable(renderable: RoomRenderable, deltaRadians: number): RoomRenderable {
  return { ...renderable, rotation: { ...renderable.rotation, y: renderable.rotation.y + deltaRadians } };
}

export function resizeRenderable(renderable: RoomRenderable, factor: number): RoomRenderable {
  return { ...renderable, scale: clamp(renderable.scale * factor, 0.5, 1.85) };
}

export function moveRenderable(renderable: RoomRenderable, dx: number, depthOrVertical: number): RoomRenderable {
  if (renderable.placement?.surfaceId?.endsWith("-wall")) {
    return {
      ...renderable,
      position: {
        ...renderable.position,
        x: clamp(renderable.position.x + dx, -4.1, 4.1),
        y: clamp(renderable.position.y - depthOrVertical, -1.5, 2.5),
      },
    };
  }
  return {
    ...renderable,
    position: {
      ...renderable.position,
      x: clamp(renderable.position.x + dx, -4.1, 4.1),
      z: clamp(renderable.position.z + depthOrVertical, -3.4, 1.5),
    },
  };
}

export function surfaceAcceptsGeometry(surface: NativeRoomSurface, geometry: RoomRenderable["geometry"]) {
  if (geometry === "poster") return surface.kind === "wall";
  if (geometry === "photocard") return surface.id.includes("binder") || surface.id.includes("desk");
  if (geometry === "album" || geometry === "vinyl" || geometry === "book" || geometry === "disc-case") {
    return surface.id.includes("shelf") || surface.id.includes("desk");
  }
  if (geometry === "lightstick" || geometry === "figure" || geometry === "plushie") {
    return surface.id.includes("display-case") || surface.id.includes("desk") || surface.id.includes("shelf");
  }
  if (geometry === "apparel" || geometry === "ticket" || geometry === "memorabilia") {
    return surface.id.includes("archive") || surface.id.includes("desk") || surface.id.includes("shelf");
  }
  if (surface.kind === "wall") return false;
  return surface.id.includes("shelf") || surface.id.includes("desk") || surface.id.includes("display-case");
}

export function isSupportedRoomPlacement(renderable: RoomRenderable, roomId: string) {
  return nativeRoomSurfaces(roomId).some((surface) =>
    surfaceAcceptsGeometry(surface, renderable.geometry) && footprintDistance(renderable.position, surface) < 1.45,
  );
}

export function settleRoomRenderable(renderable: RoomRenderable, roomId: string, preferredSurfaceId?: string) {
  const surfaces = nativeRoomSurfaces(roomId).filter((surface) => surfaceAcceptsGeometry(surface, renderable.geometry));
  const preferred = surfaces.find((candidate) => candidate.id === preferredSurfaceId);
  const surface = preferred ?? surfaces
    .map((candidate) => ({ candidate, distance: footprintDistance(renderable.position, candidate) }))
    .sort((a, b) => a.distance - b.distance)[0]?.candidate ?? nativeRoomSurfaces(roomId).find((item) => item.id.endsWith("-desk"))!;
  const halfHeight = extentsForGeometry(renderable.geometry).y / 2;
  return {
    renderable: {
      ...renderable,
      position: surface.kind === "wall"
        ? { ...renderable.position, z: surface.z + 0.06 }
        : { ...renderable.position, y: surface.y + halfHeight },
    },
    surfaceId: surface.id,
  };
}

export function nativeRoomSurfaces(roomId: string): NativeRoomSurface[] {
  return [
    { id: `${roomId}-shelf-bay-0`, kind: "horizontal", x: layoutX(-3.15), y: -1.4, z: layoutZ(-3.48), width: 2.1, depth: 0.8 },
    { id: `${roomId}-shelf-bay-1`, kind: "horizontal", x: layoutX(-3.15), y: -0.5, z: layoutZ(-3.48), width: 2.1, depth: 0.8 },
    { id: `${roomId}-shelf-bay-2`, kind: "horizontal", x: layoutX(-3.15), y: 0.4, z: layoutZ(-3.48), width: 2.1, depth: 0.8 },
    { id: `${roomId}-desk`, kind: "horizontal", x: layoutX(1.45), y: -0.72, z: layoutZ(-2.85), width: 3.25, depth: 1.65 },
    { id: `${roomId}-binder`, kind: "horizontal", x: layoutX(0.45), y: -0.68, z: layoutZ(-2.7), width: 0.95, depth: 0.72 },
    { id: `${roomId}-display-case-shelf`, kind: "horizontal", x: layoutX(3.65), y: -0.5, z: layoutZ(-3.52), width: 1.45, depth: 0.72 },
    { id: `${roomId}-display-case-top`, kind: "horizontal", x: layoutX(3.65), y: 0.48, z: layoutZ(-3.52), width: 1.45, depth: 0.72 },
    { id: `${roomId}-archive`, kind: "horizontal", x: layoutX(-1.2), y: -1.68, z: layoutZ(-0.65), width: 1.7, depth: 1.05 },
    { id: `${roomId}-wall`, kind: "wall", x: layoutX(1.1), y: 0.75, z: ROOM_LAYOUT.backZ + 0.28, width: 3.15, depth: 2.5 },
    { id: `${roomId}-floor`, kind: "horizontal", x: 0, y: -2.15, z: layoutZ(-1.2), width: 9.2, depth: 5.8 },
  ];
}

export function nativeHomeForHolding(holding: NativeHolding, roomId: string, slot: number) {
  const kind = holding.template.kind;
  if (kind === "photocard") {
    const col = slot % 3;
    const row = Math.floor(slot / 3) % 2;
    return { zoneId: `${roomId}-binder`, surfaceId: `${roomId}-binder`, position: { x: layoutX(0.12) + col * 0.28, y: -0.1, z: layoutZ(-2.48) - row * 0.24 } };
  }
  if (kind === "album" || kind === "vinyl" || kind === "book") {
    const bay = slot % 3;
    const along = Math.floor(slot / 3) % 4;
    return { zoneId: `${roomId}-shelf`, surfaceId: `${roomId}-shelf-bay-${bay}`, position: { x: layoutX(-3.15) - 0.7 + along * 0.48, y: 0, z: layoutZ(-3.48) } };
  }
  if (kind === "poster") {
    return { zoneId: `${roomId}-wall`, surfaceId: `${roomId}-wall`, position: { x: layoutX(0.2) + (slot % 3) * 0.9, y: 0.4 + (Math.floor(slot / 3) % 2) * 0.8, z: ROOM_LAYOUT.backZ + 0.34 } };
  }
  if (kind === "lightstick" || kind === "figure" || kind === "plushie") {
    const upper = slot % 2 === 1;
    const along = Math.floor(slot / 2) % 3;
    return { zoneId: `${roomId}-display-case`, surfaceId: `${roomId}-display-case-${upper ? "top" : "shelf"}`, position: { x: layoutX(3.25) + along * 0.32, y: 0, z: layoutZ(-3.52) } };
  }
  if (kind === "apparel" || (kind === "memorabilia" && /kit/i.test(holding.template.name))) {
    return { zoneId: `${roomId}-archive`, surfaceId: `${roomId}-archive`, position: { x: layoutX(-1.7) + (slot % 3) * 0.45, y: 0, z: layoutZ(-0.4) - (Math.floor(slot / 3) % 2) * 0.35 } };
  }
  if (kind === "memorabilia") {
    const form = representationKindForHolding(holding);
    if (form === "disc-case" || form === "book") {
      const bay = slot % 3;
      const along = Math.floor(slot / 3) % 4;
      return { zoneId: `${roomId}-shelf`, surfaceId: `${roomId}-shelf-bay-${bay}`, position: { x: layoutX(-3.15) - 0.7 + along * 0.48, y: 0, z: layoutZ(-3.48) } };
    }
  }
  return { zoneId: `${roomId}-desk`, surfaceId: `${roomId}-desk`, position: { x: layoutX(0.5) + (slot % 4) * 0.55, y: 0, z: layoutZ(-2.4) - (Math.floor(slot / 4) % 2) * 0.45 } };
}

export function zoneIdForNativeSurface(roomId: string, surfaceId: string) {
  if (surfaceId.startsWith(`${roomId}-shelf-bay-`)) return `${roomId}-shelf`;
  if (surfaceId.startsWith(`${roomId}-display-case-`)) return `${roomId}-display-case`;
  for (const zone of ["binder", "desk", "archive", "wall", "floor"]) {
    if (surfaceId === `${roomId}-${zone}`) return `${roomId}-${zone}`;
  }
  return `${roomId}-floor`;
}

function fallbackPosition(slot: number): NativeRoomVector {
  const column = slot % 4;
  const row = Math.floor(slot / 4);
  return { x: layoutX(0.45) + column * 0.68, y: -0.15, z: layoutZ(-2.9) + row * 0.45 };
}

function roomRenderable(holding: NativeHolding, placement: NativeRoomPlacement | undefined, index: number): RoomRenderable {
  const transform = placement?.transform;
  const fallback = fallbackPosition(index);
  const representation = representationForHolding(holding);
  return {
    holding,
    ...(placement ? { placement } : {}),
    geometry: representation.geometry,
    color: representation.color,
    accent: representation.accent,
    ...(representation.imageUrl ? { imageUrl: representation.imageUrl } : {}),
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

function stringAt(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}
function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
function numberAt(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function degreesToRadians(value: number) {
  return value * Math.PI / 180;
}
function footprintDistance(point: NativeRoomVector, surface: NativeRoomSurface) {
  const outsideX = Math.max(0, Math.abs(point.x - surface.x) - surface.width / 2);
  if (surface.kind === "wall") {
    const outsideY = Math.max(0, Math.abs(point.y - surface.y) - surface.depth / 2);
    return Math.hypot(outsideX, outsideY, Math.abs(point.z - surface.z));
  }
  const outsideZ = Math.max(0, Math.abs(point.z - surface.z) - surface.depth / 2);
  return Math.hypot(outsideX, outsideZ, Math.abs(point.y - surface.y) * 0.25);
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function distanceToRoomLook(position: NativeRoomVector) {
  return Math.hypot(position.x, position.y - 0.4, position.z + 2);
}
