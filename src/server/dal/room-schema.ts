/** Applied rooms columns plus 7D `style`. Do not select theme_id — 20261002 stays unapplied. */

export const ROOM_OWNER_SELECT = "id,owner_user_id,created_at,updated_at,style" as const;
export const DEFAULT_NATIVE_ROOM_THEME = "hearth" as const;
export const DEFAULT_NATIVE_ROOM_STYLE = {
  wall: "plum",
  floor: "walnut",
  furniture: "walnut",
  rug: "rose",
  light: "warm",
  brightness: "normal",
} as const;

export type NativeRoomThemeId = "hearth" | "blossom" | "midnight";
export type NativeRoomStyle = {
  wall: "plum" | "cream" | "ink" | "blush" | "sage";
  floor: "walnut" | "oak" | "charcoal" | "blush-wood";
  furniture: "walnut" | "oak" | "ink" | "blush";
  rug: "rose" | "cream" | "ink" | "sage";
  light: "warm" | "day" | "soft" | "night";
  brightness: "dim" | "normal" | "bright";
};

export function nativeRoomThemeFromRow(_row: Record<string, unknown>): NativeRoomThemeId {
  void _row;
  return DEFAULT_NATIVE_ROOM_THEME;
}

export function nativeRoomStyleFromRow(row: Record<string, unknown>): NativeRoomStyle {
  const raw = row.style;
  if (!raw || typeof raw !== "object") return { ...DEFAULT_NATIVE_ROOM_STYLE };
  const style = raw as Record<string, unknown>;
  const wall = style.wall;
  const floor = style.floor;
  const furniture = style.furniture;
  const rug = style.rug;
  const light = style.light;
  const brightness = style.brightness;
  return {
    wall: wall === "cream" || wall === "ink" || wall === "blush" || wall === "sage" ? wall : "plum",
    floor: floor === "oak" || floor === "charcoal" || floor === "blush-wood" ? floor : "walnut",
    furniture: furniture === "oak" || furniture === "ink" || furniture === "blush" ? furniture : "walnut",
    rug: rug === "cream" || rug === "ink" || rug === "sage" ? rug : "rose",
    light: light === "day" || light === "soft" || light === "night" ? light : "warm",
    brightness: brightness === "dim" || brightness === "bright" ? brightness : "normal",
  };
}
