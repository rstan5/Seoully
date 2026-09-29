import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEMO_CAPABILITIES, LIVE_CAPABILITIES } from "../apps/mobile/src/data/capabilities";
import { liveNoticePage, liveShareResult } from "../apps/mobile/src/data/honesty";
import {
  conversationIsUnread,
  conversationPairKey,
  conversationPreview,
  messageDtoOmitsPrivateMedia,
  messageHasSendableContext,
  noticeDestination,
  PRODUCTION_NOTICE_KINDS,
  sanitizeMessageBody,
  shouldNotifyRecipient,
} from "../src/server/social/comms-contract";

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

const en = read("apps/mobile/src/i18n.ts");
const sql = read("supabase/migrations/20261001000000_direct_messages.sql");
const messagesDal = read("src/server/dal/messages.ts");
const noticesDal = read("src/server/dal/notices.ts");
const social = read("src/server/dal/social.ts");
const demo = read("apps/mobile/src/data/demo/repository.ts");
const production = read("apps/mobile/src/data/production.ts");
const sendTo = read("apps/mobile/app/(tabs)/send-to.tsx");
const thread = read("apps/mobile/app/thread.tsx");
const inbox = read("apps/mobile/app/(tabs)/messages.tsx");
const notices = read("apps/mobile/app/(tabs)/notices.tsx");
const collector = read("apps/mobile/app/collector.tsx");
const roomTheme = read("supabase/migrations/20261002000000_native_room_theme.sql");

assert.equal(LIVE_CAPABILITIES.persistMessages, true);
assert.equal(LIVE_CAPABILITIES.persistNotices, true);
assert.equal(LIVE_CAPABILITIES.deliverShare, true);
assert.equal(DEMO_CAPABILITIES.persistMessages, true);
assert.equal(DEMO_CAPABILITIES.persistNotices, true);
assert.equal(DEMO_CAPABILITIES.deliverShare, true);
assert.deepEqual(liveShareResult(), { delivered: false });
assert.deepEqual(liveNoticePage(), { items: [], persisted: false });

// A. Non-participant cannot read — RLS + DAL participant assert
assertContains(sql, "direct_messages_select_participant", "DM migration");
assertContains(sql, "is_direct_conversation_participant", "DM migration");
assertContains(messagesDal, "conversation_forbidden", "messages.ts");

// B. Client cannot spoof sender
assertContains(sql, "sender_user_id = public.current_seoully_user_id()", "DM migration");
assertContains(messagesDal, "sender_user_id: actorId", "messages.ts");
assertContains(demo, "senderId: VIEWER", "demo repository");

// C. One-to-one conversation identity
assert.equal(conversationPairKey("b", "a"), conversationPairKey("a", "b"));
assertContains(sql, "direct_key text not null unique", "DM migration");
assertContains(sql, "least(actor::text, p_peer_user_id::text)", "DM migration");
assertContains(demo, "conversationPairKey(VIEWER, peerUserId)", "demo repository");

// D. Text message sendable; empty / whitespace-only attachmentless send is rejected before persist
assert.equal(messageHasSendableContext({ body: "Wait. You have the Hyunjin gold foil?" }), true);
assert.equal(messageHasSendableContext({ body: "" }), false);
assert.equal(messageHasSendableContext({ body: "   " }), false);
assert.equal(messageHasSendableContext({ body: "\n\t", templateIds: [] }), false);
assert.equal(messageHasSendableContext({ body: "   ", postId: null, templateIds: [] }), false);
assert.equal(sanitizeMessageBody("   ").length, 0);
assert.equal(sanitizeMessageBody(` ${"x".repeat(2100)} `).length, 2000);
assertContains(messagesDal, "throw new Error(\"message_empty\")", "messages.ts");
assert.ok(
  messagesDal.indexOf("throw new Error(\"message_empty\")") < messagesDal.indexOf(".from(\"direct_messages\").insert"),
  "empty message must be rejected before direct_messages insert",
);
assertContains(demo, "throw new Error(\"message_empty\")", "demo repository");
assert.ok(
  demo.indexOf("throw new Error(\"message_empty\")") < demo.indexOf("this.storedMessages.push(message)"),
  "demo empty message must be rejected before local persist",
);

// E. Structured public post reference — no private-post author exception
assert.equal(messageHasSendableContext({ body: "", postId: "11111111-1111-1111-1111-111111111111" }), true);
assertContains(sql, "post_id uuid references public.posts(id)", "DM migration");
assertContains(sql, "p.visibility = 'public'", "DM migration");
assertNotContains(sql, "or p.author_user_id = public.current_seoully_user_id()", "DM migration");
assertContains(messagesDal, "post_id: parsed.postId ?? null", "messages.ts");
assertContains(messagesDal, ".eq(\"visibility\", \"public\")", "messages.ts");
assertContains(messagesDal, "post_not_shareable", "messages.ts");
assertContains(messagesDal, "in(\"post_id\", publicIds)", "messages.ts");

// F. Structured collectible/template share
assert.equal(messageHasSendableContext({ body: "", templateIds: ["set-ate-pc-12"] }), true);
assertContains(sql, "direct_message_templates", "DM migration");
assertContains(messagesDal, "direct_message_templates", "messages.ts");
assertNotContains(messagesDal, "POST_ID:", "messages.ts");

// G. Trade context template IDs
assertContains(collector, "templateIds: templateIds.join(\",\")", "collector.tsx");
assertContains(thread, "templateIds: attachedIds", "thread.tsx");

