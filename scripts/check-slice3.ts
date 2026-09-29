import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildTasteAliasIndex, expandTasteIds } from "../src/server/compatibility/taste-ids";
import { publicRecordOmitsPrivateMedia } from "../src/server/public-collection-contract";
import { LIVE_CAPABILITIES } from "../apps/mobile/src/data/capabilities";

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

assert.equal(LIVE_CAPABILITIES.publicCollectionRows, true);

const catalogUuid = "11111111-1111-1111-1111-111111111111";
const memberUuid = "22222222-2222-2222-2222-222222222222";
const index = buildTasteAliasIndex({
  catalogGroups: [{ id: catalogUuid, slug: "stray-kids", name: "Stray Kids" }],
  catalogMembers: [{ id: memberUuid, groupId: catalogUuid, stageName: "Hyunjin", normalizedName: "hyunjin" }],
});
assert.ok(expandTasteIds(["skz"], index).includes(catalogUuid));
assert.ok(expandTasteIds([catalogUuid], index).includes("skz"));
assert.ok(expandTasteIds(["skz-hyunjin"], index).includes(memberUuid));
assert.ok(expandTasteIds([memberUuid], index).includes("skz-hyunjin"));

const publicHolding = {
  id: "holding-1",
  templateId: "template-1",
  tradeStatus: "for-trade",
  template: { id: "template-1", name: "Venus POB", kind: "photocard", groupName: "IVE" },
};
assert.equal(publicRecordOmitsPrivateMedia(publicHolding), true);
assert.equal(publicRecordOmitsPrivateMedia({ ...publicHolding, personalMediaUrl: "https://secret" }), false);

const publicCollection = read("src/server/dal/public-collection.ts");
assertContains(publicCollection, "getCollectionPairSnapshot", "public-collection.ts");
assertContains(publicCollection, "target_wishlist_public === true", "public-collection.ts");
assertNotContains(publicCollection, "personalMediaUrl", "public-collection.ts");
assertNotContains(publicCollection, "signedUrl", "public-collection.ts");

const collectionRoute = read("src/app/api/mobile/collectors/[userId]/collection/route.ts");
assertContains(collectionRoute, "getPublicCollectorCollection", "collection/route.ts");
assertContains(collectionRoute, "createSupabaseBearerClient", "collection/route.ts");

const holdingRoute = read("src/app/api/mobile/collectors/[userId]/collection/holdings/[holdingId]/route.ts");
assertContains(holdingRoute, "getPublicCollectorHolding", "holding route");

const compatibility = read("src/server/compatibility/service.ts");
assertContains(compatibility, "computeCompatibilityPeople", "compatibility/service.ts");
assertContains(compatibility, "expandTasteIds", "compatibility/service.ts");
assertContains(compatibility, "buildTasteAliasIndex", "compatibility/service.ts");
assertNotContains(compatibility, 'from "@/domain/compatibility"', "compatibility/service.ts");

const trade = read("src/server/trade/service.ts");
assertContains(trade, "forTradeCopies", "trade/service.ts");
assertContains(trade, 'holding.trade_status === "for-trade"', "trade/service.ts");

const production = read("apps/mobile/src/data/production.ts");
assertContains(production, "loadCollectorCollection", "production.ts");
assertContains(production, "loadCollectorMatch", "production.ts");
assertContains(production, 'source: "production"', "production.ts");
assertContains(production, "collection.collectionPublic", "production.ts");
assertNotContains(production, "65", "production.ts");
assertNotContains(production, "computeCompatibility(", "production.ts");
assertNotContains(production, "HOLDINGS_FIXTURE", "production.ts");

const demo = read("apps/mobile/src/data/demo/repository.ts");
assertContains(demo, 'source: "domain"', "demo/repository.ts");
assertContains(demo, "computeCompatibility", "demo/repository.ts");
assertContains(demo, "collectionPublic: true", "demo/repository.ts");
assertNotContains(demo, "loadCollectorCollection", "demo/repository.ts");
assertNotContains(demo, "productApiBase", "demo/repository.ts");

const collector = read("apps/mobile/app/collector.tsx");
assertContains(collector, "social.setFollowing", "collector.tsx");
assertContains(collector, "social.loadCollector", "collector.tsx");
assertContains(collector, "social.loadCollectorPosts", "collector.tsx");
assertContains(collector, "/public-collectible", "collector.tsx");
assertContains(collector, "collectionPrivate", "collector.tsx");
assertContains(collector, "SeoullyFeedPost", "collector.tsx");
assertContains(collector, "SeoullyTradeMatch", "collector.tsx");
assertContains(collector, "/collector-room", "collector.tsx");
assertNotContains(collector, "SeoullyOwnedRow", "collector.tsx");
assertNotContains(collector, "loadMyHolding", "collector.tsx");
assertNotContains(collector, "removeHolding", "collector.tsx");
assertNotContains(collector, "uploadHoldingPhoto", "collector.tsx");

const publicCollectible = read("apps/mobile/app/public-collectible.tsx");
assertContains(publicCollectible, 'social.kind === "demo"', "public-collectible.tsx");
assertContains(publicCollectible, "loadPublicCollectorHolding", "public-collectible.tsx");
assertContains(publicCollectible, "loadCollectorCollection", "public-collectible.tsx");
assertNotContains(publicCollectible, "loadMyHolding", "public-collectible.tsx");
assertNotContains(publicCollectible, "removeHolding", "public-collectible.tsx");
assertNotContains(publicCollectible, "uploadHoldingPhoto", "public-collectible.tsx");
assertNotContains(publicCollectible, "setHoldingTradeStatus", "public-collectible.tsx");
assertNotContains(publicCollectible, "updateHoldingTradeStatus", "public-collectible.tsx");

const ownCollectible = read("apps/mobile/app/collectible.tsx");
assertContains(ownCollectible, "loadMyHolding", "collectible.tsx");

const room = read("apps/mobile/app/collector-room.tsx");
assertContains(room, 'social.kind === "demo"', "collector-room.tsx");
assertContains(room, "demoRoomUnavailable", "collector-room.tsx");

const api = read("apps/mobile/src/api.ts");
assertContains(api, "/api/mobile/collectors/${encodeURIComponent(userId)}/collection", "api.ts");
assertContains(api, "JSON.stringify({ following })", "api.ts");

const match = read("src/app/api/mobile/collectors/[userId]/match/route.ts");
assertContains(match, "getCollectorCompatibility", "match/route.ts");
assertContains(match, 'engine: "people"', "match/route.ts");
assertContains(match, "openToTrade: item.forTradeCopies > 0", "match/route.ts");

const i18n = read("apps/mobile/src/i18n.ts");
for (const key of ["compatEngineProduction", "collectionPrivate", "wishlistPrivate", "publicCollectibleUnavailable"]) {
  assert.equal((i18n.match(new RegExp(`${key}:`, "g")) ?? []).length, 2, `i18n ${key} must exist in en and ko`);
}

console.log("check:slice3 passed");
