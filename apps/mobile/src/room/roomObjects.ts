import { DESK_BINDER_AT } from "./camera";
import { ROOM_BOX } from "./envelope";
import { layoutX, layoutZ } from "./roomLayout";
import type { NativeRoomSurface, NativeRoomVector } from "./model";

/** Basic V1 Room Shop catalog — one canonical version of each object. */
export const ROOM_OBJECT_KINDS = [
  "shelf",
  "desk",
  "case",
  "lamp",
  "plant",
  "rug",
  "archive",
  "wall-frame",
] as const;

export type RoomObjectKind = (typeof ROOM_OBJECT_KINDS)[number];

export type RoomObjectInstance = {
  id: string;
  kind: RoomObjectKind;
  x: number;
  y: number;
  z: number;
  rotateY: 0 | 90 | 180 | 270;
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

/** Unique structural pieces — one in the Room for V1. */
export const UNIQUE_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>(["desk", "case", "archive", "rug"]);

/** Safe to place more than one when instance ids stay stable. */
export const MULTI_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>(["shelf", "lamp", "plant", "wall-frame"]);

/** 90° Turn is only exposed where landing surfaces do not depend on facing. */
export const TURNABLE_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>(["lamp", "plant", "rug"]);

export const CARRIER_ROOM_OBJECT_KINDS = new Set<RoomObjectKind>(["shelf", "desk", "case", "archive"]);

export const SHOP_CATALOG: readonly RoomObjectKind[] = [
  "shelf",
  "desk",
  "case",
  "rug",
  "lamp",
  "plant",
  "archive",
  "wall-frame",
];

export const ROOM_OBJECT_DEFAULTS: Record<RoomObjectKind, NativeRoomVector> = {
  shelf: { x: layoutX(-3.15), y: -0.55, z: layoutZ(-3.78) },
  desk: { x: layoutX(1.45), y: -0.82, z: layoutZ(-2.85) },
  case: { x: layoutX(3.65), y: -0.55, z: layoutZ(-3.78) },
  lamp: { x: layoutX(-3.72), y: -2.08, z: layoutZ(-0.58) },
  plant: { x: layoutX(3.42), y: -1.95, z: layoutZ(-1.62) },
  rug: { x: layoutX(0.22), y: -2.05, z: layoutZ(-1.15) },
  archive: { x: layoutX(-1.2), y: -1.86, z: layoutZ(-0.65) },
  "wall-frame": { x: layoutX(1.55), y: 0.88, z: ROOM_BOX.backZ + 0.12 },
};

const FOOTPRINT: Record<RoomObjectKind, { halfX: number; halfZ: number; halfY?: number }> = {
  shelf: { halfX: 1.12, halfZ: 0.42 },
  desk: { halfX: 1.68, halfZ: 0.88 },
  case: { halfX: 0.78, halfZ: 0.38 },
  lamp: { halfX: 0.24, halfZ: 0.24 },
  plant: { halfX: 0.22, halfZ: 0.22 },
  rug: { halfX: 1.18, halfZ: 0.76 },
  archive: { halfX: 0.92, halfZ: 0.62 },
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

const SURFACE_LOCAL: Record<"shelf" | "desk" | "case" | "archive", SurfaceLocal[]> = {
  shelf: [
    { suffix: "shelf-bay-0", kind: "horizontal", lx: 0, ly: -0.85, lz: layoutZ(0.3), width: 2.1, depth: 0.8 },
    { suffix: "shelf-bay-1", kind: "horizontal", lx: 0, ly: 0.05, lz: layoutZ(0.3), width: 2.1, depth: 0.8 },
    { suffix: "shelf-bay-2", kind: "horizontal", lx: 0, ly: 0.95, lz: layoutZ(0.3), width: 2.1, depth: 0.8 },
  ],
  desk: [
    { suffix: "desk", kind: "horizontal", lx: 0, ly: 0.1, lz: 0, width: 3.25, depth: 1.65 },
    { suffix: "binder", kind: "horizontal", lx: layoutX(-1), ly: 0.14, lz: layoutZ(0.15), width: 0.95, depth: 0.72 },
  ],
  case: [
    { suffix: "display-case-shelf", kind: "horizontal", lx: 0, ly: 0.05, lz: layoutZ(0.26), width: 1.45, depth: 0.72 },
    { suffix: "display-case-top", kind: "horizontal", lx: 0, ly: 1.03, lz: layoutZ(0.26), width: 1.45, depth: 0.72 },
  ],
  archive: [
    { suffix: "archive", kind: "horizontal", lx: 0, ly: 0.18, lz: 0, width: 1.7, depth: 1.05 },
  ],
};

export function defaultRoomObject(kind: RoomObjectKind, id: string = kind): RoomObjectInstance {
  const at = ROOM_OBJECT_DEFAULTS[kind];
  return { id, kind, x: at.x, y: at.y, z: at.z, rotateY: 0 };
}

export function legacyRoomObjects(): RoomObjectInstance[] {
  return ROOM_OBJECT_KINDS.map((kind) => kind === "archive" ? spawnRoomObject([], kind) : defaultRoomObject(kind));
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
  for (const entry of raw.objects.slice(0, 24)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const kind = row.kind;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    if (!isRoomObjectKind(kind) || !id || seen.has(id)) continue;
    if (UNIQUE_ROOM_OBJECT_KINDS.has(kind) && objects.some((item) => item.kind === kind)) continue;
    seen.add(id);
    objects.push(clampRoomObject({
      id,
      kind,
      x: finite(row.x, ROOM_OBJECT_DEFAULTS[kind].x),
      y: finite(row.y, ROOM_OBJECT_DEFAULTS[kind].y),
      z: finite(row.z, ROOM_OBJECT_DEFAULTS[kind].z),
      rotateY: normalizeRotateY(row.rotateY),
    }));
  }
  if (!objects.length) return legacyRoomLayout();
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
  return { ...object };
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
  const origin = ROOM_OBJECT_DEFAULTS[object.kind];
  return { x: object.x - origin.x, y: object.y - origin.y, z: object.z - origin.z };
}

export function objectHasKind(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  return objects.some((item) => item.kind === kind);
}

export function objectByKind(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  return objects.find((item) => item.kind === kind) ?? null;
}

export function canAddRoomObject(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  if (UNIQUE_ROOM_OBJECT_KINDS.has(kind)) return !objectHasKind(objects, kind);
  return MULTI_ROOM_OBJECT_KINDS.has(kind) && objects.filter((item) => item.kind === kind).length < 6;
}

export function nextRoomObjectId(objects: RoomObjectInstance[], kind: RoomObjectKind) {
  if (UNIQUE_ROOM_OBJECT_KINDS.has(kind)) return kind;
  if (!objects.some((item) => item.id === kind)) return kind;
  let index = 2;
  while (objects.some((item) => item.id === `${kind}-${index}`)) index += 1;
  return `${kind}-${index}`;
}

export function spawnRoomObject(objects: RoomObjectInstance[], kind: RoomObjectKind): RoomObjectInstance {
  const id = nextRoomObjectId(objects, kind);
  const drafted = defaultRoomObject(kind, id);
  const separated = kind === "archive"
    ? { ...drafted, x: layoutX(-2.95), z: layoutZ(1.05) }
    : drafted;
  const draft = clampRoomObject(separated);
  const clash = objects.some((item) => item.kind === kind && distanceXZ(item, draft) < 0.35);
  if (!clash) return draft;
  return clampRoomObject({ ...draft, x: draft.x + 0.48, z: Math.min(draft.z + 0.4, 1.2) });
}

export function replaceRoomObject(objects: RoomObjectInstance[], next: RoomObjectInstance) {
  return objects.map((item) => item.id === next.id ? cloneRoomObject(next) : item);
}

export function removeRoomObject(objects: RoomObjectInstance[], objectId: string) {
  return objects.filter((item) => item.id !== objectId);
}

export function turnRoomObject(object: RoomObjectInstance): RoomObjectInstance {
  if (!TURNABLE_ROOM_OBJECT_KINDS.has(object.kind)) return object;
  const rotateY = ((object.rotateY + 90) % 360) as RoomObjectInstance["rotateY"];
  return { ...object, rotateY };
}

export function clampRoomObject(object: RoomObjectInstance): RoomObjectInstance {
  if (object.kind === "wall-frame") {
    const foot = FOOTPRINT[object.kind];
    return {
      ...object,
      x: clamp(object.x, -ROOM_BOX.wallX + foot.halfX + 0.2, ROOM_BOX.wallX - foot.halfX - 0.2),
      y: clamp(object.y, -1.15, 2.15),
      z: ROOM_BOX.backZ + 0.12,
      rotateY: 0,
    };
  }
  const foot = FOOTPRINT[object.kind];
  const maxX = ROOM_BOX.wallX - foot.halfX - 0.16;
  const minZ = ROOM_BOX.backZ + foot.halfZ + 0.22;
  return {
    ...object,
    x: clamp(object.x, -maxX, maxX),
    y: ROOM_OBJECT_DEFAULTS[object.kind].y,
    z: clamp(object.z, minZ, 1.65),
  };
}

export function roomObjectInBounds(object: RoomObjectInstance) {
  const clamped = clampRoomObject(object);
  return Math.abs(clamped.x - object.x) < 0.08
    && Math.abs(clamped.z - object.z) < 0.08
    && Math.abs(clamped.y - object.y) < 0.08;
}

export function deskBinderWorld(objects: RoomObjectInstance[]): NativeRoomVector | null {
  const desk = objectByKind(objects, "desk");
  if (!desk) return null;
  const delta = furnitureDelta(desk);
  return { x: DESK_BINDER_AT.x + delta.x, y: DESK_BINDER_AT.y + delta.y, z: DESK_BINDER_AT.z + delta.z };
}

/** Live Desk drag preview — same rest as `deskBinderWorld` once the preview matches the stored Desk. */
export function liveDeskBinderWorld(
  objects: RoomObjectInstance[],
  preview?: RoomObjectInstance | null,
): NativeRoomVector | null {
  const rest = deskBinderWorld(objects);
  if (!rest) return null;
  if (preview?.kind !== "desk") return rest;
  const origin = objectByKind(objects, "desk");
  if (!origin) return rest;
  return {
    x: rest.x + preview.x - origin.x,
    y: rest.y + preview.y - origin.y,
    z: rest.z + preview.z - origin.z,
  };
}

export function storageTakeoutFor(objects: RoomObjectInstance[]): NativeRoomVector {
  const archive = objectByKind(objects, "archive");
  if (!archive) return { x: layoutX(-1.2), y: -1.12, z: layoutZ(-0.65) };
  return { x: archive.x, y: archive.y + 0.74, z: archive.z };
}

export function canonicalSurfaceId(roomId: string, object: RoomObjectInstance, suffix: string) {
  if ((object.kind === "shelf" || object.kind === "lamp" || object.kind === "plant" || object.kind === "wall-frame") && object.id !== object.kind) {
    return `${roomId}-${object.kind}:${object.id}-${suffix.replace(`${object.kind}-`, "")}`;
  }
  return `${roomId}-${suffix}`;
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
  const bySuffix = new Map(defaults.map((surface) => [surface.id.slice(roomId.length + 1), surface]));
  const next: NativeRoomSurface[] = defaults.filter((surface) => surface.id.endsWith("-wall") || surface.id.endsWith("-floor"));
  for (const object of objects) {
    if (!CARRIER_ROOM_OBJECT_KINDS.has(object.kind)) continue;
    for (const local of SURFACE_LOCAL[object.kind as keyof typeof SURFACE_LOCAL]) {
      const id = surfaceIdFor(roomId, object, local.suffix);
      const fallback = bySuffix.get(local.suffix);
      next.push({
        id,
        kind: local.kind,
        x: object.x + local.lx,
        y: object.y + local.ly,
        z: object.z + local.lz,
        width: fallback?.width ?? local.width,
        depth: fallback?.depth ?? local.depth,
      });
    }
  }
  return next;
}

export function zoneHotspotFor(kind: "shelf" | "case" | "desk" | "binder" | "archive", objects: RoomObjectInstance[]) {
  if (kind === "binder") {
    const at = deskBinderWorld(objects);
    return at ? { position: [at.x, at.y + 0.17, at.z] as [number, number, number], size: [1.05, 0.9, 0.7] as [number, number, number] } : null;
  }
  const object = objectByKind(objects, kind);
  if (!object) return null;
  const size: Record<"shelf" | "case" | "desk" | "archive", [number, number, number]> = {
    shelf: [2.4, 3.2, 0.9],
    case: [1.7, 3.2, 0.8],
    desk: [3.3, 1.1, 1.7],
    archive: [1.9, 0.8, 1.2],
  };
  const lift = kind === "archive" ? 0.31 : kind === "desk" ? 0.27 : 0.35;
  const zNudge = kind === "shelf" || kind === "case" ? 0.23 : 0;
  return { position: [object.x, object.y + lift, object.z + zNudge] as [number, number, number], size: size[kind] };
}

export function shopHasNoCommerce() {
  return true;
}

function surfaceIdFor(roomId: string, object: RoomObjectInstance, suffix: string) {
  if (object.kind === "shelf" && object.id !== "shelf") {
    const bay = suffix.replace("shelf-", "");
    return `${roomId}-shelf:${object.id}-${bay}`;
  }
  return `${roomId}-${suffix}`;
}

function normalizeRotateY(value: unknown): RoomObjectInstance["rotateY"] {
  const numeric = typeof value === "number" && Number.isFinite(value) ? ((Math.round(value / 90) * 90) % 360 + 360) % 360 : 0;
  return (numeric === 90 || numeric === 180 || numeric === 270 ? numeric : 0);
}

function finite(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function distanceXZ(a: { x: number; z: number }, b: { x: number; z: number }) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
