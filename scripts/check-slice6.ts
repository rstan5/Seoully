import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CATALOG_COMPLETENESS_DISCLAIMER,
  contextFromNativeRoute,
  isAskNavigationAction,
  mergeAskContext,
  parseAskContext,
} from "../src/domain/ask-context";
import { helpForQuestion, navigationIntentFromQuestion } from "../src/domain/ask-help";
import { ASK_HISTORY_LIMIT, classifyAskNeed, extractAskSearchQuery } from "../src/domain/ask-intent";
import { parseAskResult } from "../src/domain/ask-result";

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

const UUID_A = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const UUID_B = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const UUID_C = "cccccccc-dddd-4eee-8fff-111111111111";

// A. Collector surface identity
const collectorCtx = contextFromNativeRoute("/collector", { userId: UUID_A });
assert.equal(collectorCtx.surface, "collector");
assert.equal(collectorCtx.collectorUserId, UUID_A);
assert.equal(collectorCtx.profileUserId, UUID_A);

// B. Collectible surface
const collectibleCtx = mergeAskContext(
  contextFromNativeRoute("/collectible", { holdingId: UUID_B }),
  { templateId: UUID_C },
);
assert.equal(collectibleCtx.surface, "collectible");
assert.equal(collectibleCtx.holdingId, UUID_B);
assert.equal(collectibleCtx.templateId, UUID_C);

// C. Search query/destination
const searchCtx = contextFromNativeRoute("/search", { q: "Stray Kids", dest: "people" });
assert.equal(searchCtx.surface, "search");
assert.equal(searchCtx.searchQuery, "Stray Kids");
assert.equal(searchCtx.searchDestination, "people");

// D. Conversation context is peer + thread only
const threadCtx = contextFromNativeRoute("/thread", {
  conversationId: UUID_A,
  userId: UUID_B,
  handle: "minji",
  mediaUrl: "https://secret.example/private.jpg",
  caption: "do not send this",
});
assert.equal(threadCtx.surface, "conversation");
assert.equal(threadCtx.conversationId, UUID_A);
assert.equal(threadCtx.collectorUserId, UUID_B);
assert.equal(threadCtx.collectorHandle, "minji");
assert.equal(threadCtx.postId, undefined);

const stripped = parseAskContext({
  surface: "conversation",
  collectorUserId: UUID_B,
  personalMediaUrl: "https://secret",
  signedUrl: "https://secret",
  messages: [{ body: "private" }],
});
assert.equal("personalMediaUrl" in stripped, false);
assert.equal("messages" in stripped, false);

const companion = read("apps/mobile/src/ui/SeoullyCompanion.tsx");
const production = read("apps/mobile/src/data/production.ts");
const demoAsk = read("apps/mobile/src/data/demo/ask.ts");
const demoRepo = read("apps/mobile/src/data/demo/repository.ts");
const registry = read("src/server/assistant/registry.ts");
const service = read("src/server/assistant/service.ts");
const navigation = read("src/server/assistant/navigation.ts");
const api = read("apps/mobile/src/api.ts");
const en = read("apps/mobile/src/i18n.ts");
const ko = read("apps/mobile/src/i18n.ts");
const collectorScreen = read("apps/mobile/app/collector.tsx");
const collectibleScreen = read("apps/mobile/app/collectible.tsx");
const searchScreen = read("apps/mobile/app/(tabs)/search.tsx");
const threadScreen = read("apps/mobile/app/thread.tsx");

assertContains(collectorScreen, 'surface: "collector"', "collector.tsx context");
assertContains(collectibleScreen, 'surface: "collectible"', "collectible.tsx context");
assertContains(searchScreen, "searchQuery: activeQuery", "search.tsx context");
assertContains(threadScreen, 'surface: "conversation"', "thread.tsx context");
assertContains(companion, "mergeAskContext", "SeoullyCompanion");
assertContains(companion, "social.askSeoully(prompt, locale, history, context)", "SeoullyCompanion");
assertNotContains(companion, 'surface: "home"', "SeoullyCompanion");

// E. Production tools grounded
assertContains(registry, "getMyCollection", "registry");
assertContains(registry, "getCollectorCompatibility", "registry");
assertContains(registry, "getTradeOpportunity", "registry");
assertContains(registry, "searchSharedCatalog", "registry");
assertContains(registry, "checkMyCollectibleStatus", "registry");
assertContains(service, "executeAssistantTool", "service");
assertNotContains(registry, "HOLDINGS_FIXTURE", "registry");
assertNotContains(service, "MINJI", "service");

