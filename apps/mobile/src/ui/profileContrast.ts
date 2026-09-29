import { PROFILE_VEIL, colors } from "../theme";

export type ContrastTheme = {
  scheme: "light" | "dark";
  paper: string;
  mist: string;
  ink: string;
  mute: string;
  line?: string;
  action?: string;
};

export type IdentityPalette = {
  scheme: "light" | "dark";
  ink: string;
  mute: string;
  paper: string;
  mist: string;
  line: string;
  action: string;
  counts: string;
};

/** Web default identity tokens (`DEFAULT_PROFILE_THEME` / `--s-ink`). */
export const IDENTITY_LIGHT: IdentityPalette = {
  scheme: "light",
  ink: "#2c2e4c",
  mute: "#8a7380",
  paper: "#fffafb",
  mist: "#fff1f4",
  line: "#f3e4e9",
  action: "#c45374",
  counts: "#555555",
};

/**
 * Web dark / room-sync identity. Ink is compensated (`deriveFromRoom` falls
 * back to #f3eef6 when room ink is too dark). Native must not keep navy text.
 */
export const IDENTITY_DARK: IdentityPalette = {
  scheme: "dark",
  ink: "#f3eef6",
  mute: "#b4a8bc",
  paper: "#1a1524",
  mist: "#241c32",
  line: "#3a3148",
  action: "#d4a0b8",
  counts: "#c8c0d0",
};

const HEARTH_VOID = "#120e12";

export function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const value = hex.trim().replace("#", "");
  if (value.length !== 6) return null;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function mixHex(front: string, back: string, frontAlpha: number): string {
  const a = parseHex(front);
  const b = parseHex(back);
  if (!a || !b) return front;
  const t = Math.min(1, Math.max(0, frontAlpha));
  const mix = (x: number, y: number) => Math.round(x * t + y * (1 - t));
  return `#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return `rgba(255, 241, 244, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Veil over the current Room glimpse, matching web `--s-profile-veil`. */
export function veiledSurface(mist: string, roomVoid = HEARTH_VOID, veil = PROFILE_VEIL): string {
  const dimmedRoom = mixHex("#120c10", roomVoid, 0.28);
  return mixHex(mist, dimmedRoom, veil);
}

export function identityIsReadable(palette: IdentityPalette, roomVoid = HEARTH_VOID): boolean {
  const surface = palette.scheme === "dark" ? veiledSurface(palette.mist, roomVoid) : palette.mist;
  return contrastRatio(palette.ink, surface) >= 4.5 && contrastRatio(palette.mute, surface) >= 3;
}

/**
 * Deterministic Profile identity colors.
 * Room/theme may tint mist/paper. Foreground is contrast-validated, never raw Room ink.
 */
export function identityPalette(
  theme?: ContrastTheme | null,
  roomVoid = HEARTH_VOID,
): IdentityPalette {
  const mist = theme?.mist ?? colors.mist;
  const paper = theme?.paper ?? colors.surface;
  const surface = veiledSurface(mist, roomVoid);
  const dark = theme?.scheme === "dark"
    || relativeLuminance(mist) < 0.45
    || relativeLuminance(paper) < 0.45
    || relativeLuminance(surface) < 0.45;

  if (!dark) {
    const ink = theme?.ink && relativeLuminance(theme.ink) < 0.45 ? theme.ink : IDENTITY_LIGHT.ink;
    const mute = theme?.mute && contrastRatio(theme.mute, surface) >= 3 ? theme.mute : IDENTITY_LIGHT.mute;
    return {
      ...IDENTITY_LIGHT,
      ink,
      mute,
      mist,
      paper,
      line: theme?.line ?? IDENTITY_LIGHT.line,
      action: theme?.action && contrastRatio(theme.action, surface) >= 3 ? theme.action : IDENTITY_LIGHT.action,
      counts: contrastRatio(IDENTITY_LIGHT.counts, surface) >= 4.5 ? IDENTITY_LIGHT.counts : mute,
    };
  }

  const ink = theme?.ink && relativeLuminance(theme.ink) > 0.55 ? theme.ink : IDENTITY_DARK.ink;
  const mute = theme?.mute && relativeLuminance(theme.mute) > 0.4 ? theme.mute : IDENTITY_DARK.mute;
  return {
    ...IDENTITY_DARK,
    ink,
    mute,
    mist,
    paper,
    line: theme?.line ?? IDENTITY_DARK.line,
    action: theme?.action && relativeLuminance(theme.action) > 0.35 ? theme.action : IDENTITY_DARK.action,
    counts: mute,
  };
}
