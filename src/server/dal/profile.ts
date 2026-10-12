import "server-only";

import { z } from "zod";
import { profileAppearanceSchema } from "@/domain/profile-appearance";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IdentityProfileDTO } from "@/domain/identity";
import type { CollectorInterest, Profile, UserId } from "@/domain/types";
import { normalizeHandle } from "@/domain/session";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requestSupabaseClient } from "@/server/supabase/request-client";

const HANDLE_RE = /^[a-z][a-z0-9_]{2,15}$/;
const interestValues = ["albums", "photocards", "merch", "vinyl", "posters", "lightsticks", "everything"] as const;

export const currentProfilePatchSchema = z.object({
  appearance: profileAppearanceSchema.optional(),
  avatarSubmissionId: z.string().uuid().nullable().optional(),
  handle: z.string().trim().min(3).max(32).transform(normalizeHandle).pipe(z.string().regex(HANDLE_RE)).optional(),
  displayName: z.string().trim().min(1).max(48).optional(),
  tagline: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  location: z.string().trim().max(80).optional(),
  favoriteGroupIds: z.array(z.string().regex(/^[a-z0-9_-]{1,64}$/)).max(24).optional(),
  biasMemberIds: z.array(z.string().regex(/^[a-z0-9_-]{1,64}$/)).max(48).optional(),
  favoriteEraIds: z.array(z.string().regex(/^[a-z0-9_-]{1,64}$/)).max(48).optional(),
  collectorInterests: z.array(z.enum(interestValues)).max(7).optional(),
  collectorType: z.string().trim().min(1).max(64).optional(),
}).strict();

export type ValidCurrentProfilePatch = z.infer<typeof currentProfilePatchSchema>;

export interface PublicProfileDTO extends IdentityProfileDTO {
  visibility: { collectionPublic: boolean; wishlistPublic: boolean };
  followerCount: number;
  followingCount: number;
  roomAvailable: boolean;
  collectionSummary?: { holdingCount: number; uniqueTemplateCount: number; groupCount: number };
}

export async function getCurrentIdentity(): Promise<IdentityProfileDTO | null> {
  const supabase = requestSupabaseClient() ?? await createSupabaseServerClient();
  return getCurrentIdentityFromClient(supabase);
}

/** Resolve identity using the same client that just established an auth session. */
export async function getCurrentIdentityFromClient(supabase: SupabaseClient): Promise<IdentityProfileDTO | null> {
  const { data: authResult, error: authError } = await supabase.auth.getUser();
  if (authError || !authResult.user) return null;

  // The RPC repairs the rare missing app-row/profile case. It accepts no
  // identity argument and derives the provider subject only from auth.uid().
  const { data: userIdData, error: provisionError } = await supabase.rpc("ensure_current_seoully_identity");
  if (provisionError || typeof userIdData !== "string") {
    throw new Error("Could not provision the current Seoully identity.");
  }

  const { data: account, error: accountError } = await supabase
    .from("users")
    .select("id, created_at, status")
    .eq("id", userIdData)
    .maybeSingle();
  if (accountError || !account || account.status !== "active") {
    throw new Error("Current Seoully account is unavailable.");
  }

  const { data: profile, error: profileError } = await readProfileRow(supabase, "user_id", userIdData);
  if (profileError || !profile) throw new Error("Current Seoully profile is unavailable.");
  return withProfileAvatar(mapIdentity(account, profile), profile, supabase);
}

export async function getPublicProfile(userId: string, client?: SupabaseClient): Promise<PublicProfileDTO | null> {
  const parsedId = z.string().uuid().safeParse(userId);
  if (!parsedId.success) return null;
  const supabase = client ?? await createSupabaseServerClient();
  const { data: profile, error } = await readProfileRow(supabase, "user_id", parsedId.data);
  if (error || !profile) return null;
  return await hydratePublicProfile(await withProfileAvatar(mapIdentity({ id: profile.user_id, created_at: profile.created_at }, profile), profile, supabase), profile, supabase);
}

export async function getPublicProfileByHandle(handle: string): Promise<PublicProfileDTO | null> {
  const normalized = normalizeHandle(handle.replace(/^@/, ""));
  if (!HANDLE_RE.test(normalized)) return null;
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await readProfileRow(supabase, "handle", normalized);
  if (error || !profile) return null;
  return await hydratePublicProfile(await withProfileAvatar(mapIdentity({ id: profile.user_id, created_at: profile.created_at }, profile), profile, supabase), profile, supabase);
}

/** Pre-rollout compatibility: existing production has no avatar column yet. */
async function readProfileRow(client: SupabaseClient, field: "user_id" | "handle", value: string) {
  const result = await client.from("profiles").select("user_id, handle, display_name, tagline, bio, location, favorite_group_ids, bias_member_ids, favorite_era_ids, collector_interests, collector_type, appearance, created_at, collection_public, wishlist_public, avatar_id").eq(field, value).maybeSingle();
  if (result.error?.code === "42703" || result.error?.code === "PGRST204") {
    return client.from("profiles").select("user_id, handle, display_name, tagline, bio, location, favorite_group_ids, bias_member_ids, favorite_era_ids, collector_interests, collector_type, appearance, created_at, collection_public, wishlist_public").eq(field, value).maybeSingle();
  }
  return result;
}
async function withProfileAvatar(identity: IdentityProfileDTO, row: Record<string, unknown>, client: SupabaseClient): Promise<IdentityProfileDTO> {
  if (typeof row.avatar_id !== "string") return identity;
  const parsed = z.string().uuid().safeParse(row.avatar_id);
  if (!parsed.success) return identity;
  const { data, error } = await client.storage.from("profile-avatars").createSignedUrl(`${identity.user.id}/${parsed.data}.jpg`, 900);
  if (error || !data?.signedUrl) return identity;
  return { ...identity, profile: { ...identity.profile, avatarUrl: data.signedUrl } };
}

