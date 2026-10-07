import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  canCompleteOnboarding,
  nextDurableStep,
  ONBOARDING_INTERESTS,
  resolveOnboardingPhase,
  returningUserBypassesOnboarding,
  resumeAfterHoldingDoesNotCollect,
  walkFirstUserJourney,
} from "../apps/mobile/src/onboarding/journey";
import { catalogReferenceConsentDefault, isBinderEligible, isRoomEligible, shouldShareCatalogReference } from "../apps/mobile/src/data/ownership";

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

// A. Returning user
assert.equal(returningUserBypassesOnboarding("done"), true);
assert.equal(resolveOnboardingPhase({ durableStep: "done", editingTastes: false, holdingCount: 0 }), "app");

// B. Incomplete resume
assert.equal(resolveOnboardingPhase({ durableStep: "group", editingTastes: false, holdingCount: 0 }), "group");
assert.equal(resolveOnboardingPhase({ durableStep: "bias", editingTastes: false, holdingCount: 0 }), "bias");
assert.equal(resolveOnboardingPhase({ durableStep: "interest", editingTastes: false, holdingCount: 0 }), "interest");
assert.equal(resolveOnboardingPhase({ durableStep: "interest", editingTastes: false, holdingCount: 0, interestsSaved: true }), "collect");

// C. Demo/Live isolation
const onboarding = read("apps/mobile/app/onboarding.tsx");
const add = read("apps/mobile/app/add.tsx");
const collect = read("apps/mobile/app/collect.tsx");
assertContains(onboarding, "setDemo(false)", "onboarding forces Live");
assertContains(onboarding, 'social.kind !== "production"', "meet stays production-only");
assertContains(add, "demoWriteBlocked", "add demo block");
assertContains(collect, "demoWriteBlocked", "collect demo block");
assertNotContains(onboarding, "MINJI", "onboarding");
assertNotContains(onboarding, "SOO", "onboarding");

// D/E/F identity
assert.equal(nextDurableStep("group", "groups", 1), "bias");
assert.equal(nextDurableStep("bias", "bias"), "interest");
assert.equal(nextDurableStep("interest", "interests"), "interest");
assert.deepEqual([...ONBOARDING_INTERESTS], ["photocards", "albums", "merch", "vinyl", "posters", "lightsticks", "everything"]);
assertContains(onboarding, "state.groups.map", "live groups");
assertContains(onboarding, "groupIds.includes(member.groupId)", "bias scoped to groups");
assertContains(onboarding, 'action: "interests"', "interest persist");

// G. No Vision
for (const [label, source] of [["onboarding", onboarding], ["collect", collect], ["add", add]] as const) {
  assertNotContains(source, "vision", label);
  assertNotContains(source, "identify", label);
  assertNotContains(source, "Google Lens", label);
  assertNotContains(source, "looksLike", label);
}

// H. Add flow reuse
assertContains(collect, 'pathname: "/add"', "collect opens add");
assertContains(collect, 'from: "onboarding"', "collect passes onboarding");
assertContains(add, "createHolding(params.templateId)", "canonical createHolding");
assertNotContains(onboarding, "createHolding(", "onboarding does not duplicate Holding");

// I/J catalog + manual
assertContains(collect, "social.searchCatalog", "catalog search");
assertContains(collect, "submitManualCatalog", "manual contribution");
assertContains(read("apps/mobile/src/manualCatalog.ts"), "contributeCatalogItem(input)", "manual submission uses canonical API");
assertContains(collect, "addManuallyTitle", "manual add visible");

// K/L/M/N media + crop + consent
assertContains(add, "uploadHoldingPhoto(holding.id, uri)", "personal media");
assertContains(add, "PhotocardCropper", "photocard crop");
assert.equal(catalogReferenceConsentDefault(), false);
assert.equal(shouldShareCatalogReference({ consent: false, isNewTemplate: true, hasPersonalMedia: true }), false);
assert.equal(shouldShareCatalogReference({ consent: true, isNewTemplate: true, hasPersonalMedia: true }), true);
assertContains(add, "shouldShareCatalogReference", "consent gate");
assertContains(add, "uploadCatalogReferencePhoto", "separate catalog reference");

