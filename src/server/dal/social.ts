import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { searchSharedCatalog, type CatalogTemplateDTO } from "@/server/dal/catalog";

const uuid = z.string().uuid();
const pageSchema = z.object({ limit: z.number().int().min(1).max(25).default(20), cursor: z.string().trim().max(300).optional() }).strict();
const postIdSchema = z.string().uuid();
const MAX_MEDIA_BYTES = 50 * 1024 * 1024;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]);

export interface SocialProfileSummary { userId: string; handle: string; displayName: string; }
export interface SocialMediaDTO { id: string; mediaType: "image" | "video"; mimeType: string; url: string; byteSize: number; sortOrder: number; }
export interface SocialUserTag { userId: string; handle: string; displayName: string; }
export interface SocialCollectibleTag { templateId: string; name: string; kind: string; }
export interface SocialCommentDTO { id: string; postId: string; author: SocialProfileSummary; body: string; createdAt: string; }
export interface SocialPostDTO {
  id: string;
  author: SocialProfileSummary;
  caption: string;
  location: string | null;
  visibility: "public";
  createdAt: string;
  media: SocialMediaDTO[];
  taggedUsers: SocialUserTag[];
  taggedCollectibles: SocialCollectibleTag[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}
export interface SocialPage<T> { items: T[]; nextCursor: string | null; }
export interface SocialSearchUser { userId: string; handle: string; displayName: string; }

type Row = Record<string, unknown>;

async function actorClient() {
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  return { identity, supabase: await createSupabaseServerClient() };
}

function encodeCursor(createdAt: string, id: string): string { return Buffer.from(JSON.stringify({ createdAt, id }), "utf8").toString("base64url"); }
function decodeCursor(value?: string): { createdAt: string; id: string } | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { createdAt?: unknown; id?: unknown };
    return typeof parsed.createdAt === "string" && z.string().uuid().safeParse(parsed.id).success ? { createdAt: parsed.createdAt, id: String(parsed.id) } : null;
  } catch { throw new Error("invalid_cursor"); }
}

function profileSummary(row: Row): SocialProfileSummary { return { userId: String(row.user_id), handle: String(row.handle), displayName: String(row.display_name) }; }