async function hydratePublicProfile(identity: IdentityProfileDTO, row: Record<string, unknown>, client?: SupabaseClient): Promise<PublicProfileDTO> {
  const supabase = client ?? await createSupabaseServerClient();
  const userId = identity.user.id;
  const [followers, following, room] = await Promise.all([
    supabase.from("follows").select("follower_user_id", { count: "exact", head: true }).eq("followed_user_id", userId),
    supabase.from("follows").select("followed_user_id", { count: "exact", head: true }).eq("follower_user_id", userId),
    supabase.rpc("get_public_room_by_handle", { p_handle: identity.user.handle }),
  ]);
  const summaryResult = row.collection_public !== false
    ? await supabase.rpc("get_public_collection_summary", { p_user_id: userId })
    : { data: null };
  const summary = summaryResult.data && typeof summaryResult.data === "object" ? summaryResult.data as Record<string, unknown> : null;
  return {
    ...identity,
    visibility: {
      collectionPublic: row.collection_public !== false,
      wishlistPublic: row.wishlist_public !== false,
    },
    followerCount: followers.count ?? 0,
    followingCount: following.count ?? 0,
    roomAvailable: Boolean(room.data && typeof room.data === "object" && (room.data as Record<string, unknown>).room),
    ...(summary ? { collectionSummary: { holdingCount: Number(summary.holdingCount ?? 0), uniqueTemplateCount: Number(summary.uniqueTemplateCount ?? 0), groupCount: Number(summary.groupCount ?? 0) } } : {}),
  };
}

export async function updateCurrentProfile(input: unknown, client?: SupabaseClient): Promise<IdentityProfileDTO> {
  const patch = currentProfilePatchSchema.parse(input);
  if (Object.keys(patch).length === 0) throw new Error("empty_profile_update");
  const current = client ? await getCurrentIdentityFromClient(client) : await getCurrentIdentity();
  if (!current) throw new Error("unauthenticated");

  const payload: Record<string, unknown> = {};
  if (patch.appearance !== undefined) payload.appearance = patch.appearance;
  if (patch.handle !== undefined) payload.handle = patch.handle;
  if (patch.displayName !== undefined) payload.display_name = patch.displayName;
  if (patch.tagline !== undefined) payload.tagline = patch.tagline;
  if (patch.bio !== undefined) payload.bio = patch.bio;
  if (patch.location !== undefined) payload.location = patch.location || null;
  if (patch.favoriteGroupIds !== undefined) payload.favorite_group_ids = patch.favoriteGroupIds;
  if (patch.biasMemberIds !== undefined) payload.bias_member_ids = patch.biasMemberIds;
  if (patch.favoriteEraIds !== undefined) payload.favorite_era_ids = patch.favoriteEraIds;
  if (patch.collectorInterests !== undefined) payload.collector_interests = patch.collectorInterests;
  if (patch.collectorType !== undefined) payload.collector_type = patch.collectorType;

  const supabase = client ?? await createSupabaseServerClient();
  if (patch.avatarSubmissionId !== undefined) {
    if (patch.avatarSubmissionId !== null) {
      const { data, error } = await supabase.storage.from("profile-avatars").createSignedUrl(`${current.user.id}/${patch.avatarSubmissionId}.jpg`, 60);
      if (error || !data?.signedUrl) throw new Error("profile_avatar_unavailable");
    }
    payload.avatar_id = patch.avatarSubmissionId;
  }
  const { error } = await supabase.from("profiles").update(payload).eq("user_id", current.user.id);
  if (error?.code === "23505") throw new Error("handle_taken");
  if (error) throw new Error("profile_update_failed");

  const updated = client ? await getCurrentIdentityFromClient(client) : await getCurrentIdentity();
  if (!updated) throw new Error("profile_missing");
  return updated;
}

function mapIdentity(
  account: { id: string; created_at: string },
  profile: {
    user_id: string;
    handle: string;
    display_name: string;
    tagline: string | null;
    bio: string | null;
    location: string | null;
    favorite_group_ids: string[];
    bias_member_ids: string[];
    favorite_era_ids: string[];
    collector_interests: CollectorInterest[];
    collector_type: string;
    appearance?: unknown;
    collection_public?: boolean;
    wishlist_public?: boolean;
  },
): IdentityProfileDTO {
  const userId = profile.user_id as UserId;
  const joinedAt = account.created_at.slice(0, 10);
  const mappedProfile: Pick<Profile, "userId" | "tagline" | "bio" | "location" | "favoriteGroupIds" | "biasMemberIds" | "favoriteEraIds" | "collectorInterests" | "collectorType" | "appearance"> = {
    appearance: profileAppearanceSchema.parse(profile.appearance ?? { mode: "room-sync" }),
    userId,
    tagline: profile.tagline ?? "",
    bio: profile.bio ?? "",
    favoriteGroupIds: profile.favorite_group_ids as Profile["favoriteGroupIds"],
    biasMemberIds: profile.bias_member_ids as Profile["biasMemberIds"],
    favoriteEraIds: profile.favorite_era_ids as Profile["favoriteEraIds"],
    collectorInterests: profile.collector_interests,
    collectorType: profile.collector_type,
  };
  if (profile.location) mappedProfile.location = profile.location;
  return {
    user: { id: userId, handle: profile.handle, displayName: profile.display_name, joinedAt },
    profile: mappedProfile,
  };
}
