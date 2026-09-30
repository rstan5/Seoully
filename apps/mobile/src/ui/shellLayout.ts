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

const TAB_SURFACES = new Set(["", "index", "search", "create", "messages", "profile", "notices", "send-to"]);
const STACK_SURFACES = new Set([
  "onboarding",
  "room",
  "collector-room",
  "collect",
  "add",
  "collectible",
  "collection",
  "collector",
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

/** Bottom tab bar is visible on the five social peers (and hidden tab routes). */
export function routeShowsBottomNav(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const leaf = nativePathLeaf(normalized);
  if (STACK_SURFACES.has(leaf)) return false;
  if (normalized === "/" || normalized === "/(tabs)" || normalized.startsWith("/(tabs)/") || normalized === "/(tabs)") {
    return leaf !== "room";
  }
  return TAB_SURFACES.has(leaf);
}

export type EdgeInsets = { top: number; right: number; bottom: number; left: number };

/** One companion placement for every surface. Room-specific docking is Slice 7. */
export function companionPlacement(input: { insets: EdgeInsets; hasBottomNav: boolean }) {
  const aboveChrome = input.hasBottomNav
    ? chrome.tabBarContent + chrome.companionClearance
    : chrome.companionClearance;
  return {
    bottom: input.insets.bottom + aboveChrome,
    right: input.insets.right + chrome.gutter,
  };
}
