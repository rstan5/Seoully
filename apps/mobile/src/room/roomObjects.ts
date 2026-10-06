import { DESK_BINDER_AT } from "./camera";
import { BACK_WALL, ROOM_BOX } from "./envelope";
import { layoutX, layoutZ } from "./roomLayout";
import type { NativeRoomSurface, NativeRoomVector } from "./model";

/** Basic V1 Room Shop catalog — one canonical version of each object. */
import { ROOM_OBJECT_KINDS, validPhotoStringConfig, type PhotoStringConfig, type RoomObjectKind, type RoomYaw, ROOM_TURN_DEGREES, normalizeRoomYaw } from "seoully-domain/room-object-schema";
import { furnitureGroundY, DESK_TABLETOP_TOP, CHAIR_SEAT_TOP, SHELF_ROOF_TOP, CASE_ROOF_TOP } from "./roomGrounding";
export { ROOM_OBJECT_KINDS } from "seoully-domain/room-object-schema";
export type { RoomObjectKind } from "seoully-domain/room-object-schema";
export function isWallObject(kind: RoomObjectKind) { return kind === "wall-frame" || kind === "photo-string"; }

export type RoomObjectInstance = {
  id: string;
  kind: RoomObjectKind;
  x: number;
  y: number;
  z: number;
  rotateY: RoomYaw;
  photoString?: PhotoStringConfig;
};

export type RoomLayoutSource = "legacy" | "authored";

export type RoomLayoutState = {
  source: RoomLayoutSource;
  objects: RoomObjectInstance[];
  firstRoomEditCompleted: boolean;
};

export type RoomLayoutDocument = {
  version: 1;
  objects: RoomObjectInstance[];
  firstRoomEditCompleted: boolean;
};

/** Shop definitions are reusable; identity belongs to each placed instance. */
export const UNIQUE_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>();
export const MULTI_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>(ROOM_OBJECT_KINDS);

/** Every floor-bound Shop object uses the existing authored 30° interaction. */
export const TURNABLE_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>(ROOM_OBJECT_KINDS.filter((kind) => !isWallObject(kind)));

export const CARRIER_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>(["shelf", "desk", "case", "chair", "archive"]);

export const SHOP_CATALOG: readonly RoomObjectKind[] = [
  "shelf",
  "desk",
  "chair",
  "case",
  "rug",
  "lamp",
  "plant",
  "archive",
  "wall-frame",
  "photo-string",
];

export const ROOM_OBJECT_DEFAULTS: Record<RoomObjectKind, NativeRoomVector> = {
  shelf: { x: Math.max(layoutX(-3.15), -ROOM_BOX.wallX + 1.12 + 0.16), y: furnitureGroundY("shelf"), z: layoutZ(-3.78) },
  desk: { x: layoutX(1.45), y: furnitureGroundY("desk"), z: layoutZ(-2.85) },
  case: { x: Math.min(layoutX(3.65), ROOM_BOX.wallX - 0.78 - 0.16), y: furnitureGroundY("case"), z: layoutZ(-3.78) },
  lamp: { x: layoutX(-3.72), y: furnitureGroundY("lamp"), z: layoutZ(-0.58) },
  plant: { x: layoutX(3.42), y: furnitureGroundY("plant"), z: layoutZ(-1.62) },
  rug: { x: layoutX(0.22), y: furnitureGroundY("rug"), z: layoutZ(-1.15) },
  archive: { x: layoutX(-1.2), y: furnitureGroundY("archive"), z: layoutZ(-0.65) },
  chair: { x: layoutX(0.4), y: furnitureGroundY("chair"), z: layoutZ(-0.6) },
  "photo-string": { x: 0, y: 1.25, z: ROOM_BOX.backZ + 0.12 },
  "wall-frame": { x: layoutX(1.55), y: 0.88, z: ROOM_BOX.backZ + 0.12 },
};

