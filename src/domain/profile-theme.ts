import type {
  ProfileAccentPreset,
  ProfileBackgroundPreset,
  ProfileThemeChoice,
  ProfileThemeMode,
  Room,
} from "./types";

export type ProfileScheme = "light" | "dark";

/**
 * Tokens the social shell consumes. Neutrals come from the background;
 * primary/secondary only tint actions and supporting accents.
 */
export interface ProfileThemeTokens {
  mode: ProfileThemeMode;
  scheme: ProfileScheme;
  paper: string;
  mist: string;
  ink: string;
  mute: string;
  line: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  action: string;
  onPrimary: string;
  secondary: string;
  secondarySoft: string;
  tint: string;
  like: string;
}

export const BACKGROUND_PRESETS: {
  id: ProfileBackgroundPreset;
  label: string;
  scheme: ProfileScheme;
  paper: string;
  mist: string;
  ink: string;
  mute: string;
  line: string;
}[] = [
  { id: "paper", label: "Seoully Paper", scheme: "light", paper: "#fffafb", mist: "#fff1f4", ink: "#2c2e4c", mute: "#8a7380", line: "#f3e4e9" },
  { id: "warm-cream", label: "Warm Cream", scheme: "light", paper: "#fbf6ee", mist: "#f3ebe0", ink: "#2b241c", mute: "#85786c", line: "#ebe3d6" },
  { id: "soft-lavender", label: "Soft Lavender", scheme: "light", paper: "#f7f2fb", mist: "#efe6f6", ink: "#261e2d", mute: "#7d7486", line: "#e7def0" },
  { id: "powder-pink", label: "Powder Pink", scheme: "light", paper: "#fdf6f8", mist: "#f8e8ef", ink: "#2b1e24", mute: "#86707a", line: "#f0dee6" },
  { id: "baby-blue", label: "Baby Blue", scheme: "light", paper: "#f6f9fd", mist: "#e8f0f8", ink: "#1c2430", mute: "#6d7886", line: "#dce6f0" },
  { id: "mint", label: "Mint", scheme: "light", paper: "#f5fbf7", mist: "#e6f3eb", ink: "#1c2a22", mute: "#6d7d72", line: "#d8e8de" },
  { id: "peach", label: "Peach", scheme: "light", paper: "#fdf7f2", mist: "#f6ebe3", ink: "#2b221c", mute: "#86746a", line: "#eedfd4" },
  { id: "soft-gray", label: "Soft Gray", scheme: "light", paper: "#f6f5f7", mist: "#eceaee", ink: "#222028", mute: "#75717c", line: "#e2e0e5" },
  { id: "deep-navy", label: "Deep Navy", scheme: "dark", paper: "#141a28", mist: "#1b2334", ink: "#eef2f8", mute: "#9aa6b8", line: "#2c3648" },
  { id: "midnight-purple", label: "Midnight Purple", scheme: "dark", paper: "#1a1524", mist: "#241c32", ink: "#f3eef8", mute: "#b4a6c4", line: "#3a3148" },
  { id: "dark-plum", label: "Dark Plum", scheme: "dark", paper: "#1f1520", mist: "#2a1c2c", ink: "#f7eef2", mute: "#c0a8b4", line: "#443248" },
  { id: "charcoal", label: "Charcoal", scheme: "dark", paper: "#18161b", mist: "#222026", ink: "#f2efe8", mute: "#b0aaa2", line: "#35323a" },
];

