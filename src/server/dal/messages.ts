import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";

const uuid = z.string().uuid();
const bodySchema = z.string().trim().min(1).max(2_000);

export interface DirectConversationDTO {
  id: string;
  peer: { userId: string; handle: string; displayName: string };
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
}
export interface DirectMessageDTO {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean;
}

async function actor(client: SupabaseClient) {
  const identity = await getCurrentIdentityFromClient(client);
  if (!identity) throw new Error("unauthenticated");
  return identity.user.id;
}

export async function listDirectConversations(client: SupabaseClient): Promise<DirectConversationDTO[]> {
  const actorId = await actor(client);
  const memberships = await client.from("direct_conversation_participants").select("conversation_id").eq("user_id", actorId).limit(100);
  if (memberships.error) throw new Error("messages_read_failed");
  const conversationIds = (memberships.data ?? []).map((row) => String(row.conversation_id));
  if (!conversationIds.length) return [];
  const [participants, messages] = await Promise.all([
    client.from("direct_conversation_participants").select("conversation_id,user_id").in("conversation_id", conversationIds),
    client.from("direct_messages").select("id,conversation_id,sender_user_id,body,created_at").in("conversation_id", conversationIds).order("created_at", { ascending: false }).limit(500),
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
  return conversationIds.flatMap((id) => {
    const peerId = peerByConversation.get(id);
    const profile = peerId ? profileById.get(peerId) : null;
    if (!peerId || !profile) return [];
    const message = latest.get(id);
    return [{
      id,
      peer: { userId: peerId, handle: String(profile.handle), displayName: String(profile.display_name) },
      lastMessage: message ? { body: String(message.body), createdAt: String(message.created_at), mine: String(message.sender_user_id) === actorId } : null,
    }];
  }).sort((a, b) => (b.lastMessage?.createdAt ?? "").localeCompare(a.lastMessage?.createdAt ?? ""));
}

export async function ensureDirectConversation(peerUserId: unknown, client: SupabaseClient): Promise<string> {
  await actor(client);
  const peerId = uuid.parse(peerUserId);
  const { data, error } = await client.rpc("ensure_direct_conversation", { p_peer_user_id: peerId });
  if (error || typeof data !== "string") throw new Error("conversation_create_failed");
  return data;
}

export async function listDirectMessages(conversationId: unknown, client: SupabaseClient): Promise<DirectMessageDTO[]> {
  const actorId = await actor(client);
  const id = uuid.parse(conversationId);
  const { data, error } = await client.from("direct_messages")
    .select("id,conversation_id,sender_user_id,body,created_at")
    .eq("conversation_id", id).order("created_at", { ascending: true }).limit(200);
  if (error) throw new Error("messages_read_failed");
  return (data ?? []).map((row) => ({
    id: String(row.id), conversationId: String(row.conversation_id), body: String(row.body),
    createdAt: String(row.created_at), mine: String(row.sender_user_id) === actorId,
  }));
}

export async function sendDirectMessage(conversationId: unknown, body: unknown, client: SupabaseClient): Promise<DirectMessageDTO> {
  const actorId = await actor(client);
  const id = uuid.parse(conversationId);
  const text = bodySchema.parse(body);
  const { data, error } = await client.from("direct_messages")
    .insert({ conversation_id: id, sender_user_id: actorId, body: text })
    .select("id,conversation_id,sender_user_id,body,created_at").single();
  if (error || !data) throw new Error("message_send_failed");
  return { id: String(data.id), conversationId: String(data.conversation_id), body: String(data.body), createdAt: String(data.created_at), mine: true };
}
