/** Curated Room style — not raw renderer knobs. Independent of the unapplied theme_id preset. */

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
};

export const DEFAULT_ROOM_STYLE: NativeRoomStyle = {
  wall: "plum",
  floor: "walnut",
  furniture: "walnut",
  rug: "rose",
  light: "warm",
  brightness: "normal",
};

export const STYLE_BY_THEME = {
  hearth: DEFAULT_ROOM_STYLE,
  blossom: { wall: "blush", floor: "blush-wood", furniture: "blush", rug: "rose", light: "day", brightness: "bright" },
  midnight: { wall: "ink", floor: "charcoal", furniture: "ink", rug: "ink", light: "night", brightness: "dim" },
} as const satisfies Record<string, NativeRoomStyle>;

const WALLS: Record<RoomWallId, { wall: string; wallAccent: string; sideWall: string; void: string }> = {
  plum: { wall: "#4a3a42", wallAccent: "#6a5460", sideWall: "#3c3038", void: "#1a1418" },
  cream: { wall: "#efe4d6", wallAccent: "#f7efe4", sideWall: "#e4d6c6", void: "#d8c8b6" },
  ink: { wall: "#2c2838", wallAccent: "#3e384c", sideWall: "#22202c", void: "#0c0b12" },
  blush: { wall: "#8a5460", wallAccent: "#b87888", sideWall: "#6e4250", void: "#2a1a20" },
  sage: { wall: "#5a6a5e", wallAccent: "#7a8c7e", sideWall: "#4a584e", void: "#1a201c" },
};

const FLOORS: Record<RoomFloorId, string> = {
  walnut: "#3a2a22",
  oak: "#8a6a48",
  charcoal: "#2a262c",
  "blush-wood": "#6a4440",
};

const FURNITURE: Record<RoomFurnitureId, { furniture: string; edge: string }> = {
  walnut: { furniture: "#3a2c26", edge: "#8a6e58" },
  oak: { furniture: "#7a5a3a", edge: "#c4a078" },
  ink: { furniture: "#2a2432", edge: "#6a5c78" },
  blush: { furniture: "#5a3840", edge: "#c48b9a" },
};

const RUGS: Record<RoomRugId, string> = {
  rose: "#8e5265",
  cream: "#e8d8c4",
  ink: "#3a3048",
  sage: "#5a7860",
};

const LIGHTS: Record<RoomLightId, { light: string; fill: string }> = {
  warm: { light: "#ffc48a", fill: "#c9b6dc" },
  day: { light: "#fff1e5", fill: "#f3d4e2" },
  soft: { light: "#f4d8c4", fill: "#d8c4d0" },
  night: { light: "#d6c9ff", fill: "#6a5a88" },
};

const BRIGHTNESS: Record<RoomBrightnessId, number> = {
  dim: 0.62,
  normal: 1,
  bright: 1.28,
};

export type RoomLook = {
  void: string;
  wall: string;
  wallAccent: string;
  sideWall: string;
  floor: string;
  furniture: string;
  edge: string;
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
  const lamp = LIGHTS[style.light];
  const cream = style.wall === "cream";
  return {
    void: wall.void,
    wall: wall.wall,
    wallAccent: wall.wallAccent,
    sideWall: wall.sideWall,
    floor: FLOORS[style.floor],
    furniture: furniture.furniture,
    edge: furniture.edge,
    accent: RUGS[style.rug],
    light: lamp.light,
    fill: lamp.fill,
    ink: cream ? "#2c2e4c" : "#f4efe8",
    paper: cream ? "#f7efe4" : "#efe8da",
    binder: style.furniture === "blush" ? "#8f3558" : style.furniture === "ink" ? "#3a1c38" : "#4a1c2c",
    brightness: BRIGHTNESS[style.brightness],
  };
}

export function styleSwatch(kind: keyof NativeRoomStyle, id: string) {
  if (kind === "wall") return WALLS[id as RoomWallId]?.wall ?? "#888";
  if (kind === "floor") return FLOORS[id as RoomFloorId] ?? "#888";
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
