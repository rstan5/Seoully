import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  catalogReferenceConsentDefault,
  holdingExistsWithoutPhoto,
  isBinderEligible,
  isRoomEligible,
  MANUAL_CONTRIBUTION_KEYS,
  profileCollectedCount,
  representationUsesPersonalImage,
  shouldShareCatalogReference,
} from "../apps/mobile/src/data/ownership";

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

const photocard = { id: "holding-1", template: { kind: "photocard" }, personalMediaUrl: "https://media.example/card.jpg" };
const album = { id: "holding-2", template: { kind: "album" } };
const noPhoto = { id: "holding-3", template: { kind: "photocard" }, personalMediaUrl: undefined as string | undefined };

assert.equal(isBinderEligible(photocard), true);
assert.equal(isBinderEligible(album), false);
assert.equal(isRoomEligible(photocard), true);
assert.equal(isRoomEligible(album), true);
assert.equal(isRoomEligible({ id: "" }), false);
assert.equal(holdingExistsWithoutPhoto(noPhoto), true);
assert.equal(holdingExistsWithoutPhoto(photocard), false);
assert.equal(representationUsesPersonalImage(photocard), true);
assert.equal(representationUsesPersonalImage(noPhoto), false);
assert.equal(catalogReferenceConsentDefault(), false);
assert.equal(shouldShareCatalogReference({ consent: false, isNewTemplate: true, hasPersonalMedia: true }), false);
assert.equal(shouldShareCatalogReference({ consent: true, isNewTemplate: false, hasPersonalMedia: true }), false);
assert.equal(shouldShareCatalogReference({ consent: true, isNewTemplate: true, hasPersonalMedia: false }), false);
assert.equal(shouldShareCatalogReference({ consent: true, isNewTemplate: true, hasPersonalMedia: true }), true);
assert.equal(profileCollectedCount([photocard, album, noPhoto]), 3);
assert.deepEqual([...MANUAL_CONTRIBUTION_KEYS], ["name", "kind", "groupName", "memberName", "releaseName", "descriptor"]);

const add = read("apps/mobile/app/add.tsx");
assertContains(add, 'social.kind === "demo"', "add.tsx");
assertContains(add, "demoWriteBlocked", "add.tsx");
assertContains(add, "createHolding(params.templateId)", "add.tsx");
assertContains(add, "uploadHoldingPhoto(holding.id, uri)", "add.tsx");
assertContains(add, "shouldShareCatalogReference", "add.tsx");
assertContains(add, "uploadCatalogReferencePhoto", "add.tsx");
assertContains(add, "catalogReferenceConsentDefault", "add.tsx");
assertContains(add, "PhotocardCropper", "add.tsx");
assertContains(add, "pathname: \"/collectible\"", "add.tsx");
assertNotContains(add, "saveNativeRoomPlacement", "add.tsx");
assertNotContains(add, "if (!uri)", "add.tsx");

const collect = read("apps/mobile/app/collect.tsx");
assertContains(collect, "social.searchCatalog", "collect.tsx");
assertContains(collect, "searchSeoullyCatalog", "collect.tsx");
assertContains(collect, "addManuallyTitle", "collect.tsx");
assertContains(collect, "contributeCatalogItem", "collect.tsx");
assertContains(collect, "demoWriteBlocked", "collect.tsx");
assertContains(collect, "descriptor: versionName.trim()", "collect.tsx");
assertContains(collect, "newTemplate: \"true\"", "collect.tsx");
assertContains(collect, "groupName: template.groupName", "collect.tsx");
assertNotContains(collect, "searchCatalog,", "collect.tsx");

const create = read("apps/mobile/app/(tabs)/create.tsx");
assertContains(create, 'router.push("/collect")', "create.tsx");
assertNotContains(create, "contributeCatalogItem", "create.tsx");

const collection = read("apps/mobile/app/collection.tsx");
assertContains(collection, "useFocusEffect", "collection.tsx");
assertContains(collection, "social.loadMyHoldings", "collection.tsx");
assertContains(collection, "SeoullyOwnedRow", "collection.tsx");
assertContains(collection, "social.setHoldingTradeStatus", "collection.tsx");
assertContains(collection, "social.removeHolding", "collection.tsx");
assertContains(collection, 'router.push("/collect")', "collection.tsx");
assertContains(collection, "holding.personalMediaUrl", "collection.tsx");
assertContains(collection, "pathname: \"/collectible\"", "collection.tsx");
assertContains(collection, "holdingTradeFailed", "collection.tsx");
assertContains(collection, "holdingRemoveFailed", "collection.tsx");

