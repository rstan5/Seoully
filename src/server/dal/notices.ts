import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";
import type { NoticeKind } from "@/server/social/comms-contract";

const uuid = z.string().uuid();

export interface SocialNoticeDTO {
  id: string;
  kind: NoticeKind;
  actor: { userId: string; handle: string; displayName: string };
  createdAt: string;
  read: boolean;
  postId?: string;
  templateIds?: string[];
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

export async function listSocialNotices(client: SupabaseClient): Promise<SocialNoticeDTO[]> {
  const actorId = await actor(client);
  const { data, error } = await client.from("social_notices")
    .select("id,kind,actor_user_id,post_id,created_at,read_at")
    .eq("recipient_user_id", actorId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(schemaUnavailable(error) ? "notices_unavailable" : "notices_read_failed");
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((row) => String(row.actor_user_id)))];
  const noticeIds = rows.map((row) => String(row.id));
  const [profiles, tags] = await Promise.all([
    actorIds.length ? client.from("profiles").select("user_id,handle,display_name").in("user_id", actorIds) : Promise.resolve({ data: [], error: null }),
    noticeIds.length ? client.from("social_notice_templates").select("notice_id,template_id").in("notice_id", noticeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profiles.error || tags.error) throw new Error("notices_read_failed");
  const profileById = new Map((profiles.data ?? []).map((row) => [String(row.user_id), row]));
  const templatesByNotice = new Map<string, string[]>();
  for (const row of tags.data ?? []) {
    const list = templatesByNotice.get(String(row.notice_id)) ?? [];
    list.push(String(row.template_id));
    templatesByNotice.set(String(row.notice_id), list);
  }
  return rows.flatMap((row) => {
    const profile = profileById.get(String(row.actor_user_id));
    if (!profile) return [];
    const templateIds = templatesByNotice.get(String(row.id));
    return [{
      id: String(row.id),
      kind: row.kind as NoticeKind,
      actor: { userId: String(row.actor_user_id), handle: String(profile.handle), displayName: String(profile.display_name) },
      createdAt: String(row.created_at),
      read: Boolean(row.read_at),
      ...(row.post_id ? { postId: String(row.post_id) } : {}),
      ...(templateIds?.length ? { templateIds } : {}),
    }];
  });
}

export async function unreadSocialNoticeCount(client: SupabaseClient): Promise<number> {
  const actorId = await actor(client);
  const { count, error } = await client.from("social_notices")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", actorId)
    .is("read_at", null);
  if (error) throw new Error(schemaUnavailable(error) ? "notices_unavailable" : "notices_read_failed");
  return count ?? 0;
}

export async function markSocialNoticesRead(client: SupabaseClient): Promise<void> {
  const actorId = await actor(client);
  const { error } = await client.from("social_notices")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_user_id", actorId)
    .is("read_at", null);
  if (error) throw new Error(schemaUnavailable(error) ? "notices_unavailable" : "notices_read_failed");
}

export async function emitLikeNotice(postId: unknown, client: SupabaseClient): Promise<void> {
  const id = uuid.parse(postId);
  const { error } = await client.rpc("emit_social_notice_like", { p_post_id: id });
  if (error && !schemaUnavailable(error)) throw new Error("notice_emit_failed");
}

export async function emitCommentNotice(commentId: unknown, client: SupabaseClient): Promise<void> {
  const id = uuid.parse(commentId);
  const { error } = await client.rpc("emit_social_notice_comment", { p_comment_id: id });
  if (error && !schemaUnavailable(error)) throw new Error("notice_emit_failed");
}

export async function emitFollowNotice(followeeUserId: unknown, client: SupabaseClient): Promise<void> {
  const id = uuid.parse(followeeUserId);
  const { error } = await client.rpc("emit_social_notice_follow", { p_followee_user_id: id });
  if (error && !schemaUnavailable(error)) throw new Error("notice_emit_failed");
}
