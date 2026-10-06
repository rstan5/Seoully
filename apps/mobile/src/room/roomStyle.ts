import { ROOM_BINDER_COLORS, type RoomBinderColor } from "seoully-domain/room-object-schema";
/** Curated Room style — not raw renderer knobs. Independent of the unapplied theme_id preset. */

export const ROOM_BINDER_IDS = Object.keys(ROOM_BINDER_COLORS) as RoomBinderColor[];
export const ROOM_WALL_IDS = ["plum", "cream", "ink", "blush", "sage"] as const;
export const ROOM_FLOOR_IDS = ["walnut", "oak", "charcoal", "blush-wood"] as const;
export const ROOM_FURNITURE_IDS = ["walnut", "oak", "ink", "blush"] as const;
export const ROOM_RUG_IDS = ["rose", "cream", "ink", "sage"] as const;
export const ROOM_LIGHT_IDS = ["warm", "day", "soft", "night"] as const;
export const ROOM_BRIGHTNESS_IDS = ["dim", "normal", "bright"] as const;

export type RoomWallId = (typeof ROOM_WALL_IDS)[number];
export type RoomFloorId = (typeof ROOM_FLOOR_IDS)[number];
export type RoomFurnitureId = (typeof ROOM_FURNITURE_IDS)[number];
export type RoomRugId = (typeof ROOM_RUG_IDS)[number];
export type RoomLightId = (typeof ROOM_LIGHT_IDS)[number];
export type RoomBrightnessId = (typeof ROOM_BRIGHTNESS_IDS)[number];

export type NativeRoomStyle = {
  wall: RoomWallId;
  floor: RoomFloorId;
  furniture: RoomFurnitureId;
  rug: RoomRugId;
  light: RoomLightId;
  brightness: RoomBrightnessId;
  binder?: RoomBinderColor;
};

export const DEFAULT_ROOM_STYLE: NativeRoomStyle = {
  binder: "cream",
  wall: "plum",
  floor: "walnut",
  furniture: "walnut",
  rug: "rose",
  light: "warm",
  brightness: "normal",
};

export const STYLE_BY_THEME = {
  hearth: DEFAULT_ROOM_STYLE,
  blossom: { binder: "cream", wall: "blush", floor: "blush-wood", furniture: "blush", rug: "rose", light: "day", brightness: "bright" },
  midnight: { binder: "cream", wall: "ink", floor: "charcoal", furniture: "ink", rug: "ink", light: "night", brightness: "dim" },
} as const satisfies Record<string, NativeRoomStyle>;

const WALLS: Record<RoomWallId, { wall: string; wallAccent: string; sideWall: string; void: string }> = {
  plum: { wall: "#5a4650", wallAccent: "#7a6270", sideWall: "#463840", void: "#1c161a" },
  cream: { wall: "#f3e8da", wallAccent: "#fff6ec", sideWall: "#e0d0be", void: "#d4c4b2" },
  ink: { wall: "#3a3548", wallAccent: "#524a62", sideWall: "#2a2636", void: "#121018" },
  blush: { wall: "#9a6270", wallAccent: "#c48896", sideWall: "#7a4c5a", void: "#2c1c22" },
  sage: { wall: "#66786a", wallAccent: "#88a090", sideWall: "#526258", void: "#1c2420" },
};

const FLOORS: Record<RoomFloorId, { floor: string; plank: string }> = {
  walnut: { floor: "#4a3428", plank: "#6a4a36" },
  oak: { floor: "#9a784e", plank: "#c4a06a" },
  charcoal: { floor: "#3a363c", plank: "#524e56" },
  "blush-wood": { floor: "#7a524c", plank: "#9a6a62" },
};

const FURNITURE: Record<RoomFurnitureId, { furniture: string; edge: string; metal: string }> = {
  walnut: { furniture: "#2e221c", edge: "#a88868", metal: "#8a7a6a" },
  oak: { furniture: "#6a4a2e", edge: "#d4b088", metal: "#9a8a78" },
  ink: { furniture: "#1e1a28", edge: "#8a7a96", metal: "#7a7288" },
  blush: { furniture: "#4a2c34", edge: "#d4a0ae", metal: "#b08a92" },
};

