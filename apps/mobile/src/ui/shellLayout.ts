import { sizes } from "../theme";

/**
 * Shared native shell metrics. Web `.s-top` is 52px / 16px gutter.
 * Insets come from react-native-safe-area-context — never hard-code a device.
 */
export const chrome = {
  gutter: 16,
  headerHeight: sizes.topBar,
  tabBarContent: sizes.tabBar,
  companionSize: sizes.companion,
  companionClearance: 16,
} as const;

const TAB_SURFACES = new Set(["", "index", "search", "create", "messages", "profile", "notices", "send-to", "collector"]);
const STACK_SURFACES = new Set([
  "onboarding",
  "room",
  "collector-room",
  "collect",
  "add",
  "collectible",
  "collection",
  "edit-profile",
  "thread",
  "binder",
  "public-collectible",
]);

export function nativePathLeaf(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "(tabs)") return parts[1] ?? "index";
  return parts[0] ?? "";
}

/** Bottom tab bar is visible on the five social peers and hidden social screens (collector profile). Room is immersive. */
export function routeShowsBottomNav(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const leaf = nativePathLeaf(normalized);
  if (leaf === "room" || leaf === "collector-room") return false;
  if (STACK_SURFACES.has(leaf)) return false;
  if (normalized === "/" || normalized === "/(tabs)" || normalized.startsWith("/(tabs)/")) {
    return TAB_SURFACES.has(leaf) || leaf === "index";
  }
  return TAB_SURFACES.has(leaf);
}

/** Keep published Profile chrome through the visible Profile/collector → Room transition. */
export function identityPublicationSurvives(pathname: string): boolean {
  const leaf = nativePathLeaf(pathname);
  return leaf === "profile" || leaf === "collector" || leaf === "room" || leaf === "collector-room";
}

export type EdgeInsets = { top: number; right: number; bottom: number; left: number };

/** One companion. Immersive Room uses safe-area + gutter only — no tab-bar clearance. */
export function companionPlacement(input: { insets: EdgeInsets; hasBottomNav: boolean }) {
  const aboveChrome = input.hasBottomNav
    ? chrome.tabBarContent + chrome.companionClearance
    : chrome.companionClearance;
  return {
    bottom: input.insets.bottom + aboveChrome,
    right: input.insets.right + chrome.gutter,
  };
}