const profile = read("apps/mobile/app/(tabs)/profile.tsx");
assertContains(profile, "useFocusEffect", "profile.tsx");
assertContains(profile, "social.loadMyHoldings", "profile.tsx");
assertContains(profile, "setHoldingCount(nextHoldings.length)", "profile.tsx");
assertContains(profile, "SeoullyOwnedRow", "profile.tsx");
assertContains(profile, "holding.personalMediaUrl", "profile.tsx");
assertContains(profile, 'router.push("/collect")', "profile.tsx");
assertContains(profile, "pathname: \"/collectible\"", "profile.tsx");
assertContains(profile, "collectorInterests", "profile.tsx");

const collectible = read("apps/mobile/app/collectible.tsx");
assertContains(collectible, "loadMyHolding", "collectible.tsx");
assertContains(collectible, "isBinderEligible", "collectible.tsx");
assertContains(collectible, "isRoomEligible", "collectible.tsx");
assertContains(collectible, "social.setHoldingTradeStatus", "collectible.tsx");
assertContains(collectible, "social.removeHolding", "collectible.tsx");
assertContains(collectible, "uploadHoldingPhoto", "collectible.tsx");
assertContains(collectible, "PhotocardCropper", "collectible.tsx");
assertContains(collectible, "removeFromCollection", "collectible.tsx");
assertContains(collectible, 'social.kind === "demo"', "collectible.tsx");
assertNotContains(collectible, "updateHoldingTradeStatus", "collectible.tsx");

const binder = read("apps/mobile/app/binder.tsx");
assertContains(binder, "social.loadMyHoldings", "binder.tsx");
assertContains(binder, 'holding.template.kind === "photocard"', "binder.tsx");

const room = read("apps/mobile/app/room.tsx");
assertContains(room, "snapshot?.holdings.filter((holding) => !placedIds.has(holding.id))", "room.tsx");
assertContains(room, "storedCollection", "room.tsx");

const api = read("apps/mobile/src/api.ts");
assertContains(api, "JSON.stringify({ templateId })", "api.ts");
assertContains(api, "if (!payload.holding?.id)", "api.ts");
assertContains(api, "/api/mobile/holdings", "api.ts");
assertContains(api, "/api/mobile/catalog/contributions", "api.ts");
assertContains(api, "/api/mobile/catalog/reference-images", "api.ts");
assertContains(api, "/api/mobile/media", "api.ts");
assertContains(api, "JSON.stringify({ holdingId, tradeStatus })", "api.ts");

const holdingsDal = read("src/server/dal/holdings.ts");
assertContains(holdingsDal, "insert({ owner_user_id: identity.user.id, template_id: template.id })", "holdings.ts");
assertContains(holdingsDal, "trade_status", "holdings.ts");
const removeStart = holdingsDal.indexOf("export async function removeMyHolding");
const hydrateStart = holdingsDal.indexOf("async function hydrateHoldings", removeStart);
assert.ok(removeStart >= 0 && hydrateStart > removeStart, "removeMyHolding bounds");
const removeFn = holdingsDal.slice(removeStart, hydrateStart);
assertContains(removeFn, '.from("holdings")', "removeMyHolding");
assertContains(removeFn, ".delete()", "removeMyHolding");
assertNotContains(removeFn, "collectible_templates", "removeMyHolding");

const contribution = read("src/server/dal/catalog.ts");
assertContains(contribution, "groupName", "catalog.ts");
assertContains(contribution, "create_catalog_contribution", "catalog.ts");
assertContains(contribution, "descriptor: z.string().trim().max(300).optional()", "catalog.ts");

const demoRepo = read("apps/mobile/src/data/demo/repository.ts");
assertContains(demoRepo, "import type", "demo/repository.ts");
assertNotContains(demoRepo, "createHolding(", "demo/repository.ts");
assertNotContains(demoRepo, "contributeCatalogItem(", "demo/repository.ts");
assertNotContains(demoRepo, "uploadHoldingPhoto(", "demo/repository.ts");
assertNotContains(demoRepo, "uploadCatalogReferencePhoto(", "demo/repository.ts");
assertNotContains(demoRepo, "productApiBase", "demo/repository.ts");

const i18n = read("apps/mobile/src/i18n.ts");
for (const key of [
  "shareCatalogPhotoHelp",
  "catalogVersion",
  "holdingRemoveFailed",
  "holdingTradeFailed",
  "holdingAddedPhotoFailed",
  "removeFromCollection",
  "binderEligibleHint",
  "roomEligibleHint",
]) {
  assert.equal((i18n.match(new RegExp(`${key}:`, "g")) ?? []).length, 2, `i18n ${key} must exist in en and ko`);
}

const migrations = fs.readdirSync(path.join(repoRoot, "supabase/migrations")).join("\n");
assertContains(migrations, "20261001000000_direct_messages.sql", "migrations list");
assertContains(migrations, "20261002000000_native_room_theme.sql", "migrations list");

console.log("check:slice2 passed");