async function hydratePosts(rows: Row[], actorId: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<SocialPostDTO[]> {
  const postIds = rows.map((row) => String(row.id));
  if (!postIds.length) return [];
  const authorIds = [...new Set(rows.map((row) => String(row.author_user_id)))];
  const [profilesResult, mediaResult, userTagsResult, collectibleTagsResult, likesResult] = await Promise.all([
    supabase.from("profiles").select("user_id,handle,display_name").in("user_id", authorIds),
    supabase.from("post_media").select("id,post_id,media_type,mime_type,byte_size,storage_bucket,storage_path,sort_order").in("post_id", postIds).order("sort_order"),
    supabase.from("post_user_tags").select("post_id,tagged_user_id").in("post_id", postIds),
    supabase.from("post_collectible_tags").select("post_id,template_id").in("post_id", postIds),
    supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", actorId),
  ]);
  if (profilesResult.error || mediaResult.error || userTagsResult.error || collectibleTagsResult.error || likesResult.error) throw new Error("social_read_failed");
  const taggedUserIds = [...new Set((userTagsResult.data ?? []).map((row) => String(row.tagged_user_id)))];
  const templateIds = [...new Set((collectibleTagsResult.data ?? []).map((row) => String(row.template_id)))];
  const [taggedProfilesResult, templatesResult] = await Promise.all([
    taggedUserIds.length ? supabase.from("profiles").select("user_id,handle,display_name").in("user_id", taggedUserIds) : Promise.resolve({ data: [], error: null }),
    templateIds.length ? supabase.from("collectible_templates").select("id,name,kind").in("id", templateIds).neq("status", "restricted") : Promise.resolve({ data: [], error: null }),
  ]);
  if (taggedProfilesResult.error || templatesResult.error) throw new Error("social_read_failed");
  const profiles = new Map((profilesResult.data ?? []).map((row) => [String(row.user_id), profileSummary(row)]));
  const taggedProfiles = new Map((taggedProfilesResult.data ?? []).map((row) => [String(row.user_id), profileSummary(row)]));
  const templates = new Map((templatesResult.data ?? []).map((row) => [String(row.id), { templateId: String(row.id), name: String(row.name), kind: String(row.kind) }]));
  const mediaByPost = new Map<string, SocialMediaDTO[]>();
  for (const row of mediaResult.data ?? []) {
    const list = mediaByPost.get(String(row.post_id)) ?? [];
    list.push({ id: String(row.id), mediaType: row.media_type as SocialMediaDTO["mediaType"], mimeType: String(row.mime_type), url: supabase.storage.from(String(row.storage_bucket)).getPublicUrl(String(row.storage_path)).data.publicUrl, byteSize: Number(row.byte_size), sortOrder: Number(row.sort_order) });
    mediaByPost.set(String(row.post_id), list);
  }
  const taggedUsersByPost = new Map<string, SocialUserTag[]>();
  for (const row of userTagsResult.data ?? []) { const tag = taggedProfiles.get(String(row.tagged_user_id)); if (tag) taggedUsersByPost.set(String(row.post_id), [...(taggedUsersByPost.get(String(row.post_id)) ?? []), tag]); }
  const taggedCollectiblesByPost = new Map<string, SocialCollectibleTag[]>();
  for (const row of collectibleTagsResult.data ?? []) { const tag = templates.get(String(row.template_id)); if (tag) taggedCollectiblesByPost.set(String(row.post_id), [...(taggedCollectiblesByPost.get(String(row.post_id)) ?? []), tag]); }
  const liked = new Set((likesResult.data ?? []).map((row) => String(row.post_id)));
  return rows.flatMap((row) => {
    const author = profiles.get(String(row.author_user_id));
    if (!author) return [];
    const likeCount = Array.isArray(row.post_likes) ? Number((row.post_likes[0] as Row | undefined)?.count ?? 0) : Number(row.like_count ?? 0);
    const commentCount = Array.isArray(row.post_comments) ? Number((row.post_comments[0] as Row | undefined)?.count ?? 0) : Number(row.comment_count ?? 0);
    return [{ id: String(row.id), author, caption: String(row.caption ?? ""), location: typeof row.location_text === "string" ? row.location_text : null, visibility: "public" as const, createdAt: String(row.created_at), media: mediaByPost.get(String(row.id)) ?? [], taggedUsers: taggedUsersByPost.get(String(row.id)) ?? [], taggedCollectibles: taggedCollectiblesByPost.get(String(row.id)) ?? [], likeCount, commentCount, likedByMe: liked.has(String(row.id)) }];
  });
}

async function listPosts(authorIds: string[], input: unknown): Promise<SocialPage<SocialPostDTO>> {
  const page = pageSchema.parse(input ?? {}); const cursor = decodeCursor(page.cursor); const { identity, supabase } = await actorClient();
  let query = supabase.from("posts").select("id,author_user_id,caption,location_text,visibility,created_at,post_likes(count),post_comments(count)").in("author_user_id", authorIds).eq("visibility", "public").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(page.limit + 1);
  if (cursor) query = query.or("created_at.lt." + cursor.createdAt + ",and(created_at.eq." + cursor.createdAt + ",id.lt." + cursor.id + ")");
  const { data, error } = await query;
  if (error) throw new Error("social_read_failed");
  const rows = (data ?? []) as unknown as Row[]; const hasMore = rows.length > page.limit; const visibleRows = rows.slice(0, page.limit);
  const items = await hydratePosts(visibleRows, identity.user.id, supabase);
  return { items, nextCursor: hasMore && visibleRows.length ? encodeCursor(String(visibleRows.at(-1)!.created_at), String(visibleRows.at(-1)!.id)) : null };
}

export async function getProductionFeed(input?: unknown): Promise<SocialPage<SocialPostDTO>> {
  const { identity, supabase } = await actorClient();
  const { data, error } = await supabase.from("follows").select("followed_user_id").eq("follower_user_id", identity.user.id).limit(100);
  if (error) throw new Error("social_read_failed");
  return listPosts([identity.user.id, ...(data ?? []).map((row) => String(row.followed_user_id))], input);
}

export async function searchProductionUsers(query: unknown): Promise<SocialSearchUser[]> {
  const text = z.string().trim().max(120).parse(query); const { identity, supabase } = await actorClient();
  const safeText = text.replace(/[%(),]/g, " ");
  let request = supabase.from("profiles").select("user_id,handle,display_name").neq("user_id", identity.user.id).order("display_name").limit(8);
  if (safeText) request = request.or("handle.ilike.%" + safeText + "%,display_name.ilike.%" + safeText + "%");
  const { data, error } = await request; if (error) throw new Error("social_search_failed");
  return (data ?? []).map((row) => ({ userId: String(row.user_id), handle: String(row.handle), displayName: String(row.display_name) }));
}

export async function searchProductionCollectibles(query: unknown): Promise<CatalogTemplateDTO[]> {
  return searchSharedCatalog({ query: z.string().trim().max(120).parse(query), limit: 8, offset: 0 });
}

export async function getProductionProfilePosts(userId: unknown, input?: unknown): Promise<SocialPage<SocialPostDTO>> {
  return listPosts([uuid.parse(userId)], input);
}

export async function followUser(userId: unknown): Promise<{ following: boolean }> {
  const target = uuid.parse(userId); const { identity, supabase } = await actorClient();
  if (target === identity.user.id) throw new Error("cannot_follow_self");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("user_id").eq("user_id", target).maybeSingle();
  if (profileError) throw new Error("follow_failed"); if (!profile) throw new Error("collector_not_found");
  const { error } = await supabase.from("follows").upsert({ follower_user_id: identity.user.id, followed_user_id: target }, { onConflict: "follower_user_id,followed_user_id", ignoreDuplicates: true });
  if (error) throw new Error("follow_failed"); return { following: true };
}

export async function unfollowUser(userId: unknown): Promise<{ following: boolean }> {
  const target = uuid.parse(userId); const { identity, supabase } = await actorClient();
  const { error } = await supabase.from("follows").delete().eq("follower_user_id", identity.user.id).eq("followed_user_id", target);
  if (error) throw new Error("unfollow_failed"); return { following: false };
}

export async function getFollowState(userId: unknown): Promise<{ following: boolean; followers: number; followingCount: number }> {
  const target = uuid.parse(userId); const { identity, supabase } = await actorClient();
  const [state, followers, following] = await Promise.all([
    supabase.from("follows").select("follower_user_id").eq("follower_user_id", identity.user.id).eq("followed_user_id", target).maybeSingle(),
    supabase.from("follows").select("follower_user_id", { count: "exact", head: true }).eq("followed_user_id", target),
    supabase.from("follows").select("followed_user_id", { count: "exact", head: true }).eq("follower_user_id", target),
  ]);
  if (state.error || followers.error || following.error) throw new Error("follow_read_failed");
  return { following: Boolean(state.data), followers: followers.count ?? 0, followingCount: following.count ?? 0 };
}

export async function likePost(postId: unknown): Promise<{ liked: boolean }> {
  const id = postIdSchema.parse(postId); const { identity, supabase } = await actorClient();
  const { error } = await supabase.from("post_likes").upsert({ post_id: id, user_id: identity.user.id }, { onConflict: "post_id,user_id", ignoreDuplicates: true });
  if (error) throw new Error("like_failed"); return { liked: true };
}

export async function unlikePost(postId: unknown): Promise<{ liked: boolean }> {
  const id = postIdSchema.parse(postId); const { identity, supabase } = await actorClient();
  const { error } = await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", identity.user.id);
  if (error) throw new Error("unlike_failed"); return { liked: false };
}

export async function listPostComments(postId: unknown, input?: unknown): Promise<SocialPage<SocialCommentDTO>> {
  const id = postIdSchema.parse(postId); const page = pageSchema.parse(input ?? {}); const cursor = decodeCursor(page.cursor); const { supabase } = await actorClient();
  let query = supabase.from("post_comments").select("id,post_id,author_user_id,body,created_at").eq("post_id", id).order("created_at", { ascending: true }).order("id", { ascending: true }).limit(page.limit + 1);
  if (cursor) query = query.or("created_at.gt." + cursor.createdAt + ",and(created_at.eq." + cursor.createdAt + ",id.gt." + cursor.id + ")");
  const { data, error } = await query; if (error) throw new Error("comments_read_failed");
  const rows = (data ?? []) as unknown as Row[]; const hasMore = rows.length > page.limit; const visible = rows.slice(0, page.limit); const authors = [...new Set(visible.map((row) => String(row.author_user_id)))];
  const profiles = authors.length ? await supabase.from("profiles").select("user_id,handle,display_name").in("user_id", authors) : { data: [], error: null };
  if (profiles.error) throw new Error("comments_read_failed"); const map = new Map((profiles.data ?? []).map((row) => [String(row.user_id), profileSummary(row)]));
  const items = visible.flatMap((row) => { const author = map.get(String(row.author_user_id)); return author ? [{ id: String(row.id), postId: String(row.post_id), author, body: String(row.body), createdAt: String(row.created_at) }] : []; });
  return { items, nextCursor: hasMore && visible.length ? encodeCursor(String(visible.at(-1)!.created_at), String(visible.at(-1)!.id)) : null };
}

export async function createPost(input: { file: File; caption?: unknown; location?: unknown; taggedUserIds?: unknown; taggedTemplateIds?: unknown }): Promise<SocialPostDTO> {
  const caption = z.string().trim().max(2_000).optional().parse(input.caption); const location = z.string().trim().max(160).optional().parse(input.location);
  const taggedUserIds = z.array(uuid).max(10).default([]).parse(input.taggedUserIds); const taggedTemplateIds = z.array(uuid).max(10).default([]).parse(input.taggedTemplateIds);
  const file = input.file; if (!(file instanceof File) || !allowedMime.has(file.type) || file.size <= 0 || file.size > MAX_MEDIA_BYTES) throw new Error("invalid_media");
  if (!(await matchesMediaSignature(file))) throw new Error("invalid_media");
  const { identity, supabase } = await actorClient();
  if (taggedUserIds.length) { const { data, error } = await supabase.from("profiles").select("user_id").in("user_id", taggedUserIds); if (error || (data ?? []).length !== taggedUserIds.length) throw new Error("invalid_user_tag"); }
  if (taggedTemplateIds.length) { const { data, error } = await supabase.from("collectible_templates").select("id").in("id", taggedTemplateIds).neq("status", "restricted"); if (error || (data ?? []).length !== taggedTemplateIds.length) throw new Error("invalid_collectible_tag"); }
  const { data: post, error: postError } = await supabase.from("posts").insert({ author_user_id: identity.user.id, caption: caption || null, location_text: location || null, visibility: "public" }).select("id").single();
  if (postError || !post) throw new Error("post_create_failed");
  const postId = String(post.id); const path = identity.user.id + "/" + postId + "/0";
  try {
    const upload = await supabase.storage.from("post-media").upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw new Error("post_media_upload_failed");
    const { error: mediaError } = await supabase.from("post_media").insert({ post_id: postId, owner_user_id: identity.user.id, storage_bucket: "post-media", storage_path: path, media_type: file.type.startsWith("video/") ? "video" : "image", mime_type: file.type, byte_size: file.size, sort_order: 0 });
    if (mediaError) throw new Error("post_media_record_failed");
    if (taggedUserIds.length) { const { error } = await supabase.from("post_user_tags").insert(taggedUserIds.map((tagged_user_id) => ({ post_id: postId, tagged_user_id }))); if (error) throw new Error("post_user_tag_failed"); }
    if (taggedTemplateIds.length) { const { error } = await supabase.from("post_collectible_tags").insert(taggedTemplateIds.map((template_id) => ({ post_id: postId, template_id }))); if (error) throw new Error("post_collectible_tag_failed"); }
    const page = await listPosts([identity.user.id], { limit: 1 }); const created = page.items.find((item) => item.id === postId); if (!created) throw new Error("post_read_failed"); return created;
  } catch (error) {
    await supabase.storage.from("post-media").remove([path]);
    await supabase.from("posts").delete().eq("id", postId).eq("author_user_id", identity.user.id);
    throw error;
  }
}

export async function createComment(postId: unknown, body: unknown): Promise<SocialCommentDTO> {
  const id = postIdSchema.parse(postId); const text = z.string().trim().min(1).max(1_000).parse(body); const { identity, supabase } = await actorClient();
  const { data, error } = await supabase.from("post_comments").insert({ post_id: id, author_user_id: identity.user.id, body: text }).select("id,post_id,author_user_id,body,created_at").single();
  if (error || !data) throw new Error("comment_create_failed");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("user_id,handle,display_name").eq("user_id", identity.user.id).single();
  if (profileError || !profile) throw new Error("comment_read_failed");
  return { id: String(data.id), postId: String(data.post_id), author: profileSummary(profile), body: String(data.body), createdAt: String(data.created_at) };
}

export async function deletePost(postId: unknown): Promise<{ deleted: boolean }> {
  const id = postIdSchema.parse(postId); const { identity, supabase } = await actorClient();
  const { data: media } = await supabase.from("post_media").select("storage_bucket,storage_path").eq("post_id", id).eq("owner_user_id", identity.user.id);
  const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_user_id", identity.user.id); if (error) throw new Error("post_delete_failed");
  if (media?.length) { const cleanup = await supabase.storage.from("post-media").remove(media.map((row) => String(row.storage_path))); if (cleanup.error) console.warn("post_media_storage_cleanup_failed", cleanup.error.message); }
  return { deleted: true };
}

export { MAX_MEDIA_BYTES };

async function matchesMediaSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (file.type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/webp") return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (file.type === "video/webm") return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  return bytes.length >= 8 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
}