export const ACCENT_PRESETS: {
  id: ProfileAccentPreset;
  label: string;
  h: number;
  s: number;
}[] = [
  { id: "lavender", label: "Lavender", h: 278, s: 0.32 },
  { id: "lilac", label: "Lilac", h: 290, s: 0.3 },
  { id: "powder-pink", label: "Powder Pink", h: 340, s: 0.34 },
  { id: "baby-blue", label: "Baby Blue", h: 210, s: 0.3 },
  { id: "mint", label: "Mint", h: 145, s: 0.26 },
  { id: "peach", label: "Peach", h: 24, s: 0.36 },
  { id: "rose", label: "Rose", h: 350, s: 0.38 },
  { id: "periwinkle", label: "Periwinkle", h: 248, s: 0.32 },
  { id: "plum", label: "Plum", h: 312, s: 0.28 },
  { id: "deep-blue", label: "Deep Blue", h: 222, s: 0.34 },
  { id: "warm-cream", label: "Warm Cream", h: 38, s: 0.28 },
  { id: "soft-lilac", label: "Soft Lilac", h: 286, s: 0.28 },
];

const BACKGROUND_BY_ID = new Map(BACKGROUND_PRESETS.map((preset) => [preset.id, preset]));
const ACCENT_BY_ID = new Map(ACCENT_PRESETS.map((preset) => [preset.id, preset]));

/** Accents shown in Edit Profile. Legacy ids still resolve. */
export const ACCENT_PICKER = ACCENT_PRESETS.filter(
  (preset) => preset.id !== "warm-cream" && preset.id !== "soft-lilac",
);

export function accentSwatch(id: ProfileAccentPreset): string {
  const preset = ACCENT_BY_ID.get(id) ?? ACCENT_PRESETS[0]!;
  return hsl(preset.h, preset.s, 0.68);
}

export function backgroundFromLegacyTint(tint?: ProfileAccentPreset): ProfileBackgroundPreset {
  if (tint === "warm-cream" || tint === "peach") return "warm-cream";
  if (tint === "powder-pink") return "powder-pink";
  if (tint === "baby-blue") return "baby-blue";
  if (tint === "mint") return "mint";
  if (tint === "soft-lilac" || tint === "lavender") return "soft-lavender";
  return "paper";
}

export const DEFAULT_PROFILE_THEME: ProfileThemeTokens = {
  mode: "default",
  scheme: "light",
  paper: "#fffafb",
  mist: "#fff1f4",
  ink: "#2c2e4c",
  mute: "#8a7380",
  line: "#f3e4e9",
  primary: "#f6aebf",
  primaryDeep: "#c45374",
  primarySoft: "#ffe8ee",
  action: "#c45374",
  onPrimary: "#ffffff",
  secondary: "#ffc6d2",
  secondarySoft: "#fff0f3",
  tint: "#fff6f4",
  like: "#e56d90",
};

export function resolveProfileTheme(
  choice: ProfileThemeChoice | undefined,
  room: Room | undefined,
): ProfileThemeTokens {
  const mode = choice?.mode ?? "default";
  if (mode === "custom") return tokensFromCustom(choice);
  if (mode === "room-sync") return deriveFromRoom(room);
  return DEFAULT_PROFILE_THEME;
}

export function profileThemeVars(tokens: ProfileThemeTokens): Record<string, string> {
  return {
    "--s-paper": tokens.paper,
    "--s-mist": tokens.mist,
    "--s-paper-rgb": hexToRgbTriplet(tokens.paper),
    "--s-mist-rgb": hexToRgbTriplet(tokens.mist),
    "--s-ink": tokens.ink,
    "--s-mute": tokens.mute,
    "--s-line": tokens.line,
    "--s-lilac": tokens.primary,
    "--s-lilac-deep": tokens.primaryDeep,
    "--s-lilac-soft": tokens.primarySoft,
    "--s-action": tokens.action,
    "--s-on-primary": tokens.onPrimary,
    "--s-pink": tokens.secondary,
    "--s-pink-soft": tokens.secondarySoft,
    "--s-cream": tokens.tint,
    "--s-peach": tokens.tint,
    "--s-like": tokens.like,
  };
}

