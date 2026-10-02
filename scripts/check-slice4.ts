import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { LIVE_CAPABILITIES, DEMO_CAPABILITIES } from "../apps/mobile/src/data/capabilities";
import { EXPLORE_DESTINATIONS, isExploreDestination } from "../apps/mobile/src/explore";
import { excludedDiscoverAuthorIds, sanitizeSearchNeedle, discoverHitOmitsPrivateCollectionFields } from "../src/server/social/discover-contract";

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

assert.equal(LIVE_CAPABILITIES.discoverFeed, true);
assert.equal(LIVE_CAPABILITIES.searchPosts, true);
assert.equal(LIVE_CAPABILITIES.persistRepost, false);
assert.equal(LIVE_CAPABILITIES.persistSave, false);
assert.equal(LIVE_CAPABILITIES.deliverShare, true);
assert.equal(DEMO_CAPABILITIES.discoverFeed, true);
assert.equal(DEMO_CAPABILITIES.searchPosts, true);
assert.deepEqual([...EXPLORE_DESTINATIONS], ["people", "rooms", "posts", "collectibles", "entities"]);
assert.equal(isExploreDestination("people"), true);
assert.equal(isExploreDestination("binder"), false);

const excluded = excludedDiscoverAuthorIds("viewer", ["friend-a", "viewer", "friend-a"]);
assert.deepEqual(excluded, ["viewer", "friend-a"]);
assert.equal(sanitizeSearchNeedle("  %Stray(), Kids%  "), "Stray Kids");
assert.equal(discoverHitOmitsPrivateCollectionFields({ id: "p1", caption: "ATE" }), true);
assert.equal(discoverHitOmitsPrivateCollectionFields({ id: "p1", personalMediaUrl: "https://secret" }), false);
assert.equal(discoverHitOmitsPrivateCollectionFields({ id: "p1", holdings: [] }), false);

const social = read("src/server/dal/social.ts");
assertContains(social, "getProductionDiscoverFeed", "social.ts");
assertContains(social, "searchProductionPosts", "social.ts");
assertContains(social, "searchProductionDiscoverCollectibles", "social.ts");
assertContains(social, "listDiscoverPosts", "social.ts");
assertContains(social, 'visibility", "public"', "social.ts");
assertContains(social, "not(\"author_user_id\", \"in\"", "social.ts");
assertContains(social, "findOwnersOfTemplate", "social.ts");
assertNotContains(social, "personalMediaUrl", "social.ts");
assertNotContains(social, "HOLDINGS_FIXTURE", "social.ts");

const feedRoute = read("src/app/api/mobile/feed/route.ts");
assertContains(feedRoute, "getProductionDiscoverFeed", "feed/route.ts");
assertContains(feedRoute, "getProductionFeed", "feed/route.ts");
assertContains(feedRoute, 'mode") === "discover"', "feed/route.ts");

const searchRoute = read("src/app/api/mobile/search/route.ts");
assertContains(searchRoute, "searchProductionPosts", "search/route.ts");
assertContains(searchRoute, "searchProductionDiscoverCollectibles", "search/route.ts");
assertContains(searchRoute, "searchProductionRooms", "search/route.ts");
assertContains(searchRoute, "searchProductionUsers", "search/route.ts");
assertContains(searchRoute, "runWithSupabaseClient", "search/route.ts");

const rooms = read("src/server/discovery/service.ts");
assertContains(rooms, "searchProductionRooms", "discovery/service.ts");
assertContains(rooms, "getPublicRoomByHandle", "discovery/service.ts");
assertContains(rooms, "!pub.private && pub.room", "discovery/service.ts");

const production = read("apps/mobile/src/data/production.ts");
assertContains(production, "loadFeed(cursor, mode)", "production.ts");
assertContains(production, "searchDiscoverCollectibles", "production.ts");
assertContains(production, "searchPosts", "production.ts");
assertContains(production, "searchRooms", "production.ts");
assertContains(production, "loadCollectorDiscovery", "production.ts");
assertContains(production, 'source: "production"', "production.ts");
assertNotContains(production, "items: [], nextCursor: null", "production.ts");
assertNotContains(production, "HOLDINGS_FIXTURE", "production.ts");
assertNotContains(production, "MINJI", "production.ts");
assertNotContains(production, "loadRoomDiscovery", "production.ts");
assertNotContains(production, "You may have something for each other.", "production.ts");

const demo = read("apps/mobile/src/data/demo/repository.ts");
assertContains(demo, "searchDiscoverCollectibles", "demo/repository.ts");
assertContains(demo, 'mode === "following" ? friend : !friend', "demo/repository.ts");
assertContains(demo, "profile?.roomId", "demo/repository.ts");
assertNotContains(demo, "loadCollectorDiscovery", "demo/repository.ts");
assertNotContains(demo, "productApiBase", "demo/repository.ts");