// H. Private holding media never in message DTO
assert.equal(messageDtoOmitsPrivateMedia({ id: "m1", body: "hi", collectibles: [{ templateId: "t", name: "Venus" }] }), true);
assert.equal(messageDtoOmitsPrivateMedia({ id: "m1", personalMediaUrl: "https://secret" }), false);
assertNotContains(messagesDal, "personalMediaUrl", "messages.ts");
assertNotContains(messagesDal, "signedUrl", "messages.ts");

// I / J. Unread vs participant read cursor
assert.equal(conversationIsUnread({ lastMessageCreatedAt: "2025-02-13T11:42:00", lastMessageFromPeer: true, lastReadAt: null }), true);
assert.equal(conversationIsUnread({ lastMessageCreatedAt: "2025-02-13T11:42:00", lastMessageFromPeer: true, lastReadAt: "2025-02-13T12:00:00" }), false);
assert.equal(conversationIsUnread({ lastMessageCreatedAt: "2025-02-13T11:42:00", lastMessageFromPeer: false, lastReadAt: null }), false);
assertContains(sql, "last_read_at timestamptz", "DM migration");
assertContains(sql, "mark_direct_conversation_read", "DM migration");
assertContains(sql, "user_id = public.current_seoully_user_id()", "DM migration");
assertNotContains(sql, "Seen ", "DM migration");
assertNotContains(thread, "Seen ", "thread.tsx");

// K. Notices recipient-only
assertContains(sql, "social_notices_select_recipient", "DM migration");
assertContains(sql, "recipient_user_id = public.current_seoully_user_id()", "DM migration");
assertContains(noticesDal, "eq(\"recipient_user_id\", actorId)", "notices.ts");
assertContains(sql, "grant insert on public.direct_messages", "DM migration");
assertNotContains(sql, "grant insert on public.social_notices", "DM migration");

// L. Structured notice destinations (web: actor→collector, trade→thread)
assert.deepEqual(noticeDestination({ kind: "follow", actorUserId: "minji" }), { pathname: "/collector", params: { userId: "minji" } });
assert.deepEqual(noticeDestination({ kind: "like", actorUserId: "minji", postId: "p1" }), { pathname: "/collector", params: { userId: "minji" } });
assert.deepEqual(
  noticeDestination({ kind: "trade", actorUserId: "minji", templateIds: ["set-ate-pc-12"] }),
  { pathname: "/thread", params: { userId: "minji", templateIds: "set-ate-pc-12" } },
);
assertContains(notices, "noticeDestination", "notices.tsx");

// M. No self-notification
assert.equal(shouldNotifyRecipient("soo", "minji"), true);
assert.equal(shouldNotifyRecipient("soo", "soo"), false);
assertContains(sql, "check (recipient_user_id <> actor_user_id)", "DM migration");
assertContains(sql, "if author is null or author = actor then return", "DM migration");
assert.deepEqual([...PRODUCTION_NOTICE_KINDS], ["like", "comment", "follow"]);

// N. Send To does not claim sent before persistence
assertNotContains(sendTo, "sendToDelivered", "send-to.tsx");
assertContains(sendTo, "pathname: \"/thread\"", "send-to.tsx");
assertContains(thread, "setError(copy.messageFailed)", "thread.tsx");
assertContains(thread, "await social.sendMessage", "thread.tsx");

// O. Demo/Live isolation
assertContains(production, "liveShareResult", "production.ts");
assertContains(production, "if (!LIVE_CAPABILITIES.persistMessages) throw new Error(\"messages_unavailable\")", "production.ts");
assertContains(production, "liveNoticePage", "production.ts");
assertNotContains(demo, "/api/mobile/messages", "demo repository");
assertNotContains(demo, "sendProductionDirectMessage", "demo repository");
assertContains(demo, "this.storedMessages.push(message)", "demo repository");

// P. Localization
const required = [
  "messagesSearch",
  "threadSharedPost",
  "threadSharedCollectible",
  "threadAttached",
  "threadAddMessage",
  "threadPlaceholderAbout",
  "noticeLiked",
  "noticeCommented",
  "noticeFollowed",
  "noticeTrade",
  "noticeActivity",
  "noticeReposted",
  "noticeMessageAbout",
];
for (const key of required) {
  const matches = en.split(`${key}:`).length - 1;
  assert.equal(matches, 2, `${key} must exist in EN and KO`);
}

assertContains(social, "emitFollowNotice", "social.ts");
assertContains(social, "emitLikeNotice", "social.ts");
assertContains(social, "emitCommentNotice", "social.ts");
assertContains(social, "notices optional until communications schema is applied", "social.ts");
assertContains(inbox, "social.loadConversations", "messages.tsx");
assertContains(sql, "Do not apply without explicit human approval", "DM migration");
assertNotContains(sql, "native_room_theme", "DM migration");
assertContains(roomTheme, "theme_id", "room theme migration untouched");
assertNotContains(sql, "p_actor", "DM migration");
assert.equal((sql.match(/security definer/g) ?? []).length, (sql.match(/set search_path = pg_catalog, public, auth/g) ?? []).length);
assertContains(sql, "actor uuid := public.current_seoully_user_id()", "DM migration");
assertNotContains(sql, "grant insert on public.direct_conversations", "DM migration");
assertContains(sql, "grant insert on public.direct_messages, public.direct_message_templates to authenticated", "DM migration");
assertContains(messagesDal, "select(\"id,name,kind\")", "messages.ts");

assert.equal(
  conversationPreview({ body: "", hasPost: true }, { empty: "New", sharedPost: "Shared a post", sharedCollectible: "Shared a collectible" }),
  "Shared a post",
);

console.log("check:slice5 passed");
