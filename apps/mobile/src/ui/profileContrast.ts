import { PROFILE_VEIL, colors } from "../theme";

/**
 * Collector / Profile Appearance tokens. Mirrors web `ProfileThemeTokens`
 * after `profileThemeVars` (`--s-paper`, `--s-lilac`, `--s-action`, …).
 */
export type ContrastTheme = {
  scheme: "light" | "dark";
  paper: string;
  mist: string;
  ink: string;
  mute: string;
  line?: string;
  action?: string;
  primary?: string;
  primaryDeep?: string;
  primarySoft?: string;
  onPrimary?: string;
  secondary?: string;
  secondarySoft?: string;
  cream?: string;
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
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  onPrimary: string;
  secondary: string;
  secondarySoft: string;
  cream: string;
};

/** Web default identity tokens (`DEFAULT_PROFILE_THEME` / `--s-*`). */
export const IDENTITY_LIGHT: IdentityPalette = {
  scheme: "light",
  ink: "#2c2e4c",
  mute: "#8a7380",
  paper: "#fffafb",
  mist: "#fff1f4",
  line: "#f3e4e9",
  action: "#c45374",
  counts: "#555555",
  primary: "#f6aebf",
  primaryDeep: "#c45374",
  primarySoft: "#ffe8ee",
  onPrimary: "#ffffff",
  secondary: "#ffc6d2",
  secondarySoft: "#fff0f3",
  cream: "#fff6f4",
};

/**
 * Web dark / room-sync identity. Ink is compensated (`deriveFromRoom` falls
 * back to #f3eef6 when room ink is too dark). Control tokens match the
 * midnight-purple + lavender accent family — not generic Seoully pink/white.
 */