// F. Live failure never returns fixtures
assertContains(production, "askSeoullyNative", "production.ts");
assertNotContains(production, "SOO", "production.ts");
assertNotContains(production, "MINJI", "production.ts");
assertNotContains(production, "runAssistantTools", "production.ts");
assertContains(demoAsk, "runAssistantTools", "demo/ask.ts");
assertContains(demoRepo, "askDemo", "demo repository");

// G. Navigation allowlist
assert.equal(isAskNavigationAction({ type: "profile", userId: UUID_A }), true);
assert.equal(isAskNavigationAction({ type: "profile", userId: UUID_A, pathname: "/evil" }), false);
assert.equal(isAskNavigationAction({ type: "search", query: "Felix", destination: "people", url: "https://evil" }), false);
assert.equal(isAskNavigationAction({ type: "search", query: "Felix", destination: "people" }), true);
assert.equal(isAskNavigationAction({ type: "javascript", query: "x" }), false);
assertContains(companion, "isAskNavigationAction", "companion allowlist");
assertNotContains(companion, "action.pathname", "companion");

// H. Search preservation
assertContains(companion, "params: dest ? { q: nextQuery, dest } : nextQuery ? { q: nextQuery } : {}", "search params");
assertContains(companion, "isExploreDestination(action.destination)", "search dest");

// I. Collector navigation
assertContains(companion, 'pathname: "/collector"', "collector route");
assertContains(companion, "params: { userId: action.userId }", "collector userId");

// J. Room validation
assertContains(navigation, "collectorRoomIsAccessible", "navigation.ts");
assertContains(navigation, "getPublicRoomByHandle", "navigation.ts");
assertContains(registry, "validateAskNavigation", "registry");

// K. Ownership
assertContains(registry, "check_my_collectible_status", "registry");
assertContains(service, "check_my_collectible_status", "service");
assertContains(read("src/domain/assistant-tools.ts"), 'intent === "owned"', "demo ownership intent");

// L. Wishlist
assertContains(registry, "get_my_wishlist", "registry");
assertContains(registry, "find_wishlist_owners", "registry");

// M. Compatibility is engine result
assertContains(registry, "getCollectorCompatibility", "registry");
assertNotContains(registry, "Math.random", "registry");
assertContains(service, "assistant.answer.common", "service");

// N. Trade uses graph
assertContains(registry, "getTradeOpportunity", "registry");
assertContains(registry, "theyOwnThatIWant", "registry");

// O. Completeness disclaimer
assert.ok(CATALOG_COMPLETENESS_DISCLAIMER.en.includes("currently known to Seoully"));
assertContains(registry, "CATALOG_COMPLETENESS_DISCLAIMER", "registry");
assertContains(service, "CATALOG_COMPLETENESS_DISCLAIMER", "service");

// P. Privacy
assertNotContains(registry, "personalMediaUrl", "registry");
assertNotContains(registry, "signedUrl", "registry");
assertContains(navigation, "viewerParticipatesInConversation", "conversation privacy");
assertNotContains(companion, "mediaUrl", "companion context");
assertNotContains(companion, "params.caption", "companion");

// Q. No Vision
assertNotContains(registry, "vision", "registry");
assertNotContains(registry, "openai.com/v1/images", "registry");
assertNotContains(registry, "serpapi", "registry");
assertNotContains(registry, "google lens", "registry");
assertNotContains(service, "identifyCollectible", "service");

// R. Demo/Live
assertContains(demoAsk, "parseAskContext", "demo context");
assertContains(production, "askSeoullyNative", "live endpoint");
assertContains(api, "/api/mobile/assistant", "api.ts");

// S. Localization
assertContains(en, "askViewProfile: \"View profile\"", "i18n en");
assertContains(ko, "askViewProfile: \"프로필 보기\"", "i18n ko");
assertContains(en, "askStarterFind:", "i18n starters");
assertContains(ko, "askStarterFind:", "i18n ko starters");

// T. Reduced motion
assertContains(companion, "useReduceMotion", "companion");
assertContains(companion, "animationType={reduceMotion ? \"none\" : \"slide\"}", "companion");
assertContains(companion, "if (reduceMotion)", "companion bounce");

assert.equal(navigationIntentFromQuestion("Take me to my collection")?.type, "collection");
assert.equal(helpForQuestion("How do I add a photocard?", "u-soo").action.type, "add");
assertContains(read("src/domain/assistant-tools.ts"), 'collectorUserId ?? input.context.profileUserId', "demo collector context");

assertContains(read("docs/native-road-to-ship.md"), "Slice 6", "docs");

