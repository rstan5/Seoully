import type { NativeRoomThemeId } from "../api";

/**
 * Native materials translated from web `roomTheme` + CSS (`m-paper`, `m-velvet`,
 * `--room-wall`, `--room-floor`, `--room-furniture`). Hearth matches starter-room
 * HEARTH / warm-analog. Production has no theme_id column — default hearth.
 */
export const ROOM_THEMES = {
  hearth: {
    background: "#1a1418",
    void: "#120e12",
    wall: "#3a2f38",
    wallAccent: "#53444c",
    sideWall: "#322830",
    floor: "#241c22",
    furniture: "#2c242a",
    edge: "#7a6a74",
    accent: "#8e5265",
    light: "#ffc48a",
    fill: "#c9b6dc",
    ink: "#f4efe8",
    paper: "#efe8da",
    binder: "#4a1c2c",
  },
  blossom: {
    background: "#2a1a20",
    void: "#1c1216",
    wall: "#5a3844",
    wallAccent: "#8a5464",
    sideWall: "#4a2e38",
    floor: "#3a242c",
    furniture: "#4a3038",
    edge: "#c98b9d",
    accent: "#d8789a",
    light: "#fff1e5",
    fill: "#f3d4e2",
    ink: "#fff4f6",
    paper: "#f7ebe4",
    binder: "#8f3558",
  },
  midnight: {
    background: "#0c0b14",
    void: "#08070b",
    wall: "#342d46",
    wallAccent: "#4a4260",
    sideWall: "#29243a",
    floor: "#1f1b2d",
    furniture: "#282237",
    edge: "#705d86",
    accent: "#794f72",
    light: "#d6c9ff",
    fill: "#6a5a88",
    ink: "#ece6f4",
    paper: "#e8e0d4",
    binder: "#3a1c38",
  },
} as const;

export type NativeRoomPalette = (typeof ROOM_THEMES)[NativeRoomThemeId];

export function roomPalette(themeId: NativeRoomThemeId | undefined): NativeRoomPalette {
  return ROOM_THEMES[themeId ?? "hearth"] ?? ROOM_THEMES.hearth;
}