const RUGS: Record<RoomRugId, string> = {
  rose: "#8e5265",
  cream: "#e8d8c4",
  ink: "#3a3048",
  sage: "#5a7860",
};

const LIGHTS: Record<RoomLightId, { light: string; fill: string }> = {
  warm: { light: "#ffc48a", fill: "#d4c4e4" },
  day: { light: "#fff4ea", fill: "#f6dce8" },
  soft: { light: "#f6ddcc", fill: "#e0d0da" },
  night: { light: "#e8dcff", fill: "#a898c4" },
};

const BRIGHTNESS: Record<RoomBrightnessId, number> = {
  dim: 0.78,
  normal: 1,
  bright: 1.28,
};

export type RoomLook = {
  void: string;
  wall: string;
  wallAccent: string;
  sideWall: string;
  floor: string;
  plank: string;
  furniture: string;
  edge: string;
  metal: string;
  accent: string;
  light: string;
  fill: string;
  ink: string;
  paper: string;
  binder: string;
  brightness: number;
};

export function defaultStyleForTheme(themeId?: string): NativeRoomStyle {
  if (themeId === "blossom" || themeId === "midnight") return { ...STYLE_BY_THEME[themeId] };
  return { ...DEFAULT_ROOM_STYLE };
}

export function parseRoomStyle(value: unknown, fallback: NativeRoomStyle = DEFAULT_ROOM_STYLE): NativeRoomStyle {
  if (!value || typeof value !== "object") return { ...fallback };
  const raw = value as Record<string, unknown>;
  return {
    binder: pick(ROOM_BINDER_IDS, raw.binder, fallback.binder ?? "cream"),
    wall: pick(ROOM_WALL_IDS, raw.wall, fallback.wall),
    floor: pick(ROOM_FLOOR_IDS, raw.floor, fallback.floor),
    furniture: pick(ROOM_FURNITURE_IDS, raw.furniture, fallback.furniture),
    rug: pick(ROOM_RUG_IDS, raw.rug, fallback.rug),
    light: pick(ROOM_LIGHT_IDS, raw.light, fallback.light),
    brightness: pick(ROOM_BRIGHTNESS_IDS, raw.brightness, fallback.brightness),
  };
}

export function resolveRoomLook(style: NativeRoomStyle): RoomLook {
  const wall = WALLS[style.wall];
  const furniture = FURNITURE[style.furniture];
  const boards = FLOORS[style.floor];
  const lamp = LIGHTS[style.light];
  const cream = style.wall === "cream";
  return {
    void: wall.void,
    wall: wall.wall,
    wallAccent: wall.wallAccent,
    sideWall: wall.sideWall,
    floor: boards.floor,
    plank: boards.plank,
    furniture: furniture.furniture,
    edge: furniture.edge,
    metal: furniture.metal,
    accent: RUGS[style.rug],
    light: lamp.light,
    fill: lamp.fill,
    ink: cream ? "#2c2e4c" : "#f4efe8",
    paper: cream ? "#f7efe4" : "#efe8da",
    binder: ROOM_BINDER_COLORS[style.binder ?? "cream"],
    brightness: BRIGHTNESS[style.brightness],
  };
}

export function styleSwatch(kind: keyof NativeRoomStyle, id: string) {
  if (kind === "binder") return ROOM_BINDER_COLORS[id as RoomBinderColor] ?? ROOM_BINDER_COLORS.cream;
  if (kind === "wall") return WALLS[id as RoomWallId]?.wall ?? "#888";
  if (kind === "floor") return FLOORS[id as RoomFloorId]?.floor ?? "#888";
  if (kind === "furniture") return FURNITURE[id as RoomFurnitureId]?.furniture ?? "#888";
  if (kind === "rug") return RUGS[id as RoomRugId] ?? "#888";
  if (kind === "light") return LIGHTS[id as RoomLightId]?.light ?? "#888";
  if (id === "dim") return "#5a4a40";
  if (id === "bright") return "#ffe8c8";
  return "#c4a078";
}

function pick<T extends string>(allowed: readonly T[], value: unknown, fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}