// O/P/Q/R ownership vs placement / binder
assertContains(add, 'pathname: "/onboarding"', "first item returns to reveal");
assert.equal(isRoomEligible({ id: "h1" }), true);
assert.equal(isBinderEligible({ template: { kind: "photocard" } }), true);
assert.equal(isBinderEligible({ template: { kind: "album" } }), false);
assertContains(onboarding, "isBinderEligible(holding)", "binder only when photocard");
assertNotContains(add, "saveNativeRoomPlacement", "add does not place");

// S duplicate resume
assert.equal(resolveOnboardingPhase({
  durableStep: "interest",
  editingTastes: false,
  holdingCount: 1,
  requestedPhase: "collect",
  interestsSaved: true,
}), "reveal");
assert.equal(resumeAfterHoldingDoesNotCollect("reveal"), true);

// T optional media failure
assertContains(add, "photoFailed", "photo failure keeps holding");
assertContains(onboarding, "onboardPhotoLater", "photo later copy");

// U placement not required
assertNotContains(onboarding, "saveNativeRoomPlacement", "onboarding does not fake placement");

// V social production
assertContains(onboarding, "social.loadSuggested()", "production discovery");

// W/X completion + existing users
assert.equal(nextDurableStep("interest", "complete"), "done");
assert.equal(canCompleteOnboarding(0), false);
assert.equal(canCompleteOnboarding(1), true);
assert.equal(resolveOnboardingPhase({ durableStep: "done", editingTastes: false, holdingCount: 0 }), "app");

// Y locale does not alter progress
assert.equal(resolveOnboardingPhase({ durableStep: "bias", editingTastes: false, holdingCount: 0 }), "bias");

// Z reduced motion still completes
assertContains(onboarding, "reduceMotion ? 1600 : 2200", "reduced motion reveal");
assertContains(onboarding, "reduceMotion", "reduced motion");

// AA GL startup
assertNotContains(read("apps/mobile/app/index.tsx"), "NativeRoomRenderer", "welcome/auth");
assertNotContains(read("apps/mobile/app/index.tsx"), "RoomWorldScreen", "welcome/auth");
assertNotContains(read("apps/mobile/app/_layout.tsx"), "NativeRoomRenderer", "root layout");
assertContains(onboarding, "lazy(() => import(\"../src/onboarding/OnboardingWorldIntro\"))", "lazy room intro");

// AB room migration unapplied in product code
assertContains(read("supabase/migrations/20261002000000_native_room_theme.sql"), "theme_id", "migration file exists");
assertNotContains(read("src/app/api/mobile/onboarding/route.ts"), "20261002", "onboarding API");

const route = read("src/app/api/mobile/onboarding/route.ts");
assertContains(route, 'action: z.literal("complete")', "complete action");
assertContains(route, "first_holding_required", "holding required to finish");
assertNotContains(route, 'if (!editingComplete) patch.onboarding_step = "done"', "interests no longer marks done");
assertContains(route, 'patch.onboarding_step = "done"', "complete marks done");
assertContains(read("apps/mobile/src/api.ts"), '{ action: "complete" }', "client complete patch");

const index = read("apps/mobile/app/index.tsx");
assertContains(index, "welcomeLine1", "welcome personality");
assertContains(index, "welcomeCreate", "create your world");
assertContains(read("apps/mobile/src/startup/AuthRouteTree.tsx"), 'name="(tabs)"', "app tree is tabs");
assertContains(read("apps/mobile/src/startup/AuthRouteTree.tsx"), 'name="onboarding"', "onboarding tree");

const i18n = read("apps/mobile/src/i18n.ts");
assertContains(i18n, "Turn your fandom", "EN welcome");
assertContains(i18n, "덕질을", "KO welcome");
assertContains(i18n, "I couldn’t find that one in Seoully’s catalog yet ♡", "catalog miss");

const walk = walkFirstUserJourney();
assert.deepEqual(walk.phases.slice(0, 4), ["group", "bias", "interest", "collect"]);
assert.equal(walk.holdingsCreated, 1);
assert.ok(walk.phases.includes("reveal"));
assert.ok(walk.phases.includes("room"));
assert.ok(walk.phases.includes("meet"));
assert.equal(walk.relaunch, "app");
assert.equal(walk.durable.at(-1), "done");

const tabs = read("apps/mobile/app/(tabs)/_layout.tsx");
assertNotContains(tabs, "Redirect", "tabs no auth redirect");
assertContains(read("apps/mobile/app/_layout.tsx"), "AuthRouteTree", "root owns trees");

console.log("check:slice8 passed");
