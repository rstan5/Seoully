/**
 * Native Seoully tokens derived from `src/design/social-app.css`.
 * Pastel is accent, not a wash. Existing `colors` / `spacing` keys stay so
 * other screens keep compiling while Feed and chrome adopt the social system.
 */
/**
 * Native Profile wash over the Room glimpse. Web `--s-profile-veil` is 0.85;
 * native is 0.80 so slightly more Room shows through. Profile UI stays fully
 * opaque. Do not apply this as component `opacity` — text/images/buttons stay solid.
 */
export const PROFILE_VEIL = 0.80;

export const colors = {
  ink: "#2c2e4c",
  muted: "#8a7380",
  canvas: "#fff7fa",
  surface: "#fffafb",
  elevated: "#fffafb",
  blush: "#ffe8ee",
  plum: "#c45374",
  border: "#f3e4e9",
  mist: "#fff1f4",
  lilac: "#f6aebf",
  lilacSoft: "#ffe8ee",
  pink: "#ffc6d2",
  pinkSoft: "#fff0f3",
  peach: "#ffe8e4",
  cream: "#fff6f4",
  blueSoft: "#eef3fb",
  mintSoft: "#e8f3ec",
  like: "#e56d90",
  action: "#c45374",
  onPrimary: "#ffffff",
  media: "#1a1620",
  repost: "#3d8f6e",
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 36,
  gutter: 16,
  post: 14,
  inline: 10,
  compact: 6,
} as const;

export type TypeFace = "regular" | "semibold" | "bold";

/** Named files from @expo-google-fonts. Do not also set fontWeight — iOS will miss the face. */
export const faces = {
  en: {
    regular: "Baloo2_400Regular",
    semibold: "Baloo2_600SemiBold",
    bold: "Baloo2_700Bold",
  },
  ko: {
    regular: "NotoSansKR_400Regular",
    semibold: "NotoSansKR_600SemiBold",
    bold: "NotoSansKR_700Bold",
  },
} as const;

export const type = {
  display: { fontSize: 20, letterSpacing: -0.8, lineHeight: 24, face: "bold" as const },
  title: { fontSize: 22, letterSpacing: -0.6, lineHeight: 26, face: "bold" as const },
  section: { fontSize: 13, letterSpacing: 0.4, lineHeight: 16, face: "bold" as const },
  body: { fontSize: 14, lineHeight: 20, face: "regular" as const },
  secondary: { fontSize: 14, lineHeight: 20, face: "regular" as const },
  caption: { fontSize: 12, lineHeight: 16, face: "regular" as const },
  button: { fontSize: 14, letterSpacing: -0.2, lineHeight: 18, face: "semibold" as const },
  metadata: { fontSize: 12, lineHeight: 16, face: "regular" as const },
  handle: { fontSize: 14, letterSpacing: -0.2, lineHeight: 18, face: "semibold" as const },
} as const;

export const radii = {
  card: 14,
  button: 12,
  input: 14,
  pill: 999,
  avatar: 999,
  nav: 14,
  create: 12,
} as const;

export const sizes = {
  avatarSm: 36,
  avatarMd: 56,
  iconButton: 40,
  tab: 48,
  create: 42,
  topBar: 52,
  tabBar: 58,
  companion: 44,
  control: 44,
  mediaRadius: 14,
} as const;

export const elevation = {
  card: {
    shadowColor: "#2c2e4c",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  raise: {
    shadowColor: "#2c2e4c",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;

export const motion = {
  duration: 140,
  pressOffset: 1,
} as const;

export const avatarPalette = ["#f6aebf", "#ffc6d2", "#ffe8e4", "#d5e4f2", "#ffe8ee"] as const;
