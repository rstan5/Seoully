/** Columns that exist on applied `rooms` (20260922000000). Do not select theme_id until 20261002 is approved. */

export const ROOM_OWNER_SELECT = "id,owner_user_id,created_at,updated_at" as const;
export const DEFAULT_NATIVE_ROOM_THEME = "hearth" as const;

export type NativeRoomThemeId = "hearth" | "blossom" | "midnight";

export function nativeRoomThemeFromRow(_row: Record<string, unknown>): NativeRoomThemeId {
  void _row;
  return DEFAULT_NATIVE_ROOM_THEME;
}