function tokensFromCustom(choice: ProfileThemeChoice | undefined): ProfileThemeTokens {
  const background =
    BACKGROUND_BY_ID.get(choice?.background ?? backgroundFromLegacyTint(choice?.tint)) ??
    BACKGROUND_PRESETS[0]!;
  const primary = accentFamily(choice?.primary ?? "lavender", background.scheme);
  const secondary = accentFamily(choice?.secondary ?? "powder-pink", background.scheme);
  return {
    mode: "custom",
    scheme: background.scheme,
    paper: background.paper,
    mist: background.mist,
    ink: background.ink,
    mute: background.mute,
    line: background.line,
    ...primary,
    secondary: secondary.primary,
    secondarySoft: secondary.primarySoft,
    tint: background.scheme === "dark" ? mixHex(background.paper, "#fff6ea", 0.08) : "#f8f3ea",
    like: secondary.action,
  };
}

function accentFamily(id: ProfileAccentPreset, scheme: ProfileScheme) {
  const preset = ACCENT_BY_ID.get(id) ?? ACCENT_PRESETS[0]!;
  if (scheme === "dark") {
    const primary = hsl(preset.h, preset.s, 0.74);
    const primaryDeep = hsl(preset.h, Math.min(preset.s + 0.04, 0.4), 0.8);
    const primarySoft = hsl(preset.h, 0.16, 0.2);
    const action = hsl(preset.h, Math.min(preset.s + 0.08, 0.42), 0.52);
    return { primary, primaryDeep, primarySoft, action, onPrimary: "#ffffff" };
  }
  const primary = hsl(preset.h, preset.s, 0.82);
  const primaryDeep = hsl(preset.h, Math.min(preset.s + 0.04, 0.36), 0.42);
  const primarySoft = hsl(preset.h, 0.18, 0.94);
  return { primary, primaryDeep, primarySoft, action: primaryDeep, onPrimary: "#ffffff" };
}

/**
 * Room → social identity. Dark rooms stay dark. Pastel rooms stay soft.
 * Never dumps the wall color across the whole profile.
 */
function deriveFromRoom(room: Room | undefined): ProfileThemeTokens {
  if (!room) return { ...DEFAULT_PROFILE_THEME, mode: "room-sync" };
  const wall = readHsl(room.theme.wall);
  const fill = readHsl(room.theme.light.fill);
  const lamp = readHsl(room.theme.light.color);
  const edge = readHsl(room.theme.furnitureEdge);
  const accent = readHsl(room.theme.wallAccent);
  const dark = isDarkRoom(room, wall);

  const primarySrc = fill ?? edge ?? lamp ?? wall ?? { h: 278, s: 0.28, l: 0.5 };
  const secondarySrc =
    [lamp, fill, edge, accent].find((color) => color && hueDistance(color.h, primarySrc.h) > 24) ??
    rotateHue(primarySrc, 36);

  if (dark) {
    const paper = toHex({ h: wall?.h ?? 300, s: clamp((wall?.s ?? 0.12) * 0.7, 0.06, 0.18), l: clamp(wall?.l ?? 0.14, 0.1, 0.18) });
    const mist = toHex({ h: wall?.h ?? 300, s: 0.12, l: 0.16 });
    const inkHsl = readHsl(room.theme.ink);
    const ink = inkHsl && inkHsl.l > 0.55 ? room.theme.ink : "#f3eef6";
    const mute = room.theme.inkSoft || "#b4a8bc";
    const primary = toHex({ h: primarySrc.h, s: clamp(primarySrc.s, 0.18, 0.36), l: 0.74 });
    const primaryDeep = toHex({ h: primarySrc.h, s: clamp(primarySrc.s, 0.16, 0.34), l: 0.8 });
    const action = toHex({ h: primarySrc.h, s: clamp(primarySrc.s + 0.04, 0.2, 0.4), l: 0.5 });
    const secondary = toHex({ h: secondarySrc.h, s: clamp(secondarySrc.s, 0.16, 0.34), l: 0.72 });
    return {
      mode: "room-sync",
      scheme: "dark",
      paper,
      mist,
      ink,
      mute,
      line: toHex({ h: wall?.h ?? 300, s: 0.1, l: 0.26 }),
      primary,
      primaryDeep,
      primarySoft: toHex({ h: primarySrc.h, s: 0.14, l: 0.2 }),
      action,
      onPrimary: "#ffffff",
      secondary,
      secondarySoft: toHex({ h: secondarySrc.h, s: 0.14, l: 0.22 }),
      tint: mist,
      like: secondary,
    };
  }

  const paperH = accent ?? wall ?? { h: 300, s: 0.08, l: 0.96 };
  const paper = toHex({ h: paperH.h, s: clamp(paperH.s * 0.35, 0.04, 0.12), l: 0.97 });
  const family = (src: Hsl) => accentFamilyFromHsl(src, "light");
  const primary = family(primarySrc);
  const secondary = family(secondarySrc);
  return {
    mode: "room-sync",
    scheme: "light",
    paper,
    mist: toHex({ h: paperH.h, s: 0.08, l: 0.94 }),
    ink: "#241e2b",
    mute: "#7d7486",
    line: toHex({ h: paperH.h, s: 0.08, l: 0.9 }),
    ...primary,
    secondary: secondary.primary,
    secondarySoft: secondary.primarySoft,
    tint: "#f8f3ea",
    like: secondary.action,
  };
}

