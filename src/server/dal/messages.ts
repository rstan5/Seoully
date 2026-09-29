import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";
import { conversationIsUnread, messageHasSendableContext, sanitizeMessageBody } from "@/server/social/comms-contract";

const uuid = z.string().uuid();
const templateIdsSchema = z.array(uuid).max(12);

export interface DirectConversationDTO {
  id: string;
  peer: { userId: string; handle: string; displayName: string };
  lastMessage: { body: string; createdAt: string; mine: boolean; postId?: string; templateCount?: number } | null;
  unread: boolean;
}
export interface DirectMessageCollectible {
  templateId: string;
  name: string;
  kind: string;
}
export interface DirectMessagePost {
  id: string;
  authorUserId: string;
  authorHandle: string;
  caption: string;
  mediaUrl?: string;
}
export interface DirectMessageDTO {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  post: DirectMessagePost | null;
  collectibles: DirectMessageCollectible[];
}

async function actor(client: SupabaseClient) {
  const identity = await getCurrentIdentityFromClient(client);
  if (!identity) throw new Error("unauthenticated");
  return identity.user.id;
}

function schemaUnavailable(error: { message?: string; code?: string } | null) {
  const text = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
  return text.includes("does not exist") || text.includes("schema cache") || error?.code === "42P01" || error?.code === "PGRST205";
}

async function assertParticipant(client: SupabaseClient, conversationId: string, actorId: string) {
  const { data, error } = await client.from("direct_conversation_participants").select("user_id").eq("conversation_id", conversationId).eq("user_id", actorId).maybeSingle();
  if (error) throw new Error(schemaUnavailable(error) ? "messages_unavailable" : "messages_read_failed");
  if (!data) throw new Error("conversation_forbidden");
}

export async function listDirectConversations(client: SupabaseClient): Promise<DirectConversationDTO[]> {
  const actorId = await actor(client);
  const memberships = await client.from("direct_conversation_participants").select("conversation_id,last_read_at").eq("user_id", actorId).limit(100);
  if (memberships.error) throw new Error(schemaUnavailable(memberships.error) ? "messages_unavailable" : "messages_read_failed");
  const rows = memberships.data ?? [];
  if (!rows.length) return [];
  const conversationIds = rows.map((row) => String(row.conversation_id));
  const lastReadByConversation = new Map(rows.map((row) => [String(row.conversation_id), typeof row.last_read_at === "string" ? row.last_read_at : null]));
  const [participants, messages] = await Promise.all([
    client.from("direct_conversation_participants").select("conversation_id,user_id").in("conversation_id", conversationIds),
    client.from("direct_messages").select("id,conversation_id,sender_user_id,body,created_at,post_id").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(500),
  ]);
  if (participants.error || messages.error) throw new Error("messages_read_failed");
  const peerByConversation = new Map<string, string>();
  for (const row of participants.data ?? []) {
    const userId = String(row.user_id);
    if (userId !== actorId) peerByConversation.set(String(row.conversation_id), userId);
  }
  const peerIds = [...new Set(peerByConversation.values())];
  const profiles = peerIds.length
    ? await client.from("profiles").select("user_id,handle,display_name").in("user_id", peerIds)
    : { data: [], error: null };
  if (profiles.error) throw new Error("messages_read_failed");
  const profileById = new Map((profiles.data ?? []).map((row) => [String(row.user_id), row]));
  const latest = new Map<string, Record<string, unknown>>();
  for (const row of messages.data ?? []) {
    const conversationId = String(row.conversation_id);
    if (!latest.has(conversationId)) latest.set(conversationId, row);
  }
  const latestIds = [...latest.values()].map((row) => String(row.id));
  const templateCounts = await hydrateTemplates(client, latestIds);
  return conversationIds.flatMap((id) => {
    const peerId = peerByConversation.get(id);
    const profile = peerId ? profileById.get(peerId) : null;
    if (!peerId || !profile) return [];
    const message = latest.get(id);
    const templateCount = message ? (templateCounts.get(String(message.id)) ?? []).length : 0;
    const lastMessage = message ? {
      body: String(message.body ?? ""),
      createdAt: String(message.created_at),
      mine: String(message.sender_user_id) === actorId,
      ...(message.post_id ? { postId: String(message.post_id) } : {}),
      ...(templateCount ? { templateCount } : {}),
    } : null;
    return [{
      id,
      peer: { userId: peerId, handle: String(profile.handle), displayName: String(profile.display_name) },
      lastMessage,
      unread: conversationIsUnread({
        lastMessageCreatedAt: lastMessage?.createdAt ?? null,
        lastMessageFromPeer: Boolean(lastMessage && !lastMessage.mine),
        lastReadAt: lastReadByConversation.get(id) ?? null,
      }),
    }];
  }).sort((a, b) => (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""));
}