const FOOTPRINT: Record<RoomObjectKind, { halfX: number; halfZ: number; halfY?: number; lowerY?: number; upperY?: number }> = {
  shelf: { halfX: 1.12, halfZ: 0.44 },
  desk: { halfX: 1.68, halfZ: 0.88 },
  case: { halfX: 0.78, halfZ: 0.46 },
  lamp: { halfX: 0.28, halfZ: 0.28 },
  plant: { halfX: 0.26, halfZ: 0.22 },
  rug: { halfX: 1.18, halfZ: 0.76 },
  archive: { halfX: 0.92, halfZ: 0.62 },
  chair: { halfX: 0.76, halfZ: 0.70 },
  "photo-string": { halfX: 1.38, halfY: 0.5, halfZ: 0.04, lowerY: -0.68, upperY: 0.035 },
  "wall-frame": { halfX: 0.66, halfY: 0.76, halfZ: 0.04 },
};

type SurfaceLocal = {
  suffix: string;
  kind: NativeRoomSurface["kind"];
  lx: number;
  ly: number;
  lz: number;
  width: number;
  depth: number;
};

const SURFACE_LOCAL: Record<"shelf" | "desk" | "case" | "chair" | "archive", SurfaceLocal[]> = {
  shelf: [
    { suffix: "shelf-bay-0", kind: "horizontal", lx: 0, ly: -0.88, lz: 0.12, width: 2.04, depth: 0.62 },
    { suffix: "shelf-bay-1", kind: "horizontal", lx: 0, ly: 0.02, lz: 0.12, width: 2.04, depth: 0.62 },
    { suffix: "shelf-bay-3", kind: "horizontal", lx: 0, ly: SHELF_ROOF_TOP, lz: 0.08, width: 2.04, depth: 0.62 },
    { suffix: "shelf-bay-2", kind: "horizontal", lx: 0, ly: 0.92, lz: 0.12, width: 2.04, depth: 0.62 },
  ],
  chair: [{ suffix: "chair-seat", kind: "horizontal", lx: 0, ly: CHAIR_SEAT_TOP, lz: 0.06, width: 0.84, depth: 0.76 }],
  desk: [
    { suffix: "desk", kind: "horizontal", lx: 0, ly: DESK_TABLETOP_TOP, lz: 0, width: 3.25, depth: 1.65 },
    { suffix: "binder", kind: "horizontal", lx: layoutX(-1), ly: DESK_TABLETOP_TOP, lz: layoutZ(0.15), width: 0.95, depth: 0.72 },
  ],
  case: [
    { suffix: "display-case-shelf", kind: "horizontal", lx: 0, ly: 0.0175, lz: 0.16, width: 1.36, depth: 0.56 },
    { suffix: "display-case-lower", kind: "horizontal", lx: 0, ly: -0.9125, lz: 0.16, width: 1.36, depth: 0.56 },
    { suffix: "display-case-crown", kind: "horizontal", lx: 0, ly: CASE_ROOF_TOP, lz: 0.14, width: 1.36, depth: 0.56 },
    { suffix: "display-case-top", kind: "horizontal", lx: 0, ly: 0.9975, lz: 0.16, width: 1.36, depth: 0.56 },
  ],
  archive: [
    { suffix: "archive", kind: "horizontal", lx: 0, ly: 0.365, lz: 0.03, width: 1.64, depth: 1.04 },
  ],
};

export function defaultRoomObject(kind: RoomObjectKind, id: string = kind): RoomObjectInstance {
  const at = ROOM_OBJECT_DEFAULTS[kind];
  return clampRoomObject({ id, kind, x: at.x, y: at.y, z: at.z, rotateY: 0, ...(kind === "photo-string" ? { photoString: { slots: Array(5).fill(null) } } : {}) });
}

export function legacyRoomObjects(): RoomObjectInstance[] {
  return ROOM_OBJECT_KINDS.filter((kind) => kind !== "chair" && kind !== "photo-string").map((kind) => kind === "archive" ? spawnRoomObject([], kind, kind) : defaultRoomObject(kind));
}