function isDarkRoom(room: Room, wall: Hsl | null): boolean {
  if (room.aesthetic === "nocturne") return true;
  if (room.aesthetic === "maximalist") return false;
  const floor = readHsl(room.theme.floor);
  const furniture = readHsl(room.theme.furniture);
  const avg = [wall?.l, floor?.l, furniture?.l].filter((value): value is number => value !== undefined);
  if (avg.length === 0) return false;
  return avg.reduce((sum, value) => sum + value, 0) / avg.length < 0.42;
}

function accentFamilyFromHsl(src: Hsl, scheme: ProfileScheme) {
  return accentFamily(nearestAccent(src.h), scheme);
}

function nearestAccent(h: number): ProfileAccentPreset {
  let best = ACCENT_PRESETS[0]!;
  let bestDist = 360;
  for (const preset of ACCENT_PRESETS) {
    const dist = hueDistance(h, preset.h);
    if (dist < bestDist) {
      best = preset;
      bestDist = dist;
    }
  }
  return best.id;
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function rotateHue(color: Hsl, degrees: number): Hsl {
  return { ...color, h: (color.h + degrees + 360) % 360 };
}

function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function hsl(h: number, s: number, l: number): string {
  return toHex({ h, s, l });
}

function readHsl(hex: string | undefined): Hsl | null {
  if (!hex) return null;
  const rgb = parseHex(hex);
  if (!rgb) return null;
  return rgbToHsl(rgb[0], rgb[1], rgb[2]);
}

function hexToRgbTriplet(hex: string): string {
  const rgb = parseHex(hex);
  if (!rgb) return "255, 241, 244";
  return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
}

function parseHex(hex: string): [number, number, number] | null {
  const value = hex.trim().replace("#", "");
  if (value.length !== 6) return null;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
  else if (max === gg) h = (bb - rr) / d + 2;
  else h = (rr - gg) / d + 4;
  return { h: h * 60, s, l };
}

function toHex(color: Hsl): string {
  const [r, g, b] = hslToRgb(color.h, color.s, color.l);
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const hue = (((h % 360) + 360) % 360) / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, hue) * 255),
    Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  ];
}

function hueToRgb(p: number, q: number, t: number): number {
  let tone = t;
  if (tone < 0) tone += 1;
  if (tone > 1) tone -= 1;
  if (tone < 1 / 6) return p + (q - p) * 6 * tone;
  if (tone < 1 / 2) return q;
  if (tone < 2 / 3) return p + (q - p) * (2 / 3 - tone) * 6;
  return p;
}

function mixHex(a: string, b: string, amount: number): string {
  const left = parseHex(a);
  const right = parseHex(b);
  if (!left || !right) return a;
  const mix = (i: number) => Math.round(left[i]! * (1 - amount) + right[i]! * amount);
  return `#${[mix(0), mix(1), mix(2)].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
