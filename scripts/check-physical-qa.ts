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
  relativeLuminance,
} from "../apps/mobile/src/ui/profileContrast";

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

assertContains(profile, "identityPalette", "profile uses contrast palette");
assertContains(profile, "ProfileIdentityProvider", "profile identity context");
assertContains(read("apps/mobile/src/ui/SeoullyProfile.tsx"), "veilLayer", "veil stacks above room");
assertContains(read("src/world/ui/SocialShell.tsx"), "data-surface={themeUserId ? \"profile\" : \"browse\"}", "web profile surface inspected");
assertContains(read("src/design/social-app.css"), "--s-profile-veil: 0.85", "web veil is the opacity authority");
assertContains(read("src/domain/profile-theme.ts"), 'inkHsl && inkHsl.l > 0.55 ? room.theme.ink : "#f3eef6"', "web room-sync compensates ink");

  console.log("check:physical-qa passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
