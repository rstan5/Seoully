import type { CSSProperties } from "react";
import type { RoomTheme } from "@/domain/types";

/**
 * Projects a RoomTheme onto CSS custom properties.
 *
 * Every material and every surface in the scene reads from these, so changing
 * one collector's theme re-lights their entire room — walls, wood grain, foil
 * highlights, contact shadows — without a single component knowing about it.
 * This is the mechanism behind "different collectors have different worlds".
 */
export function themeVars(theme: RoomTheme, lightScale = 1): CSSProperties {
  const intensity = theme.light.intensity * lightScale;
  return {
    "--room-wall": theme.wall,
    "--room-wall-accent": theme.wallAccent,
    "--room-floor": theme.floor,
    "--room-void": mixToward(theme.wall, "#05050a", 0.82),
    "--room-furniture": theme.furniture,
    "--room-furniture-edge": theme.furnitureEdge,
    "--room-ink": theme.ink,
    "--room-ink-soft": theme.inkSoft,
    "--room-grade": theme.grade,

    "--room-light-color": theme.light.color,
    "--room-light-x": theme.light.x,
    "--room-light-y": theme.light.y,
    "--room-light-intensity": intensity,
    "--room-fill": theme.light.fill,

    // Materials read these. Deriving the key-light angle from the light's
    // actual position is what keeps highlights on a photocard consistent with
    // the shadow under the shelf across the room.
    "--lit-angle": `${lightAngle(theme.light.x, theme.light.y)}deg`,
    "--lit-color": theme.light.color,
    "--lit-strength": intensity,
    "--fill-color": theme.light.fill,
  } as CSSProperties;
}

/**
 * Converts a normalized light position into the CSS gradient angle that a flat
 * surface should be shaded along. CSS gradient angles run clockwise from "up",
 * hence the offset.
 */
function lightAngle(x: number, y: number): number {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return Math.round(((deg + 180) % 360) * 10) / 10;
}

/** Cheap hex blend, used to derive the void color behind the room. */
function mixToward(hex: string, target: string, amount: number): string {
  const a = parseHex(hex);
  const b = parseHex(target);
  if (!a || !b) return hex;
  const mix = (i: number) => Math.round(a[i]! + (b[i]! - a[i]!) * amount);
  return `#${[mix(0), mix(1), mix(2)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.replace("#", "");
  if (value.length !== 6) return null;
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}