export function starterRoomObjects(): RoomObjectInstance[] {
  return [defaultRoomObject("shelf"), defaultRoomObject("lamp")];
}

export function starterRoomLayout(): RoomLayoutState {
  return { source: "authored", objects: starterRoomObjects(), firstRoomEditCompleted: false };
}

export function legacyRoomLayout(): RoomLayoutState {
  return { source: "legacy", objects: legacyRoomObjects(), firstRoomEditCompleted: true };
}

export function emptyLayoutMeansLegacy(value: unknown) {
  if (value == null) return true;
  if (typeof value !== "object" || Array.isArray(value)) return true;
  return Object.keys(value as object).length === 0;
}

export function parseRoomLayout(value: unknown): RoomLayoutState {
  if (emptyLayoutMeansLegacy(value)) return legacyRoomLayout();
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || !Array.isArray(raw.objects)) return legacyRoomLayout();
  const objects: RoomObjectInstance[] = [];
  const seen = new Set<string>();
  for (const entry of raw.objects) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const kind = row.kind;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!isRoomObjectKind(kind) || !id || seen.has(id)) continue;
    if (row.photoString !== undefined && (kind !== "photo-string" || !validPhotoStringConfig(row.photoString))) throw new Error("photo_string_invalid");
    seen.add(id);
    objects.push(clampRoomObject({
      id,
      kind,
      x: finite(row.x, ROOM_OBJECT_DEFAULTS[kind].x),
      y: finite(row.y, ROOM_OBJECT_DEFAULTS[kind].y),
      z: finite(row.z, ROOM_OBJECT_DEFAULTS[kind].z),
      rotateY: normalizeRoomYaw(row.rotateY),
      ...(row.photoString ? { photoString: { slots: [...(row.photoString as PhotoStringConfig).slots] } } : {}),
    }));
  }
  if (!objects.length && raw.objects.length) return legacyRoomLayout();
  return {
    source: "authored",
    objects,
    firstRoomEditCompleted: raw.firstRoomEditCompleted === true,
  };
}

export function serializeRoomLayout(state: RoomLayoutState): RoomLayoutDocument | Record<string, never> {
  if (state.source === "legacy" && state.firstRoomEditCompleted && objectsMatchDefaults(state.objects, legacyRoomObjects())) {
    return {};
  }
  if (new Set(state.objects.map((object) => object.id)).size !== state.objects.length || state.objects.some((object) => !object.id.trim() || object.id !== object.id.trim() || object.id.length > 80 || normalizeRoomYaw(object.rotateY) !== object.rotateY)) throw new Error("room_object_invalid");
  if (state.objects.some((object) => object.photoString && (object.kind !== "photo-string" || !validPhotoStringConfig(object.photoString)))) throw new Error("photo_string_invalid");
  return {
    version: 1,
    objects: state.objects.map(cloneRoomObject),
    firstRoomEditCompleted: state.firstRoomEditCompleted,
  };
}

export function shouldAutoEnterFirstRoomEdit(state: RoomLayoutState, readOnly: boolean) {
  return !readOnly && state.source === "authored" && !state.firstRoomEditCompleted;
}

export function markFirstRoomEditComplete(state: RoomLayoutState): RoomLayoutState {
  return { ...state, source: "authored", firstRoomEditCompleted: true, objects: state.objects.map(cloneRoomObject) };
}

export function cloneRoomObjects(objects: RoomObjectInstance[]) {
  return objects.map(cloneRoomObject);
}

export function cloneRoomObject(object: RoomObjectInstance): RoomObjectInstance {
  return { ...object, ...(object.photoString ? { photoString: { slots: [...object.photoString.slots] } } : {}) };
}

