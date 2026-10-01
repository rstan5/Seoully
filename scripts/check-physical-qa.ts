import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  parseOnboardingStep,
  resolveAuthDestination,
  runStartupBootstrap,
} from "../apps/mobile/src/startup/eligibility";
import {
  AUTH_ROUTE_OWNER,
  childLayoutMayRedirect,
  destinationAfterSignOut,
  screensForDestination,
  transitionAuthRoute,
} from "../apps/mobile/src/startup/routing";
import {
  IDENTITY_DARK,
  IDENTITY_LIGHT,
  contrastRatio,
  identityIsReadable,
  identityPalette,
  profileControlSurfaces,
  profileTabChrome,
  relativeLuminance,
} from "../apps/mobile/src/ui/profileContrast";
import { chrome, companionPlacement, routeShowsBottomNav } from "../apps/mobile/src/ui/shellLayout";

const repoRoot = process.cwd();
function read(rel: string) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}
function assertContains(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), `${label} missing ${JSON.stringify(needle)}`);
}
function assertNotContains(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), `${label} unexpectedly contains ${JSON.stringify(needle)}`);
}

const root = read("apps/mobile/app/_layout.tsx");
const gated = read("apps/mobile/src/startup/AuthRouteTree.tsx");
const tabs = read("apps/mobile/app/(tabs)/_layout.tsx");
const index = read("apps/mobile/app/index.tsx");
const profile = read("apps/mobile/app/(tabs)/profile.tsx");
const edit = read("apps/mobile/app/edit-profile.tsx");
const bootstrap = read("apps/mobile/src/startup/BootstrapProvider.tsx");
const eligibility = read("apps/mobile/src/startup/eligibility.ts");
const onboardingRoute = read("src/app/api/mobile/onboarding/route.ts");
const migration = read("supabase/migrations/20260930000000_native_onboarding_progress.sql");