export const IDENTITY_DARK: IdentityPalette = {
  scheme: "dark",
  ink: "#f3eef6",
  mute: "#b4a8bc",
  paper: "#1a1524",
  mist: "#241c32",
  line: "#3a3148",
  action: "#9254b6",
  counts: "#c8c0d0",
  primary: "#c2a7d2",
  primaryDeep: "#d1bade",
  primarySoft: "#352b3b",
  onPrimary: "#ffffff",
  secondary: "#d3a6b5",
  secondarySoft: "#412f35",
  cream: "#241c32",
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

/** Veil over the current Room glimpse. Native `PROFILE_VEIL` is 0.80. */
export function veiledSurface(mist: string, roomVoid = HEARTH_VOID, veil = PROFILE_VEIL): string {
  const dimmedRoom = mixHex("#120c10", roomVoid, 0.28);
  return mixHex(mist, dimmedRoom, veil);
}

export function identityIsReadable(palette: IdentityPalette, roomVoid = HEARTH_VOID): boolean {
  const surface = palette.scheme === "dark" ? veiledSurface(palette.mist, roomVoid) : palette.mist;
  return contrastRatio(palette.ink, surface) >= 4.5 && contrastRatio(palette.mute, surface) >= 3;
}

function pickSoft(candidate: string | undefined, dark: boolean, fallback: string): string {
  if (!candidate) return fallback;
  const luminance = relativeLuminance(candidate);
  return dark ? (luminance < 0.35 ? candidate : fallback) : (luminance > 0.7 ? candidate : fallback);
}

function pickAgainst(candidate: string | undefined, surface: string, fallback: string, min: number): string {
  return candidate && contrastRatio(candidate, surface) >= min ? candidate : fallback;
}

function pickFill(candidate: string | undefined, onFill: string, fallback: string): string {
  return candidate && contrastRatio(onFill, candidate) >= 4.5 ? candidate : fallback;
}

function readableChipInk(ink: string, secondary: string, surface: string, fallback: string, amount: number): string {
  const mixed = mixHex(ink, secondary, amount);
  if (contrastRatio(mixed, surface) >= 4.5) return mixed;
  if (contrastRatio(ink, surface) >= 4.5) return ink;
  return fallback;
}

/**
 * Web `.s-btn` / `.s-chip` / `.s-enter` / `.s-highlight` mixes against
 * `--s-lilac`, `--s-line`, `--s-pink`, `--s-cream`.
 */
export function profileControlSurfaces(palette: IdentityPalette) {
  return {
    actionBorder: mixHex(palette.action, palette.paper, 0.82),
    ghostBorder: mixHex(palette.primary, palette.line, 0.4),
    enterBorder: mixHex(palette.primary, palette.line, 0.55),
    highlightBorder: mixHex(palette.cream, palette.line, 0.55),
    chipBiasInk: readableChipInk(palette.ink, palette.secondary, palette.secondarySoft, palette.primaryDeep, 0.72),
    chipTypeInk: readableChipInk(palette.ink, palette.secondary, palette.secondarySoft, palette.primaryDeep, 0.65),
  };
}

/**
 * Web `.s-nav` sits on themed mist (`background: transparent` + `--s-line`).
 * Tabs / `.s-nav-tab.is-on` / `.s-nav-create` map to lilac-soft / lilac-deep / mute.
 */
export function profileTabChrome(palette: IdentityPalette) {
  const icon = 3;
  const inactive = contrastRatio(palette.mute, palette.mist) >= icon ? palette.mute : palette.ink;
  const active = contrastRatio(palette.primaryDeep, palette.primarySoft) >= icon
    ? palette.primaryDeep
    : (contrastRatio(palette.ink, palette.primarySoft) >= icon ? palette.ink : palette.onPrimary);
  const createOnBg = contrastRatio(palette.onPrimary, palette.primary) >= icon
    ? palette.primary
    : palette.action;
  const createOnFg = contrastRatio(palette.onPrimary, createOnBg) >= icon
    ? palette.onPrimary
    : palette.ink;
  return {
    bar: palette.mist,
    border: palette.line,
    inactive,
    active,
    activeBg: palette.primarySoft,
    createBg: palette.primarySoft,
    createFg: active,
    createBorder: mixHex(palette.primary, palette.scheme === "dark" ? palette.line : "#ffffff", 0.45),
    createOnBg,
    createOnFg,
  };
}

/**
 * Deterministic Profile identity + control colors.
 * Room/theme may tint surfaces. Foreground is contrast-validated, never raw Room ink.
 * Control tokens stay theme-derived (web Appearance / Room Sync), not generic Seoully pink/white.
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
  const base = dark ? IDENTITY_DARK : IDENTITY_LIGHT;

  const ink = dark
    ? (theme?.ink && relativeLuminance(theme.ink) > 0.55 ? theme.ink : IDENTITY_DARK.ink)
    : (theme?.ink && relativeLuminance(theme.ink) < 0.45 ? theme.ink : IDENTITY_LIGHT.ink);
  const mute = dark
    ? (theme?.mute && relativeLuminance(theme.mute) > 0.4 ? theme.mute : IDENTITY_DARK.mute)
    : (theme?.mute && contrastRatio(theme.mute, surface) >= 3 ? theme.mute : IDENTITY_LIGHT.mute);
  const line = theme?.line ?? base.line;
  const onPrimary = theme?.onPrimary && theme.action && contrastRatio(theme.onPrimary, theme.action) >= 4.5
    ? theme.onPrimary
    : base.onPrimary;
  const action = pickFill(theme?.action, onPrimary, base.action);
  const primarySoft = pickSoft(theme?.primarySoft, dark, base.primarySoft);
  const secondarySoft = pickSoft(theme?.secondarySoft, dark, base.secondarySoft);
  const primaryDeep = pickAgainst(theme?.primaryDeep, primarySoft, base.primaryDeep, 4.5);
  const primary = theme?.primary ?? base.primary;
  const secondary = theme?.secondary ?? base.secondary;
  const creamCandidate = theme?.cream ?? base.cream;
  const cream = contrastRatio(ink, creamCandidate) >= 4.5 ? creamCandidate : (dark ? mist : paper);
  const counts = dark
    ? mute
    : (contrastRatio(IDENTITY_LIGHT.counts, surface) >= 4.5 ? IDENTITY_LIGHT.counts : mute);

  return {
    scheme: dark ? "dark" : "light",
    ink,
    mute,
    mist,
    paper,
    line,
    action,
    counts,
    primary,
    primaryDeep,
    primarySoft,
    onPrimary,
    secondary,
    secondarySoft,
    cream,
  };
}