// U. General chat is not a canned switch
assert.equal(classifyAskNeed("When did BTS form?"), "general");
assert.equal(classifyAskNeed("Who are the members of LE SSERAFIM?"), "general");
assert.equal(classifyAskNeed("What is a POB?"), "general");
assert.equal(classifyAskNeed("What's the difference between a lucky draw and a normal photocard?"), "general");
assertNotContains(demoAsk, "When did BTS form?", "demo ask canned BTS");
assertNotContains(companion, "When did BTS form?", "companion canned BTS");
assertContains(companion, "void send(copy.askStarterFind)", "starters use chat pipeline");
assertContains(read("src/server/assistant-provider.ts"), 'tool_choice: "auto"', "optional tools");
assertContains(read("src/server/assistant-provider.ts"), "generateGeneralReply", "general OpenAI path");

// V. Seoully data classification
assert.equal(classifyAskNeed("What BTS stuff do I own?"), "seoully");
assert.equal(classifyAskNeed("What's on my wishlist?"), "seoully");
assert.equal(classifyAskNeed("Who are some collectors similar to me?"), "seoully");
assert.equal(classifyAskNeed("What am I missing?"), "seoully");
assertContains(registry, "get_my_collection", "holdings tool");
assertContains(registry, "get_my_wishlist", "wishlist tool");
assertContains(registry, "get_my_profile", "profile tool");
assertContains(registry, "searchSharedCatalog", "catalog tool");
assertContains(registry, "discoverCollectors", "compatibility discovery");
assertContains(registry, "FUTURE_ASSISTANT_TOOLS", "future current-info slot");
assertNotContains(registry, 'name: "search_current_information"', "current-info not registered");

// W. Navigation contract
const addNav = navigationIntentFromQuestion("Take me to add a collectible");
assert.equal(addNav?.type, "add");
assert.equal(navigationIntentFromQuestion("Show me my profile")?.type, "profile_self");
assert.equal(navigationIntentFromQuestion("Where do I edit my profile?")?.type, "edit_profile");
const btsCollectors = navigationIntentFromQuestion("Find BTS collectors");
assert.equal(btsCollectors?.type, "search");
if (btsCollectors?.type === "search") {
  assert.equal(btsCollectors.query, "BTS");
  assert.equal(btsCollectors.destination, "people");
}
assert.equal(extractAskSearchQuery("Find BTS collectors"), "BTS");
assert.equal(isAskNavigationAction({ type: "search", query: "BTS", destination: "people" }), true);
assert.equal(isAskNavigationAction({ type: "search", query: "BTS", pathname: "/evil" }), false);
assert.equal(isAskNavigationAction({ type: "profile", userId: UUID_A, href: "https://evil" }), false);
assert.equal(isAskNavigationAction({ type: "javascript", query: "x" }), false);
assertContains(companion, 'router.push("/edit-profile")', "edit profile route");
assertContains(companion, "result.navigation", "auto navigation");

// X. Response contract
const parsed = parseAskResult({
  reply: "Yep — I’ll take you there ♡",
  cards: [],
  navigation: { type: "add" },
  tool: "navigate",
  accessToken: "secret",
});
assert.equal(parsed.reply.includes("take you there"), true);
assert.equal(parsed.navigation?.type, "add");
assert.equal("accessToken" in parsed, false);
assert.equal("tool" in parsed, false);
assert.equal(parseAskResult({ reply: "ok", navigation: { type: "search", query: "x", url: "/evil" } }).navigation, undefined);

// Y. Conversation cap + reset
assert.equal(ASK_HISTORY_LIMIT, 8);
assertContains(service, ".max(8)", "history cap");
assertContains(companion, "turns.slice(-8)", "client history cap");
assertContains(companion, "setTurns([])", "new conversation reset");

// Z. Security / failure
assertNotContains(read("apps/mobile/src/config.ts"), "OPENAI", "no OpenAI in Expo config");
assertNotContains(api, "OPENAI", "no OpenAI in mobile api");
assertNotContains(companion, "OPENAI_API_KEY", "no secret in companion");
assertContains(api, 'response.status === 401', "unauthenticated ask");
assertContains(companion, "askRetry", "retry state");
assertContains(companion, "KeyboardAvoidingView", "keyboard-safe");
assertContains(service, "assistant.answer.openaiUnavailable", "openai failure copy");
assertContains(service, "assistant.answer.notConfigured", "missing config copy");
assertContains(demoAsk, "assistant.answer.demoGeneral", "demo general honesty");
assertContains(read("src/server/assistant-provider.ts"), "process.env.OPENAI_API_KEY", "server key only");
assertContains(read("src/server/assistant-provider.ts"), "process.env.OPENAI_MODEL", "server model only");

console.log("check:slice6 passed");
