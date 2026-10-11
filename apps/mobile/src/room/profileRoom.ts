import type { NativeHolding, NativeRoomPlacement, NativePublicRoom } from "../api";
import { buildPublicRoomRenderables, buildRoomRenderables } from "./model";
import { parseRoomLayout } from "./roomObjects";
import { parseRoomStyle, resolveRoomLook } from "./roomStyle";
import { resolveProfileTheme, type ProfileRoomAppearance } from "seoully-domain/profile-theme";
import type { ProfileThemeChoice } from "seoully-domain/types";

export type OwnerProfileRoom = { id: string; style?: unknown; layout?: unknown; placements: NativeRoomPlacement[] };
export function ownerRoomPreview(room: OwnerProfileRoom, holdings: NativeHolding[]) {
  return { id: room.id, style: parseRoomStyle(room.style), objects: parseRoomLayout(room.layout).objects,
    items: buildRoomRenderables(holdings, room.placements).filter(item => item.geometry !== "photocard"), holdings, publicStringCards: [] };
}
export function publicRoomPreview(userId: string, response: NativePublicRoom) {
  if (response.owner.userId !== userId) throw new Error("collector_room_mismatch");
  if (response.private || !response.room) return null;
  const room = response.room;
  return { id: room.id, style: parseRoomStyle(room.style), objects: parseRoomLayout(room.layout).objects,
    items: buildPublicRoomRenderables(room.id, room.placements).filter(item => item.geometry !== "photocard"),
    holdings: [], publicStringCards: room.photoStringCards ?? [] };
}
export type ProfileRoomPreview = ReturnType<typeof ownerRoomPreview> | NonNullable<ReturnType<typeof publicRoomPreview>>;
/** Feed the web resolver the actual renderer palette; never persist derived colors. */
export function nativeProfileTheme(choice: ProfileThemeChoice | undefined, style?: ProfileRoomPreview["style"]) {
  let room: ProfileRoomAppearance | undefined;
  if (style) {
    const look = resolveRoomLook(style);
    room = { aesthetic: "warm-analog", theme: { name: "", wall: look.wall, wallAccent: look.wallAccent,
      floor: look.floor, furniture: look.furniture, furnitureEdge: look.edge, ink: look.ink,
      inkSoft: look.ink, grade: look.void,
      light: { color: look.light, fill: look.fill, intensity: look.brightness, x: 0, y: 0 } } };
  }
  const tokens = resolveProfileTheme(choice, room);
  return { ...tokens, cream: tokens.tint };
}