async function main() {
  // K. One routing owner
  assert.equal(AUTH_ROUTE_OWNER, "root-stack-protected");
assertContains(root, "AuthRouteTree", "root owns gated stack");
assertContains(gated, "Stack.Protected", "structural route gating");
assertContains(gated, "AUTH_ROUTE_OWNER", "owner marker");
assertNotContains(tabs, "Redirect", "tabs do not redirect");
assertNotContains(index, "Redirect", "welcome does not redirect");
assert.equal(childLayoutMayRedirect("welcome"), false);
assert.equal(childLayoutMayRedirect("app"), false);

// A. Sign out: app → welcome exactly once, tabs unmount
const signedIn = screensForDestination("app");
assert.equal(signedIn.app, true);
assert.equal(signedIn.welcome, false);
const signedOut = screensForDestination(destinationAfterSignOut());
assert.equal(signedOut.welcome, true);
assert.equal(signedOut.app, false);
assert.equal(signedOut.onboarding, false);
const signOutHop = transitionAuthRoute("app", "sign-out");
assert.equal(signOutHop.destination, "welcome");
assert.equal(signOutHop.visitsWelcome, 1);
assertContains(bootstrap, 'event !== "SIGNED_OUT"', "sign-out updates bootstrap");
assertNotContains(profile, 'router.replace("/")', "profile sign-out does not replace from the tabs tree");
assertNotContains(edit, 'router.replace("/")', "edit sign-out does not replace from the app tree");
assertNotContains(gated, "router.replace", "gate does not replace from render");
assertNotContains(tabs, "router.replace", "tabs do not replace from render");

// B. Sign back in
const signInDone = transitionAuthRoute("welcome", "sign-in-complete");
assert.equal(signInDone.destination, "app");
assert.equal(signInDone.visitsApp, 1);
assertContains(index, "boot.refresh", "sign-in re-bootstraps");
assertContains(index, "signInWithPassword", "password sign-in");

// C. Session restore
const restore = transitionAuthRoute("loading", "restore-complete");
assert.equal(restore.destination, "app");
assertContains(bootstrap, "auth restore", "session restore tracing");
assertContains(read("apps/mobile/src/startup/BootstrapProvider.tsx"), "getSession", "secure session restore");

// D. New / incomplete user
assert.equal(resolveAuthDestination({ authenticated: true, onboardingStep: "group" }), "onboarding");
assert.equal(resolveAuthDestination({ authenticated: true, onboardingStep: "bias" }), "onboarding");
assert.equal(resolveAuthDestination({ authenticated: true, onboardingStep: "interest" }), "onboarding");
assert.equal((await runStartupBootstrap({
  authConfigured: true,
  productApiConfigured: true,
  restoreSession: async () => "signed_in",
  loadOnboarding: async () => ({ step: "group" }),
})).destination, "onboarding");

// E. Complete user
assert.equal(resolveAuthDestination({ authenticated: true, onboardingStep: "done" }), "app");
assert.equal((await runStartupBootstrap({
  authConfigured: true,
  productApiConfigured: true,
  restoreSession: async () => "signed_in",
  loadOnboarding: async () => ({ step: "done" }),
})).destination, "app");

// F. Profile existence is not a shortcut
assert.equal(resolveAuthDestination({
  authenticated: true,
  onboardingStep: "group",
  profileExists: true,
}), "onboarding");
assert.equal(parseOnboardingStep("done"), "done");
assert.equal(parseOnboardingStep("group"), "group");
assert.equal(parseOnboardingStep({ id: "profile" }), null);
assertContains(onboardingRoute, "data.onboarding_step", "live step comes from profiles.onboarding_step");
assertContains(migration, "Existing profiles predate the native flow and are treated as complete", "backfill documented");
assertContains(migration, "default 'done'", "pre-native backfill default");
assertContains(migration, "default 'group'", "new accounts start at group");

// G. Demo cannot determine Live destination
assert.equal(resolveAuthDestination({
  authenticated: true,
  onboardingStep: "group",
  demoOnboardingStep: "done",
}), "onboarding");
assertNotContains(bootstrap, "demo/repository", "bootstrap ignores Demo fixtures");
assertNotContains(eligibility, "demo/repository", "eligibility ignores Demo fixtures");
assertContains(read("apps/mobile/app/onboarding.tsx"), "setDemo(false)", "first-run stays Live");

// H. Dark profile
const dark = identityPalette({
  scheme: "dark",
  paper: "#141a28",
  mist: "#1b2334",
  ink: "#eef2f8",
  mute: "#9aa6b8",
  line: "#2c3648",
  action: "#c45374",
});
assert.equal(dark.scheme, "dark");
assert.ok(relativeLuminance(dark.ink) > 0.55, "dark aesthetic uses light ink");
assert.ok(identityIsReadable(dark), "dark identity meets contrast");

// I. Light profile
const light = identityPalette({
  scheme: "light",
  paper: "#fffafb",
  mist: "#fff1f4",
  ink: "#2c2e4c",
  mute: "#8a7380",
});
assert.equal(light.scheme, "light");
assert.ok(relativeLuminance(light.ink) < 0.45, "light aesthetic uses dark ink");
assert.ok(identityIsReadable(light), "light identity meets contrast");
assert.equal(identityPalette(undefined).ink, IDENTITY_LIGHT.ink);

// J. Room Sync cannot produce unreadable text even if Room ink is navy
const roomSyncBrokenInk = identityPalette({
  scheme: "dark",
  paper: "#1a1524",
  mist: "#241c32",
  ink: "#2c2e4c",
  mute: "#3a3148",
});
assert.equal(roomSyncBrokenInk.scheme, "dark");
assert.ok(relativeLuminance(roomSyncBrokenInk.ink) > 0.55, "room-sync compensates dark ink");
assert.ok(identityIsReadable(roomSyncBrokenInk), "room-sync remains readable");
assert.ok(contrastRatio(roomSyncBrokenInk.ink, roomSyncBrokenInk.mist) >= 4.5);
assert.notEqual(roomSyncBrokenInk.ink, IDENTITY_LIGHT.ink);

const pink = identityPalette({
  scheme: "light",
  paper: "#fdf6f8",
  mist: "#f8e8ef",
  ink: "#2b1e24",
  mute: "#86707a",
});
assert.ok(identityIsReadable(pink));
const lavender = identityPalette({
  scheme: "light",
  paper: "#f7f2fb",
  mist: "#efe6f6",
  ink: "#261e2d",
  mute: "#7d7486",
});
assert.ok(identityIsReadable(lavender));
assert.equal(roomSyncBrokenInk.ink, IDENTITY_DARK.ink);

const unset = identityPalette(undefined);
assert.equal(unset.primarySoft, IDENTITY_LIGHT.primarySoft);
assert.equal(unset.action, IDENTITY_LIGHT.action);
assert.equal(unset.paper, IDENTITY_LIGHT.paper);
assert.ok(relativeLuminance(dark.primarySoft) < 0.35, "dark controls are not generic pale pink");
assert.notEqual(dark.primarySoft, IDENTITY_LIGHT.primarySoft);
assert.ok(contrastRatio(dark.onPrimary, dark.action) >= 4.5, "dark primary fill keeps on-primary contrast");
assert.ok(contrastRatio(dark.primaryDeep, dark.primarySoft) >= 4.5, "dark ghost pair stays readable");

const roomSync = identityPalette({
  scheme: "dark",
  paper: "#1a1524",
  mist: "#241c32",
  ink: "#f3eef6",
  mute: "#b4a8bc",
  line: "#3a3148",
  primary: "#c2a7d2",
  primaryDeep: "#d1bade",
  primarySoft: "#352b3b",
  action: "#9254b6",
  onPrimary: "#ffffff",
  secondary: "#d3a6b5",
  secondarySoft: "#412f35",
  cream: "#241c32",
});
assert.equal(roomSync.primarySoft, "#352b3b");
assert.equal(roomSync.action, "#9254b6");
assert.ok(relativeLuminance(roomSync.paper) < 0.2, "room-sync enter surface stays dark");

const rejectedPaleGhost = identityPalette({
  scheme: "dark",
  paper: "#1a1524",
  mist: "#241c32",
  ink: "#f3eef6",
  mute: "#b4a8bc",
  primarySoft: "#ffe8ee",
  primaryDeep: "#c45374",
});
assert.equal(rejectedPaleGhost.primarySoft, IDENTITY_DARK.primarySoft);

const pinkTheme = identityPalette({
  scheme: "light",
  paper: "#fdf6f8",
  mist: "#f8e8ef",
  ink: "#2b1e24",
  mute: "#86707a",
  line: "#f0dee6",
  primary: "#e1c1cc",
  primaryDeep: "#92455e",
  primarySoft: "#f2edef",
  action: "#92455e",
  onPrimary: "#ffffff",
  secondary: "#d5c2e0",
  secondarySoft: "#f0edf2",
  cream: "#f8f3ea",
});
assert.equal(pinkTheme.primaryDeep, "#92455e");
assert.notEqual(pinkTheme.paper, IDENTITY_LIGHT.paper);
assert.ok(identityIsReadable(pinkTheme));
assert.ok(contrastRatio(pinkTheme.primaryDeep, pinkTheme.primarySoft) >= 4.5);

const lavenderTheme = identityPalette({
  scheme: "light",
  paper: "#f7f2fb",
  mist: "#efe6f6",
  ink: "#261e2d",
  mute: "#7d7486",
  line: "#e7def0",
  primary: "#d5c2e0",
  primaryDeep: "#754592",
  primarySoft: "#f0edf2",
  action: "#754592",
  onPrimary: "#ffffff",
  secondary: "#e1c1cc",
  secondarySoft: "#f2edef",
  cream: "#f8f3ea",
});
assert.equal(lavenderTheme.primaryDeep, "#754592");
assert.notEqual(lavenderTheme.primarySoft, pinkTheme.primarySoft);
assert.ok(identityIsReadable(lavenderTheme));

const saturated = identityPalette({
  scheme: "dark",
  paper: "#1f1520",
  mist: "#2a1c2c",
  ink: "#f7eef2",
  mute: "#c0a8b4",
  line: "#443248",
  primary: "#d6a4ac",
  primaryDeep: "#e0b8be",
  primarySoft: "#3b2b2e",
  action: "#b85162",
  onPrimary: "#ffffff",
  secondary: "#c2a7d2",
  secondarySoft: "#352b3b",
  cream: "#2a1c2c",
});
assert.equal(saturated.action, "#b85162");
assert.ok(relativeLuminance(saturated.primarySoft) < 0.35);
assert.ok(identityIsReadable(saturated));
assert.ok(contrastRatio(saturated.onPrimary, saturated.action) >= 4.5);
const surfaces = profileControlSurfaces(roomSync);
assert.notEqual(surfaces.ghostBorder, IDENTITY_LIGHT.line);
assert.ok(contrastRatio(surfaces.chipBiasInk, roomSync.secondarySoft) >= 4.5);

const defaultTabs = profileTabChrome(unset);
assert.equal(defaultTabs.bar, IDENTITY_LIGHT.mist);
assert.equal(defaultTabs.border, IDENTITY_LIGHT.line);
assert.equal(defaultTabs.inactive, IDENTITY_LIGHT.mute);
assert.equal(defaultTabs.active, IDENTITY_LIGHT.primaryDeep);
assert.equal(defaultTabs.activeBg, IDENTITY_LIGHT.primarySoft);
assert.ok(contrastRatio(defaultTabs.inactive, defaultTabs.bar) >= 3);
assert.ok(contrastRatio(defaultTabs.active, defaultTabs.activeBg) >= 3);

const darkTabs = profileTabChrome(roomSync);
assert.equal(darkTabs.bar, roomSync.mist);
assert.ok(relativeLuminance(darkTabs.bar) < 0.2, "dark profile tab bar is not a cream slab");
assert.notEqual(darkTabs.bar, IDENTITY_LIGHT.mist);
assert.ok(contrastRatio(darkTabs.inactive, darkTabs.bar) >= 3);
assert.ok(contrastRatio(darkTabs.active, darkTabs.activeBg) >= 3);
assert.ok(contrastRatio(darkTabs.createOnFg, darkTabs.createOnBg) >= 3);

const pinkTabs = profileTabChrome(pinkTheme);
assert.equal(pinkTabs.bar, pinkTheme.mist);
assert.notEqual(pinkTabs.active, darkTabs.active);
assert.ok(contrastRatio(pinkTabs.inactive, pinkTabs.bar) >= 3);
assert.ok(contrastRatio(pinkTabs.active, pinkTabs.activeBg) >= 3);

const lavenderTabs = profileTabChrome(lavenderTheme);
assert.equal(lavenderTabs.bar, lavenderTheme.mist);
assert.notEqual(lavenderTabs.activeBg, pinkTabs.activeBg);
assert.ok(contrastRatio(lavenderTabs.active, lavenderTabs.activeBg) >= 3);

const saturatedTabs = profileTabChrome(saturated);
assert.ok(relativeLuminance(saturatedTabs.bar) < 0.2);
assert.ok(contrastRatio(saturatedTabs.inactive, saturatedTabs.bar) >= 3);
assert.ok(contrastRatio(saturatedTabs.createFg, saturatedTabs.createBg) >= 3);

assertContains(profile, "identityPalette", "profile uses contrast palette");
assertContains(profile, "ProfileIdentityProvider", "profile identity context");
assertContains(profile, "usePublishProfileIdentity", "profile publishes identity to tab chrome");
assertContains(profile, "palette.primaryDeep", "profile links use theme accent");
assertContains(read("apps/mobile/app/(tabs)/_layout.tsx"), "ProfileIdentityScope", "tabs shell owns published identity");
assertContains(read("apps/mobile/src/ui/SeoullyTabBar.tsx"), "usePublishedProfileIdentity", "tab bar reads published identity");
assertContains(read("apps/mobile/src/ui/SeoullyTabBar.tsx"), "profileTabChrome", "tab bar uses shared identity tokens");
assertContains(read("apps/mobile/src/ui/ProfileIdentity.tsx"), "return () => publish(null)", "leaving profile clears tab chrome");
assertContains(read("apps/mobile/src/ui/ProfileIdentity.tsx"), "return useContext(ProfileIdentityContext);", "screen identity stays local");
assertContains(read("apps/mobile/src/ui/ProfileIdentity.tsx"), "return useContext(PublishedIdentityContext);", "tab chrome has a separate reader");
assertNotContains(read("apps/mobile/app/(tabs)/index.tsx"), "usePublishProfileIdentity", "discover does not publish profile chrome");
assertContains(read("src/design/social-app.css"), "background: transparent", "web nav is transparent over themed mist");
assertContains(read("src/design/social-app.css"), "color: var(--s-mute)", "web inactive nav is mute");
assertContains(read("src/design/social-app.css"), "color: var(--s-lilac-deep)", "web active nav is lilac-deep");
assertContains(read("apps/mobile/src/ui/SeoullyControls.tsx"), "useProfileIdentity", "shared controls consume profile theme");
assertContains(read("apps/mobile/src/ui/SeoullyControls.tsx"), "identity.primarySoft", "ghost/chips use theme soft");
assertContains(read("apps/mobile/src/ui/SeoullyControls.tsx"), "identity.paper", "enter uses theme paper");
assertContains(read("apps/mobile/src/data/demo/repository.ts"), "onPrimary: tokens.onPrimary", "demo maps web on-primary");
assertContains(read("apps/mobile/src/data/demo/repository.ts"), "secondarySoft: tokens.secondarySoft", "demo maps web secondary soft");
assertContains(read("apps/mobile/src/data/demo/repository.ts"), "resolveProfileTheme(profile.appearance, room)", "demo uses web appearance resolver");
assertNotContains(read("apps/mobile/src/data/production.ts"), "appearance", "live identity has no appearance contract");
assertContains(read("apps/mobile/src/ui/SeoullyProfile.tsx"), "veilLayer", "veil stacks above room");
assertContains(read("src/world/ui/SocialShell.tsx"), "data-surface={themeUserId ? \"profile\" : \"browse\"}", "web profile surface inspected");
assertContains(read("src/design/social-app.css"), "--s-profile-veil: 0.85", "web veil is the opacity authority");
assertContains(read("src/design/social-app.css"), "background: var(--s-action)", "web primary is --s-action");
assertContains(read("src/design/social-app.css"), "background: var(--s-lilac-soft)", "web ghost is --s-lilac-soft");
assertContains(read("src/design/social-app.css"), "background: var(--s-paper)", "web enter is --s-paper");
assertContains(read("src/domain/profile-theme.ts"), 'inkHsl && inkHsl.l > 0.55 ? room.theme.ink : "#f3eef6"', "web room-sync compensates ink");
assertContains(read("docs/native-road-to-ship.md"), "Live Profile Appearance / Room Sync", "live appearance gap recorded for slice 7");

  const brand = read("apps/mobile/src/ui/BrandMark.tsx");
  const header = read("apps/mobile/src/ui/SeoullyHeader.tsx");
  const companion = read("apps/mobile/src/ui/SeoullyCompanion.tsx");
  const roomWorld = read("apps/mobile/src/room/RoomWorldScreen.tsx");
  const retry = read("apps/mobile/src/components/RetryNotice.tsx");
  const road = read("docs/native-road-to-ship.md");
  assertContains(brand, "flexShrink: 0", "wordmark pair does not shrink");
  assertNotContains(brand, "lineHeight: 22", "wordmark is not clipped to 22px");
  assertContains(brand, "BRAND_WORDMARK_OPTICAL_Y", "wordmark has a brand-specific optical offset");
  assertContains(brand, "translateY: BRAND_WORDMARK_OPTICAL_Y", "optical offset is a translate, not a flex restack");
  assertContains(brand, "faces.en.bold", "wordmark stays Latin Baloo in EN/KO");
  assertContains(header, "chrome.headerHeight", "header uses shared chrome height");
  assertContains(header, "chrome.gutter", "header uses shared gutter");
  assertNotContains(header, "paddingTop: 10", "header is not jammed with extra top padding");
  assert.equal(routeShowsBottomNav("/profile"), true);
  assert.equal(routeShowsBottomNav("/(tabs)/search"), true);
  assert.equal(routeShowsBottomNav("/"), true);
  assert.equal(routeShowsBottomNav("/room"), false);
  assert.equal(routeShowsBottomNav("/collector"), false);
  const tabPlace = companionPlacement({ insets: { top: 59, right: 0, bottom: 34, left: 0 }, hasBottomNav: true });
  assert.equal(tabPlace.bottom, 34 + chrome.tabBarContent + chrome.companionClearance);
  assert.equal(tabPlace.right, chrome.gutter);
  const stackPlace = companionPlacement({ insets: { top: 59, right: 0, bottom: 34, left: 0 }, hasBottomNav: false });
  assert.ok(stackPlace.bottom < tabPlace.bottom);
  assert.equal(stackPlace.right, chrome.gutter);
  assertContains(companion, "companionPlacement", "companion uses shared contract");
  assertNotContains(companion, "right: 12", "companion is not jammed to 12px");
  assertContains(retry, "SeoullyText", "shared retry uses Seoully type");
  assertContains(roomWorld, "SeoullyText", "room chrome uses Seoully type");
  assertContains(read("apps/mobile/app/room.tsx"), "react-native-safe-area-context", "room uses context safe area");
  assertContains(road, "KEEP THE ENGINE", "slice 7 lock recorded");
  assertContains(road, "Touch-first edit mode", "slice 7 lock recorded");
  assertContains(read("docs/web-native-parity-contract.md"), "KEEP THE ENGINE, REBUILD THE EXPERIENCE", "parity contract records slice 7 lock");

  console.log("check:physical-qa passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