const api = read("apps/mobile/src/api.ts");
assertContains(api, 'mode === "discover") params.set("mode", "discover")', "api.ts");
assertContains(api, "dest=posts", "api.ts");
assertContains(api, "dest=collectibles", "api.ts");
assertContains(api, "dest=rooms", "api.ts");

const feed = read("apps/mobile/app/(tabs)/index.tsx");
assertContains(feed, 'production: "discover"', "index.tsx");
assertContains(feed, "copy.feedOpenDiscover", "index.tsx");
assertContains(feed, "copy.feedOpenSearch", "index.tsx");
assertContains(feed, "social.capabilities.discoverFeed", "index.tsx");
assertContains(feed, "SeoullyFeedPost", "index.tsx");

const search = read("apps/mobile/app/(tabs)/search.tsx");
assertContains(search, "useLocalSearchParams", "search.tsx");
assertContains(search, "searchDiscoverCollectibles", "search.tsx");
assertContains(search, "onOpenOwner", "search.tsx");
assertContains(search, 'pathname: "/collector"', "search.tsx");
assertContains(search, 'pathname: "/collector-room"', "search.tsx");
assertContains(search, "searchGeneration", "search.tsx");
assertNotContains(search, "social.searchCatalog(text)", "search.tsx");

const collectibleTap = search.slice(search.indexOf("function CollectibleResults"), search.indexOf("function EntityResults"));
assertContains(collectibleTap, "onOpenOwner", "CollectibleResults");
assertContains(collectibleTap, "hit.owner", "CollectibleResults");
assertNotContains(collectibleTap, 'pathname: "/add"', "CollectibleResults primary tap");

const tabs = read("apps/mobile/app/(tabs)/_layout.tsx");
assertContains(tabs, 'name="index"', "tabs/_layout.tsx");
assertContains(tabs, "t.feed", "tabs/_layout.tsx");
assertContains(tabs, 'name="search"', "tabs/_layout.tsx");
assertContains(tabs, 'name="create"', "tabs/_layout.tsx");
assertContains(tabs, 'name="messages"', "tabs/_layout.tsx");
assertContains(tabs, 'name="profile"', "tabs/_layout.tsx");
assertNotContains(tabs, 'name="room"', "tabs/_layout.tsx");
assert.equal(fs.existsSync(path.join(repoRoot, "apps/mobile/app/(tabs)/room.tsx")), false, "no tabs/room route");
assertNotContains(tabs, "binder", "tabs/_layout.tsx");

const tabBar = read("apps/mobile/src/ui/SeoullyTabBar.tsx");
assertContains(tabBar, "index: IconHome", "SeoullyTabBar.tsx");
assertContains(tabBar, "search: IconSearch", "SeoullyTabBar.tsx");
assertContains(tabBar, "create: IconPlus", "SeoullyTabBar.tsx");
assertContains(tabBar, "messages: IconChat", "SeoullyTabBar.tsx");
assertContains(tabBar, "profile: IconUser", "SeoullyTabBar.tsx");
assertNotContains(tabBar, "room:", "SeoullyTabBar.tsx");
assertNotContains(tabBar, "binder:", "SeoullyTabBar.tsx");

const companion = read("apps/mobile/src/ui/SeoullyCompanion.tsx");
assertContains(companion, 'pathname: "/search"', "SeoullyCompanion.tsx");
assertContains(companion, "isExploreDestination", "SeoullyCompanion.tsx");
assertContains(companion, "q: nextQuery", "SeoullyCompanion.tsx");

const post = read("apps/mobile/src/ui/SeoullyFeedPost.tsx");
assertContains(post, "persistRepost", "SeoullyFeedPost.tsx");
assertContains(post, "deliverShare", "SeoullyFeedPost.tsx");
assertContains(post, "setPostLiked", "SeoullyFeedPost.tsx");
assertContains(post, "addPostComment", "SeoullyFeedPost.tsx");

const i18n = read("apps/mobile/src/i18n.ts");
assertContains(i18n, 'feed: "Discover"', "i18n.ts");
assertContains(i18n, 'feed: "둘러보기"', "i18n.ts");
for (const key of [
  "feedOpenDiscover",
  "feedOpenSearch",
  "feedSuggestedReciprocal",
  "feedSuggestedWishlist",
  "searchOwnedBy",
  "searchCollectibleNoOwner",
]) {
  assert.equal((i18n.match(new RegExp(`${key}:`, "g")) ?? []).length, 2, `i18n ${key} must exist in en and ko`);
}

const migrations = fs.readdirSync(path.join(repoRoot, "supabase/migrations"));
assert.ok(migrations.includes("20261001000000_direct_messages.sql"));
assert.ok(migrations.includes("20261002000000_native_room_theme.sql"));

console.log("check:slice4 passed");
