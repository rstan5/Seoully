import { surfaceFitScale, rotatedRepresentationSize } from "./surfaceFit";
import { composeParentYaw } from "./roomWorldTransform";
import type { NativeHolding, NativeRoomPlacement } from "../api";
import { visibleLowerBound, extentsForGeometry, representationForHolding, representationKindForHolding, type NativeRepresentationKind } from "./representation";
import { FLOOR_Y, CONTACT_EPSILON, groundedOrigin } from "./roomGrounding";
import { legacyRoomObjects, applyObjectSurfaces, rotateYaw, surfaceOwner, canonicalSurfaceId, type RoomObjectInstance } from "./roomObjects";
import { BACK_WALL } from "./envelope";
import { layoutX, layoutZ, ROOM_LAYOUT } from "./roomLayout";

export type NativeRoomVector = { x: number; y: number; z: number };
export type NativeRoomSurface = { id: string; kind: "horizontal" | "wall"; x: number; y: number; z: number; width: number; depth: number; clearanceHeight?: number; rotateY?: number; reserved?: { halfX: number; halfZ: number } };
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
  const fallbackSlots = new Map<string, Set<number>>();
  return holdings.filter((holding) => placementByHolding.has(holding.id)).map((holding, index) => {
    const placement = placementByHolding.get(holding.id);
    let slot = placement?.slot ?? index;
    if (placement && !placement.transform) {
      const key = placement.surfaceId ?? placement.zoneId;
      const used = fallbackSlots.get(key) ?? new Set<number>();
      if (used.has(slot)) slot = nextNativeSlot([...used]);
      used.add(slot);
      fallbackSlots.set(key, used);
    }
    return roomRenderable(holding, placement, slot);
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
    const size = extentsForGeometry(renderable.geometry);
    const wall = nativeRoomSurfaces("move").find((surface) => surface.kind === "wall")!;
    return { ...renderable, position: clampToSurface({ ...renderable.position, x: renderable.position.x + dx, y: renderable.position.y - depthOrVertical }, wall, size.x * renderable.scale / 2, size.y * renderable.scale / 2, 0) };
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
  return surface.kind !== "wall";
}

export function isSupportedRoomPlacement(renderable: RoomRenderable, roomId: string, objects?: RoomObjectInstance[]) {
  return nativeRoomSurfaces(roomId, objects).some((surface) =>
    surfaceAcceptsGeometry(surface, renderable.geometry) && footprintDistance(renderable.position, surface) < 1.45,
  );
}

export function settleRoomRenderable(renderable: RoomRenderable, roomId: string, preferredSurfaceId?: string, objects?: RoomObjectInstance[]) {
  const all = nativeRoomSurfaces(roomId, objects);
  const surfaces = all.filter((surface) => surfaceAcceptsGeometry(surface, renderable.geometry));
  const legacyParent = objects && preferredSurfaceId ? surfaceOwner(roomId, objects, preferredSurfaceId) : null;
  const resolvedId = legacyParent && preferredSurfaceId?.startsWith(`${roomId}-`) && !preferredSurfaceId.includes(":")
    ? canonicalSurfaceId(roomId, legacyParent, preferredSurfaceId.slice(roomId.length + 1))
    : preferredSurfaceId;
  const preferred = surfaces.find((candidate) => candidate.id === resolvedId);
  const surface = preferred ?? surfaces
    .map((candidate) => ({ candidate, distance: footprintDistance(renderable.position, candidate) }))
    .sort((a, b) => a.distance - b.distance)[0]?.candidate ?? all.find((item) => item.id.endsWith("-floor")) ?? all[0];
  const localRotation = composeParentYaw(renderable.rotation, -(surface.rotateY ?? 0));
  const fittedScale = surfaceFitScale(renderable.geometry, renderable.scale, localRotation, surface);
  const fittedSize = rotatedRepresentationSize(renderable.geometry, localRotation);
  const lowerBound = visibleLowerBound(renderable.geometry, fittedScale, renderable.rotation);
  return {
    renderable: {
      ...renderable,
      position: surface.kind === "wall"
        ? clampToSurface(renderable.position, surface, extentsForGeometry(renderable.geometry).x * renderable.scale / 2, extentsForGeometry(renderable.geometry).y * renderable.scale / 2, 0)
        : clampToSurface({ ...renderable.position, y: groundedOrigin(surface.y, lowerBound, CONTACT_EPSILON) }, surface, fittedSize.x * fittedScale / 2, 0, fittedSize.z * fittedScale / 2),
    },
    surfaceId: surface.id,
  };
}

export function nativeRoomSurfaces(roomId: string, objects?: RoomObjectInstance[]): NativeRoomSurface[] {
  const defaults: NativeRoomSurface[] = [
    { id: `${roomId}-shelf-bay-0`, kind: "horizontal", x: layoutX(-3.15), y: -1.4, z: layoutZ(-3.48), width: 2.1, depth: 0.8 },
    { id: `${roomId}-shelf-bay-1`, kind: "horizontal", x: layoutX(-3.15), y: -0.5, z: layoutZ(-3.48), width: 2.1, depth: 0.8 },
    { id: `${roomId}-shelf-bay-2`, kind: "horizontal", x: layoutX(-3.15), y: 0.4, z: layoutZ(-3.48), width: 2.1, depth: 0.8 },
    { id: `${roomId}-desk`, kind: "horizontal", x: layoutX(1.45), y: -0.72, z: layoutZ(-2.85), width: 3.25, depth: 1.65 },
    { id: `${roomId}-binder`, kind: "horizontal", x: layoutX(0.45), y: -0.68, z: layoutZ(-2.7), width: 0.95, depth: 0.72 },
    { id: `${roomId}-display-case-shelf`, kind: "horizontal", x: layoutX(3.65), y: -0.5, z: layoutZ(-3.52), width: 1.45, depth: 0.72 },
    { id: `${roomId}-display-case-top`, kind: "horizontal", x: layoutX(3.65), y: 0.48, z: layoutZ(-3.52), width: 1.45, depth: 0.72 },
    { id: `${roomId}-archive`, kind: "horizontal", x: layoutX(-1.2), y: -1.68, z: layoutZ(-0.65), width: 1.7, depth: 1.05 },
    { id: `${roomId}-wall`, kind: "wall", x: (BACK_WALL.minX + BACK_WALL.maxX) / 2, y: (BACK_WALL.minY + BACK_WALL.maxY) / 2, z: BACK_WALL.z, width: BACK_WALL.maxX - BACK_WALL.minX, depth: BACK_WALL.maxY - BACK_WALL.minY },
    { id: `${roomId}-floor`, kind: "horizontal", x: 0, y: FLOOR_Y, z: (ROOM_LAYOUT.backZ + 1.65) / 2, width: ROOM_LAYOUT.wallX * 2 - 0.32, depth: 1.65 - ROOM_LAYOUT.backZ },
  ];
  return applyObjectSurfaces(roomId, defaults, objects ?? legacyRoomObjects());
}

export function nativeHomeForHolding(holding: NativeHolding, roomId: string, slot: number) {
  const kind = holding.template.kind;
  const form = representationKindForHolding(holding);
  if (kind === "photocard") {
    const col = slot % 3;
    const row = Math.floor(slot / 3) % 2;
    const surfaceId = `${roomId}-binder`;
    return {
      zoneId: `${roomId}-binder`,
      surfaceId,
      position: restOnAuthoredSurface(roomId, surfaceId, { x: layoutX(0.12) + col * 0.28, y: 0, z: layoutZ(-2.48) - row * 0.24 }, form),
    };
  }
  if (kind === "album" || kind === "vinyl" || kind === "book") {
    const bay = slot % 3;
    const along = Math.floor(slot / 3) % 4;
    const surfaceId = `${roomId}-shelf-bay-${bay}`;
    return {
      zoneId: `${roomId}-shelf`,
      surfaceId,
      position: restOnAuthoredSurface(roomId, surfaceId, { x: layoutX(-3.15) - 0.7 + along * 0.48, y: 0, z: layoutZ(-3.48) }, form),
    };
  }
  if (kind === "poster") {
    const surfaceId = `${roomId}-wall`;
    return {
      zoneId: `${roomId}-wall`,
      surfaceId,
      position: restOnAuthoredSurface(roomId, surfaceId, { x: layoutX(0.2) + (slot % 3) * 0.9, y: 0.4 + (Math.floor(slot / 3) % 2) * 0.8, z: ROOM_LAYOUT.backZ + 0.34 }, form),
    };
  }
  if (kind === "lightstick" || kind === "figure" || kind === "plushie") {
    const upper = slot % 2 === 1;
    const along = Math.floor(slot / 2) % 3;
    const surfaceId = `${roomId}-display-case-${upper ? "top" : "shelf"}`;
    return {
      zoneId: `${roomId}-display-case`,
      surfaceId,
      position: restOnAuthoredSurface(roomId, surfaceId, { x: layoutX(3.25) + along * 0.32, y: 0, z: layoutZ(-3.52) }, form),
    };
  }
  if (kind === "apparel" || (kind === "memorabilia" && /kit/i.test(holding.template.name))) {
    const surfaceId = `${roomId}-archive`;
    return {
      zoneId: `${roomId}-archive`,
      surfaceId,
      position: restOnAuthoredSurface(roomId, surfaceId, { x: layoutX(-1.7) + (slot % 3) * 0.45, y: 0, z: layoutZ(-0.4) - (Math.floor(slot / 3) % 2) * 0.35 }, form),
    };
  }
  if (kind === "memorabilia" && (form === "disc-case" || form === "book")) {
    const bay = slot % 3;
    const along = Math.floor(slot / 3) % 4;
    const surfaceId = `${roomId}-shelf-bay-${bay}`;
    return {
      zoneId: `${roomId}-shelf`,
      surfaceId,
      position: restOnAuthoredSurface(roomId, surfaceId, { x: layoutX(-3.15) - 0.7 + along * 0.48, y: 0, z: layoutZ(-3.48) }, form),
    };
  }
  const surfaceId = `${roomId}-desk`;
  return {
    zoneId: `${roomId}-desk`,
    surfaceId,
    position: restOnAuthoredSurface(roomId, surfaceId, {
      x: layoutX(1.65) + (slot % 2) * 0.86,
      y: 0,
      z: layoutZ(-2.55) - (Math.floor(slot / 2) % 3) * 0.4,
    }, form),
  };
}

export function zoneIdForNativeSurface(roomId: string, surfaceId: string) {
  if (surfaceId.startsWith(`${roomId}-shelf-bay-`) || surfaceId.startsWith(`${roomId}-shelf:`)) return `${roomId}-shelf`;
  if (surfaceId.startsWith(`${roomId}-display-case-`) || surfaceId.startsWith(`${roomId}-case:`)) return `${roomId}-display-case`;
  for (const zone of ["binder", "desk", "archive", "wall", "floor"]) {
    if (surfaceId === `${roomId}-${zone}` || surfaceId.startsWith(`${roomId}-${zone}:`)) return `${roomId}-${zone}`;
  }
  return `${roomId}-floor`;
}

function fallbackPosition(slot: number, geometry: NativeRepresentationKind): NativeRoomVector {
  const column = slot % 3;
  const row = Math.floor(slot / 3) % 3;
  return restOnAuthoredSurface("room", "room-desk", {
    x: layoutX(1.85) + column * 0.52,
    y: 0,
    z: layoutZ(-2.55) - row * 0.4,
  }, geometry);
}

function restOnAuthoredSurface(
  roomId: string,
  surfaceId: string,
  position: NativeRoomVector,
  geometry: NativeRepresentationKind,
): NativeRoomVector {
  const surface = nativeRoomSurfaces(roomId).find((item) => item.id === surfaceId);
  const halfHeight = -visibleLowerBound(geometry, 1, { x: 0, y: 0, z: 0 });
  const lowerBound = -halfHeight;
  if (!surface) return { ...position, y: -0.72 + halfHeight };
  if (surface.kind === "wall") {
    const size = extentsForGeometry(geometry);
    return clampToSurface(position, surface, size.x / 2, size.y / 2, 0);
  }
  const size = extentsForGeometry(geometry);
  const padX = size.x / 2 + 0.015;
  const padZ = size.z / 2 + 0.015;
  return {
    x: clamp(position.x, surface.x - surface.width / 2 + padX, surface.x + surface.width / 2 - padX),
    y: groundedOrigin(surface.y, lowerBound, CONTACT_EPSILON),
    z: clamp(position.z, surface.z - surface.depth / 2 + padZ, surface.z + surface.depth / 2 - padZ),
  };
}

/** Only transform-less placements use these authored fallback slots. Saved user transforms are never packed. */
function fallbackOnSurface(surface: NativeRoomSurface, slot: number, geometry: NativeRepresentationKind): NativeRoomVector {
  const size = extentsForGeometry(geometry);
  if (surface.kind === "wall") {
    const columns = Math.max(1, Math.floor(surface.width / (size.x + 0.08)));
    return { x: surface.x - surface.width / 2 + size.x / 2 + (slot % columns) * (size.x + 0.08), y: surface.y + Math.floor(slot / columns) * (size.y + 0.08), z: surface.z + 0.06 };
  }
  // Reserve the left side of Desk for the Binder's physical home.
  const desk = surface.id.endsWith("-desk");
  const width = desk ? surface.width / 2 : surface.width;
  const left = desk ? surface.x : surface.x - width / 2;
  const columns = Math.max(1, Math.floor(width / (size.x + 0.06)));
  const rows = Math.max(1, Math.floor(surface.depth / (size.z + 0.06)));
  const layer = Math.floor(slot / (columns * rows));
  return {
    x: left + size.x / 2 + 0.015 + (slot % columns) * (size.x + 0.06),
    y: surface.y + size.y / 2 + layer * (size.y + 0.02),
    z: surface.z - surface.depth / 2 + size.z / 2 + 0.015 + (Math.floor(slot / columns) % rows) * (size.z + 0.06),
  };
}

function roomRenderable(holding: NativeHolding, placement: NativeRoomPlacement | undefined, index: number): RoomRenderable {
  const transform = placement?.transform;
  const representation = representationForHolding(holding);
  const home = placement ? nativeHomeForHolding(holding, placement.roomId, index) : null;
  const surfaceId = placement?.surfaceId ?? home?.surfaceId;
  const surface = placement && nativeRoomSurfaces(placement.roomId).find((entry) => entry.id === surfaceId);
  const fallback = surface && placement
    ? fallbackOnSurface(surface, index, representation.geometry)
    : fallbackPosition(index, representation.geometry);
  return {
    holding,
    ...(placement ? { placement: !transform && !placement.surfaceId ? { ...placement, surfaceId: surfaceId ?? null } : placement } : {}),
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
  const local = surfaceLocalPoint(point, surface);
  const outsideX = Math.max(0, Math.abs(local.x) - surface.width / 2);
  if (surface.kind === "wall") {
    const outsideY = Math.max(0, Math.abs(point.y - surface.y) - surface.depth / 2);
    return Math.hypot(outsideX, outsideY, Math.abs(point.z - surface.z));
  }
  const outsideZ = Math.max(0, Math.abs(local.z) - surface.depth / 2);
  return Math.hypot(outsideX, outsideZ, Math.abs(point.y - surface.y) * 0.25);
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function distanceToRoomLook(position: NativeRoomVector) {
  return Math.hypot(position.x, position.y - 0.4, position.z + 2);
}

/** Oriented physical landing rectangle, shared by projection and clamping. */
export function surfaceLocalPoint(point: NativeRoomVector, surface: NativeRoomSurface) {
  return rotateYaw({ x: point.x - surface.x, y: point.y - surface.y, z: point.z - surface.z }, -(surface.rotateY ?? 0));
}
export function surfaceWorldPoint(local: NativeRoomVector, surface: NativeRoomSurface) {
  const offset = rotateYaw(local, surface.rotateY ?? 0);
  return { x: surface.x + offset.x, y: surface.y + offset.y, z: surface.z + offset.z };
}
export function clampToSurface(point: NativeRoomVector, surface: NativeRoomSurface, halfX: number, halfY: number, halfZ: number): NativeRoomVector {
  if (surface.kind === "wall") return {
    x: clamp(point.x, surface.x - surface.width / 2 + halfX, surface.x + surface.width / 2 - halfX),
    y: clamp(point.y, surface.y - surface.depth / 2 + halfY, surface.y + surface.depth / 2 - halfY),
    z: surface.z + 0.06,
  };
  const local = surfaceLocalPoint(point, surface);
  const padX = Math.min(halfX, surface.width / 2 - 0.02), padZ = Math.min(halfZ, surface.depth / 2 - 0.02);
  let x = clamp(local.x, -surface.width / 2 + padX, surface.width / 2 - padX);
  const z = clamp(local.z, -surface.depth / 2 + padZ, surface.depth / 2 - padZ);
  if (surface.reserved && Math.abs(x) < surface.reserved.halfX + padX && Math.abs(z) < surface.reserved.halfZ + padZ) x = (x < 0 ? -1 : 1) * Math.min(surface.width/2-padX, surface.reserved.halfX+padX+0.002);
  return surfaceWorldPoint({ ...local, x, z }, surface);
}