export function objectsMatchDefaults(objects: RoomObjectInstance[], expected: RoomObjectInstance[]) {
  if (objects.length !== expected.length) return false;
  return expected.every((item) => {
    const found = objects.find((candidate) => candidate.id === item.id && candidate.kind === item.kind);
    return found
      && Math.abs(found.x - item.x) < 0.02
      && Math.abs(found.y - item.y) < 0.02
      && Math.abs(found.z - item.z) < 0.02
      && found.rotateY === item.rotateY;
  });
}

export function isRoomObjectKind(value: unknown): value is RoomObjectKind {
  return typeof value === "string" && (ROOM_OBJECT_KINDS as readonly string[]).includes(value);
}

export function furnitureDelta(object: RoomObjectInstance): NativeRoomVector {
  const origin = defaultRoomObject(object.kind);
  return { x: object.x - origin.x, y: object.y - origin.y, z: object.z - origin.z };
}

export function objectHasKind(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  return objects.some((item) => item.kind === kind);
}

export function objectByKind(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  return objects.find((item) => item.kind === kind) ?? null;
}

export function canAddRoomObject(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  return isRoomObjectKind(kind);
}

let instanceSequence = 0;
export function nextRoomObjectId(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  let id: string;
  do {
    instanceSequence += 1;
    id = `${kind}@${Date.now().toString(36)}-${instanceSequence.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  } while (objects.some((object) => object.id === id));
  return id;
}

export function spawnRoomObject(objects: RoomObjectInstance[], kind: RoomObjectKind, id = nextRoomObjectId(objects, kind)): RoomObjectInstance {
  const drafted = defaultRoomObject(kind, id);
  const candidates = isWallObject(kind)
    ? [{ ...drafted, x: 0, y: 1.25 }, ...[0.2, 0.5, 0.8].flatMap((height) => [-0.7, 0, 0.7].map((width) => ({ ...drafted, x: width * (BACK_WALL.maxX - BACK_WALL.minX) / 2, y: BACK_WALL.minY + height * (BACK_WALL.maxY - BACK_WALL.minY) })))]
    : [drafted, ...[-0.8, 0.1, 0.9, -1.6, -2.5].flatMap((z) => [-1.8, 0, 1.8].map((x) => ({ ...drafted, x, z })))];
  const available = candidates.map(clampRoomObject);
  const safe = available.find((candidate) => objects.every((other) => {
    if (isWallObject(kind) !== isWallObject(other.kind) || other.kind === "rug" || kind === "rug") return true;
    const a = rotatedRoomObjectFootprint(candidate), b = rotatedRoomObjectFootprint(other);
    return Math.abs(candidate.x - other.x) >= a.halfX + b.halfX + 0.08
      || (isWallObject(kind) ? Math.abs(candidate.y - other.y) >= (a.halfY ?? 0) + (b.halfY ?? 0) + 0.08
        : Math.abs(candidate.z - other.z) >= a.halfZ + b.halfZ + 0.08);
  }));
  if (safe && !objects.some((other) => other.kind === kind && Math.hypot(other.x - safe.x, other.y - safe.y, other.z - safe.z) < 0.05)) return safe;
  // A crowded room may require overlap, but choose the least occupied visible
  // starter position rather than repeatedly piling copies on one coordinate.
  const crowding = (candidate: RoomObjectInstance) => objects.reduce((score, other) => {
    if (isWallObject(kind) !== isWallObject(other.kind)) return score;
    const a = rotatedRoomObjectFootprint(candidate), b = rotatedRoomObjectFootprint(other);
    const overlapX = Math.max(0, a.halfX + b.halfX + 0.08 - Math.abs(candidate.x - other.x));
    const overlapOther = Math.max(0, (isWallObject(kind) ? (a.halfY ?? 0) + (b.halfY ?? 0) : a.halfZ + b.halfZ) + 0.08 - Math.abs(isWallObject(kind) ? candidate.y - other.y : candidate.z - other.z));
    return score + overlapX * overlapOther + (Math.hypot(candidate.x - other.x, candidate.y - other.y, candidate.z - other.z) < 0.05 ? 100 : 0);
  }, 0);
  return available.reduce((best, candidate) => crowding(candidate) < crowding(best) ? candidate : best);
}

export function replaceRoomObject(objects: RoomObjectInstance[], next: RoomObjectInstance) {
  return objects.map((item) => item.id === next.id ? cloneRoomObject(next) : item);
}

export function removeRoomObject(objects: RoomObjectInstance[], objectId: string) {
  return objects.filter((item) => item.id !== objectId);
}

export function turnRoomObject(object: RoomObjectInstance): RoomObjectInstance {
  if (!TURNABLE_ROOM_OBJECT_KINDS.has(object.kind)) return object;
  const rotateY = ((object.rotateY + ROOM_TURN_DEGREES) % 360) as RoomObjectInstance["rotateY"];
  return clampRoomObject({ ...object, rotateY });
}

export function clampRoomObject(object: RoomObjectInstance): RoomObjectInstance {
  if (isWallObject(object.kind)) {
    const foot = FOOTPRINT[object.kind];
    const lowerY = foot.lowerY ?? -(foot.halfY ?? 0);
    const upperY = foot.upperY ?? (foot.halfY ?? 0);
    return {
      ...object,
      x: clamp(object.x, BACK_WALL.minX + foot.halfX, BACK_WALL.maxX - foot.halfX),
      y: clamp(object.y, BACK_WALL.minY - lowerY, BACK_WALL.maxY - upperY),
      z: BACK_WALL.z,
      rotateY: 0,
    };
  }
  const foot = rotatedRoomObjectFootprint(object);
  const maxX = ROOM_BOX.wallX - foot.halfX - 0.16;
  const minZ = ROOM_BOX.backZ + foot.halfZ + 0.22;
  return {
    ...object,
    x: clamp(object.x, -maxX, maxX),
    y: furnitureGroundY(object.kind),
    z: clamp(object.z, minZ, 1.65 - foot.halfZ),
  };
}

export function roomObjectInBounds(object: RoomObjectInstance) {
  const clamped = clampRoomObject(object);
  return Math.abs(clamped.x - object.x) < 0.08
    && Math.abs(clamped.z - object.z) < 0.08
    && Math.abs(clamped.y - object.y) < 0.08;
}

export function deskBinderWorld(objects: RoomObjectInstance[], instanceId?: string | null): NativeRoomVector | null {
  const desk = instanceId ? objects.find((object) => object.id === instanceId && object.kind === "desk") : objectByKind(objects, "desk");
  if (!desk) return null;
  return objectPointFromAuthored(DESK_BINDER_AT, desk);
}

/** Live Desk drag preview — same rest as `deskBinderWorld` once the preview matches the stored Desk. */
export function liveDeskBinderWorld(
  objects: RoomObjectInstance[],
  preview?: RoomObjectInstance | null,
  instanceId?: string | null,
): NativeRoomVector | null {
  return deskBinderWorld(preview?.kind === "desk" ? objects.map((object) => object.id === preview.id ? preview : object) : objects, instanceId);
}

export function storageTakeoutFor(objects: RoomObjectInstance[], instanceId?: string | null): NativeRoomVector {
  const archive = instanceId ? objects.find((object) => object.id === instanceId && object.kind === "archive") : objectByKind(objects, "archive");
  if (!archive) return { x: layoutX(-1.2), y: -1.12, z: layoutZ(-0.65) };
  return { x: archive.x, y: archive.y + 0.74, z: archive.z };
}

export function canonicalSurfaceId(roomId: string, object: RoomObjectInstance, suffix: string) {
  return surfaceIdFor(roomId, object, suffix);
}

export function surfacesOwnedBy(roomId: string, object: RoomObjectInstance): string[] {
  if (!CARRIER_ROOM_OBJECT_KINDS.has(object.kind)) return [];
  const locals = SURFACE_LOCAL[object.kind as keyof typeof SURFACE_LOCAL] ?? [];
  return locals.map((local) => surfaceIdFor(roomId, object, local.suffix));
}

export function objectOwnsSurface(roomId: string, object: RoomObjectInstance, surfaceId?: string | null) {
  if (!surfaceId) return false;
  return surfacesOwnedBy(roomId, object).includes(surfaceId);
}

export function translateChildren<T extends { position: NativeRoomVector; placement?: { surfaceId?: string | null } }>(
  items: T[],
  roomId: string,
  object: RoomObjectInstance,
  delta: NativeRoomVector,
): T[] {
  if (!CARRIER_ROOM_OBJECT_KINDS.has(object.kind)) return items;
  const owned = new Set(surfacesOwnedBy(roomId, object));
  return items.map((item) => {
    const surfaceId = item.placement?.surfaceId;
    if (!surfaceId || !owned.has(surfaceId)) return item;
    return {
      ...item,
      position: {
        x: item.position.x + delta.x,
        y: item.position.y + delta.y,
        z: item.position.z + delta.z,
      },
    };
  });
}

export function childrenOnObject<T extends { placement?: { surfaceId?: string | null } }>(
  items: T[],
  roomId: string,
  object: RoomObjectInstance,
) {
  const owned = new Set(surfacesOwnedBy(roomId, object));
  return items.filter((item) => item.placement?.surfaceId && owned.has(item.placement.surfaceId));
}

export function applyObjectSurfaces(roomId: string, defaults: NativeRoomSurface[], objects: RoomObjectInstance[]): NativeRoomSurface[] {

  const next: NativeRoomSurface[] = defaults.filter((surface) => surface.id.endsWith("-wall") || surface.id.endsWith("-floor"));
  for (const object of objects) {
    if (!CARRIER_ROOM_OBJECT_KINDS.has(object.kind)) continue;
    for (const local of SURFACE_LOCAL[object.kind as keyof typeof SURFACE_LOCAL]) {
      const id = surfaceIdFor(roomId, object, local.suffix);

      next.push({
        id,
        kind: local.kind,
        ...offsetFromObject(object, { x: local.lx, y: local.ly, z: local.lz }),
        rotateY: object.rotateY,
        width: local.width,
        depth: local.depth,
      });
    }
  }
  return next;
}

export function zoneHotspotFor(kind: "shelf" | "case" | "desk" | "binder" | "archive", objects: RoomObjectInstance[], instanceId?: string) {
  if (kind === "binder") {
    const at = deskBinderWorld(objects);
    return at ? { position: [at.x, at.y + 0.17, at.z] as [number, number, number], size: [1.05, 0.9, 0.7] as [number, number, number], rotateY: liveDeskBinderYaw(objects) } : null;
  }
  const object = instanceId ? objects.find((object) => object.id === instanceId && object.kind === kind) : objectByKind(objects, kind);
  if (!object) return null;
  const size: Record<"shelf" | "case" | "desk" | "archive", [number, number, number]> = {
    shelf: [2.4, 3.2, 0.9],
    case: [1.7, 3.2, 0.8],
    desk: [3.3, 1.1, 1.7],
    archive: [1.9, 0.8, 1.2],
  };
  const lift = kind === "archive" ? 0.31 : kind === "desk" ? 0.27 : 0.35;
  const zNudge = kind === "shelf" || kind === "case" ? 0.23 : 0;
  const at = offsetFromObject(object, { x: 0, y: lift, z: zNudge });
  return { position: [at.x, at.y, at.z] as [number, number, number], size: size[kind], rotateY: object.rotateY };
}

export function shopHasNoCommerce() {
  return true;
}

function surfaceIdFor(roomId: string, object: RoomObjectInstance, suffix: string) {
  if (object.id === object.kind) return `${roomId}-${suffix}`;
  if (object.kind === "shelf") return `${roomId}-shelf:${object.id}-${suffix.replace("shelf-", "")}`;
  return `${roomId}-${object.kind}:${object.id}-${suffix}`;
}
/** Legacy unscoped placements resolve to the exact default instance first, then an old custom instance. New scoped IDs never fall back by kind. */
export function surfaceOwner(roomId: string, objects: RoomObjectInstance[], surfaceId?: string | null) {
  if (!surfaceId) return null;
  const exact = objects.find((object) => objectOwnsSurface(roomId, object, surfaceId));
  if (exact || surfaceId.includes(":")) return exact ?? null;
  return objects.find((object) => !object.id.includes("@") && (SURFACE_LOCAL[object.kind as keyof typeof SURFACE_LOCAL] ?? []).some((local) => `${roomId}-${local.suffix}` === surfaceId)) ?? null;
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}



function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function objectSurfaceTop(roomId: string, objects: RoomObjectInstance[], surfaceId: string) {
  const object = surfaceOwner(roomId, objects, surfaceId);
  const local = object && (SURFACE_LOCAL[object.kind as keyof typeof SURFACE_LOCAL] ?? []).find((surface) => surfaceIdFor(roomId, object, surface.suffix) === surfaceId || `${roomId}-${surface.suffix}` === surfaceId);
  return object && local ? object.y + local.ly : undefined;
}

/** Three-compatible positive Y rotation; shared by children, surfaces, docks and Binder. */
export function rotateYaw(point: NativeRoomVector, degrees: number): NativeRoomVector {
  const angle = degrees * Math.PI / 180;
  const cos = Math.round(Math.cos(angle) * 1e12) / 1e12;
  const sin = Math.round(Math.sin(angle) * 1e12) / 1e12;
  return { x: cos * point.x + sin * point.z, y: point.y, z: -sin * point.x + cos * point.z };
}
export function offsetFromObject(object: RoomObjectInstance, local: NativeRoomVector): NativeRoomVector {
  const rotated = rotateYaw(local, object.rotateY);
  return { x: object.x + rotated.x, y: object.y + rotated.y, z: object.z + rotated.z };
}
export function objectPointFromAuthored(point: NativeRoomVector, object: RoomObjectInstance): NativeRoomVector {
  const origin = defaultRoomObject(object.kind);
  return offsetFromObject(object, { x: point.x - origin.x, y: point.y - origin.y, z: point.z - origin.z });
}
export function objectPointToAuthored(point: NativeRoomVector, object: RoomObjectInstance): NativeRoomVector {
  const origin = defaultRoomObject(object.kind);
  const local = rotateYaw({ x: point.x - object.x, y: point.y - object.y, z: point.z - object.z }, -object.rotateY);
  return { x: origin.x + local.x, y: origin.y + local.y, z: origin.z + local.z };
}
export function rotatedRoomObjectFootprint(object: RoomObjectInstance) {
  const foot = FOOTPRINT[object.kind];
  const angle = object.rotateY * Math.PI / 180;
  const cos = Math.abs(Math.cos(angle)), sin = Math.abs(Math.sin(angle));
  return { ...foot, halfX: cos * foot.halfX + sin * foot.halfZ, halfZ: sin * foot.halfX + cos * foot.halfZ };
}

export function liveDeskBinderYaw(objects: RoomObjectInstance[], preview?: RoomObjectInstance | null, instanceId?: string | null) {
  const desk = instanceId ? objects.find((object) => object.id === instanceId && object.kind === "desk") : objectByKind(objects, "desk");
  return (preview?.id === desk?.id ? preview : desk)?.rotateY ?? 0;
}

export function childrenOnInstance<T extends { placement?: { surfaceId?: string | null } }>(items: T[], roomId: string, objects: RoomObjectInstance[], instanceId: string): T[] {
  return items.filter((item) => surfaceOwner(roomId, objects, item.placement?.surfaceId)?.id === instanceId);
}
