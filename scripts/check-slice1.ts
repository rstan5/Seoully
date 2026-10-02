import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEMO_CAPABILITIES, LIVE_CAPABILITIES } from "../apps/mobile/src/data/capabilities";
import { liveRepostResult, liveSaveResult, liveShareResult, publicCollectedCount, shareStatusCopyKey } from "../apps/mobile/src/data/honesty";
import { isAuthConfigured, isProductApiConfigured, isSeoullyProductReady } from "../apps/mobile/src/config-rules";
import { DEFAULT_NATIVE_ROOM_THEME, nativeRoomThemeFromRow, ROOM_OWNER_SELECT } from "../src/server/dal/room-schema";

const repoRoot = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

function assertNotContains(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), `${label} unexpectedly contains ${JSON.stringify(needle)}`);
}

function assertContains(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), `${label} missing ${JSON.stringify(needle)}`);
}

assert.equal(isAuthConfigured("", "key"), false);
assert.equal(isAuthConfigured("https://example.supabase.co", ""), false);
assert.equal(isAuthConfigured("https://example.supabase.co", "key"), true);
assert.equal(isProductApiConfigured(""), false);
assert.equal(isProductApiConfigured("not-a-url"), false);
assert.equal(isProductApiConfigured("https://seoully.example"), true);
assert.equal(isSeoullyProductReady("https://example.supabase.co", "key", ""), false);
assert.equal(isSeoullyProductReady("https://example.supabase.co", "key", "https://seoully.example"), true);
assert.equal(
  isSeoullyProductReady("https://example.supabase.co", "key", ""),
  isAuthConfigured("https://example.supabase.co", "key") && isProductApiConfigured(""),
);

const configSource = read("apps/mobile/src/config.ts");
assertContains(configSource, "productApiConfigured", "config.ts");
assertContains(configSource, "isSeoullyProductReady", "config.ts");
assertContains(configSource, "authConfigured", "config.ts");

assert.equal(LIVE_CAPABILITIES.discoverFeed, true);
assert.equal(LIVE_CAPABILITIES.persistRepost, false);
assert.equal(LIVE_CAPABILITIES.deliverShare, true);
assert.equal(LIVE_CAPABILITIES.persistMessages, true);
assert.equal(LIVE_CAPABILITIES.persistNotices, true);
assert.equal(LIVE_CAPABILITIES.publicCollectionRows, true);
assert.equal(LIVE_CAPABILITIES.searchPosts, true);
assert.equal(LIVE_CAPABILITIES.persistRoom, true);
assert.equal(LIVE_CAPABILITIES.persistRoomTheme, false);

assert.equal(DEMO_CAPABILITIES.discoverFeed, true);
assert.equal(DEMO_CAPABILITIES.persistMessages, true);
assert.equal(DEMO_CAPABILITIES.deliverShare, true);
assert.equal(DEMO_CAPABILITIES.persistRoom, false);
assert.equal(DEMO_CAPABILITIES.publicCollectionRows, true);

assert.deepEqual(liveShareResult(), { delivered: false });
assert.deepEqual(liveRepostResult(), { persisted: false });
assert.deepEqual(liveSaveResult(), { persisted: false });
assert.equal(shareStatusCopyKey(false), "sendToBlocked");
assert.equal(shareStatusCopyKey(true), "sendToDelivered");
assert.equal(publicCollectedCount(LIVE_CAPABILITIES, 12), 12);
assert.equal(publicCollectedCount(DEMO_CAPABILITIES, 12), 12);

assert.equal(ROOM_OWNER_SELECT.includes("theme_id"), false);
assert.equal(nativeRoomThemeFromRow({ theme_id: "midnight" }), DEFAULT_NATIVE_ROOM_THEME);

const rooms = read("src/server/dal/rooms.ts");
assertContains(rooms, "ROOM_OWNER_SELECT", "rooms.ts");
assertNotContains(rooms, "theme_id", "rooms.ts");
assertContains(rooms, "room_theme_unavailable", "rooms.ts");

const collection = read("apps/mobile/app/collection.tsx");
assertContains(collection, "useSocialRepository", "collection.tsx");
assertContains(collection, "social.loadMyHoldings", "collection.tsx");
assertContains(collection, "social.setHoldingTradeStatus", "collection.tsx");
assertContains(collection, "social.setWishlist", "collection.tsx");
assertNotContains(collection, "updateHoldingTradeStatus", "collection.tsx");
assertNotContains(collection, "setWishlistTemplate", "collection.tsx");

const binder = read("apps/mobile/app/binder.tsx");
assertContains(binder, "social.loadMyHoldings", "binder.tsx");
assertNotContains(binder, "loadAllMyHoldings", "binder.tsx");

const messages = read("apps/mobile/app/(tabs)/messages.tsx");
assertContains(messages, "social.loadConversations", "messages.tsx");
assertContains(messages, "persistMessages", "messages.tsx");

const thread = read("apps/mobile/app/thread.tsx");
assertContains(thread, "social.sendMessage", "thread.tsx");
assertNotContains(thread, "sendDirectMessage", "thread.tsx");

const collect = read("apps/mobile/app/collect.tsx");
assertContains(collect, "social.searchCatalog", "collect.tsx");
assertNotContains(collect, "searchCatalog,", "collect.tsx");

const room = read("apps/mobile/app/room.tsx");
assertNotContains(room, "saveNativeRoomTheme", "room.tsx");
assertContains(room, "persistRoom", "room.tsx");

const collectible = read("apps/mobile/app/collectible.tsx");
assertContains(collectible, 'social.kind === "demo"', "collectible.tsx");
assertContains(collectible, "social.setHoldingTradeStatus", "collectible.tsx");
assertNotContains(collectible, "updateHoldingTradeStatus", "collectible.tsx");

const collector = read("apps/mobile/app/(tabs)/collector.tsx");
assertNotContains(collector, "ensureConversation", "collector.tsx");
assertContains(collector, "persistMessages", "collector.tsx");
assertContains(collector, "collectionPrivate", "collector.tsx");

const feedPost = read("apps/mobile/src/ui/SeoullyFeedPost.tsx");
assertContains(feedPost, "persistRepost", "SeoullyFeedPost.tsx");
assertContains(feedPost, "deliverShare", "SeoullyFeedPost.tsx");

const production = read("apps/mobile/src/data/production.ts");
assertContains(production, "liveShareResult", "production.ts");
assertContains(production, "liveNoticePage", "production.ts");
assertContains(production, "LIVE_CAPABILITIES", "production.ts");
assertContains(production, "messages_unavailable", "production.ts");

const api = read("apps/mobile/src/api.ts");
assertContains(api, "product_api_unconfigured", "api.ts");
assertContains(api, "productApiBase", "api.ts");

console.log("check:slice1 passed");