export async function ensureDirectConversation(peerUserId: unknown, client: SupabaseClient): Promise<string> {
  await actor(client);
  const peerId = uuid.parse(peerUserId);
  const { data, error } = await client.rpc("ensure_direct_conversation", { p_peer_user_id: peerId });
  if (error || typeof data !== "string") throw new Error(schemaUnavailable(error) ? "messages_unavailable" : "conversation_create_failed");
  return data;
}

async function hydrateMessagePosts(client: SupabaseClient, postIds: string[]): Promise<Map<string, DirectMessagePost>> {
  const unique = [...new Set(postIds.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await client.from("posts").select("id,author_user_id,caption,visibility").in("id", unique).eq("visibility", "public");
  if (error) throw new Error("messages_read_failed");
  const visible = data ?? [];
  const publicIds = visible.map((row) => String(row.id));
  const authors = [...new Set(visible.map((row) => String(row.author_user_id)))];
  const [profiles, media] = await Promise.all([
    authors.length ? client.from("profiles").select("user_id,handle").in("user_id", authors) : Promise.resolve({ data: [], error: null }),
    publicIds.length
      ? client.from("post_media").select("post_id,storage_bucket,storage_path,sort_order").in("post_id", publicIds).order("sort_order")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error || media.error) throw new Error("messages_read_failed");
  const handleById = new Map((profiles.data ?? []).map((row) => [String(row.user_id), String(row.handle)]));
  const mediaByPost = new Map<string, string>();
  for (const row of media.data ?? []) {
    const postId = String(row.post_id);
    if (mediaByPost.has(postId)) continue;
    mediaByPost.set(postId, client.storage.from(String(row.storage_bucket)).getPublicUrl(String(row.storage_path)).data.publicUrl);
  }
  return new Map(visible.map((row) => {
    const id = String(row.id);
    const url = mediaByPost.get(id);
    return [id, {
      id,
      authorUserId: String(row.author_user_id),
      authorHandle: handleById.get(String(row.author_user_id)) ?? "seoully",
      caption: String(row.caption ?? ""),
      ...(url ? { mediaUrl: url } : {}),
    }];
  }));
}

async function hydrateTemplates(client: SupabaseClient, messageIds: string[]): Promise<Map<string, DirectMessageCollectible[]>> {
  if (!messageIds.length) return new Map();
  const { data, error } = await client.from("direct_message_templates").select("message_id,template_id,sort_order").in("message_id", messageIds).order("sort_order");
  if (error) throw new Error(schemaUnavailable(error) ? "messages_unavailable" : "messages_read_failed");
  const templateIds = [...new Set((data ?? []).map((row) => String(row.template_id)))];
  const templates = templateIds.length
    ? await client.from("collectible_templates").select("id,name,kind").in("id", templateIds).neq("status", "restricted")
    : { data: [], error: null };
  if (templates.error) throw new Error("messages_read_failed");
  const byId = new Map((templates.data ?? []).map((row) => [String(row.id), { templateId: String(row.id), name: String(row.name), kind: String(row.kind) }]));
  const byMessage = new Map<string, DirectMessageCollectible[]>();
  for (const row of data ?? []) {
    const item = byId.get(String(row.template_id));
    if (!item) continue;
    const list = byMessage.get(String(row.message_id)) ?? [];
    list.push(item);
    byMessage.set(String(row.message_id), list);
  }
  return byMessage;
}

export async function listDirectMessages(conversationId: unknown, client: SupabaseClient): Promise<DirectMessageDTO[]> {
  const actorId = await actor(client);
  const id = uuid.parse(conversationId);
  await assertParticipant(client, id, actorId);
  const { data, error } = await client.from("direct_messages")
    .select("id,conversation_id,sender_user_id,body,created_at,post_id")
    .eq("conversation_id", id).order("created_at", { ascending: true }).limit(200);
  if (error) throw new Error(schemaUnavailable(error) ? "messages_unavailable" : "messages_read_failed");
  const rows = data ?? [];
  const posts = await hydrateMessagePosts(client, rows.flatMap((row) => row.post_id ? [String(row.post_id)] : []));
  const collectibles = await hydrateTemplates(client, rows.map((row) => String(row.id)));
  return rows.map((row) => ({
    id: String(row.id),
    conversationId: String(row.conversation_id),
    body: String(row.body ?? ""),
    createdAt: String(row.created_at),
    mine: String(row.sender_user_id) === actorId,
    post: row.post_id ? posts.get(String(row.post_id)) ?? null : null,
    collectibles: collectibles.get(String(row.id)) ?? [],
  }));
}

export async function markDirectConversationRead(conversationId: unknown, client: SupabaseClient): Promise<void> {
  await actor(client);
  const id = uuid.parse(conversationId);
  const { error } = await client.rpc("mark_direct_conversation_read", { p_conversation_id: id });
  if (error) throw new Error(schemaUnavailable(error) ? "messages_unavailable" : "messages_read_failed");
}

export async function sendDirectMessage(input: unknown, client: SupabaseClient): Promise<DirectMessageDTO> {
  const parsed = z.object({
    conversationId: uuid.optional(),
    peerUserId: uuid.optional(),
    body: z.string().max(2000).optional(),
    postId: uuid.optional(),
    templateIds: templateIdsSchema.optional(),
  }).strict().parse(input);
  const actorId = await actor(client);
  const body = sanitizeMessageBody(parsed.body ?? "");
  const templateIds = [...new Set(parsed.templateIds ?? [])];
  if (!messageHasSendableContext({ body, postId: parsed.postId, templateIds })) throw new Error("message_empty");
  if (parsed.postId) {
    const shared = await client.from("posts").select("id").eq("id", parsed.postId).eq("visibility", "public").maybeSingle();
    if (shared.error || !shared.data) throw new Error("post_not_shareable");
  }
  const conversationId = parsed.conversationId ?? await ensureDirectConversation(parsed.peerUserId, client);
  await assertParticipant(client, conversationId, actorId);
  const { data, error } = await client.from("direct_messages").insert({
    conversation_id: conversationId,
    sender_user_id: actorId,
    body,
    post_id: parsed.postId ?? null,
  }).select("id,conversation_id,sender_user_id,body,created_at,post_id").single();
  if (error || !data) throw new Error(schemaUnavailable(error) ? "messages_unavailable" : "message_send_failed");
  if (templateIds.length) {
    const { error: tagError } = await client.from("direct_message_templates").insert(templateIds.map((template_id, sort_order) => ({ message_id: data.id, template_id, sort_order })));
    if (tagError) throw new Error("message_send_failed");
  }
  const items = await listDirectMessages(conversationId, client);
  const created = items.find((item) => item.id === String(data.id));
  if (!created) throw new Error("message_read_failed");
  return created;
}
