import "server-only";

import { z } from "zod";
import type { IdentityProfileDTO } from "@/domain/identity";
import type { CollectorInterest, Profile, UserId } from "@/domain/types";
import { normalizeHandle } from "@/domain/session";
import { createSupabaseServerClient } from "@/server/supabase/server";

const HANDLE_RE = /^[a-z][a-z0-9_]{2,15}$/;
const interestValues = ["albums", "photocards", "merch", "vinyl", "posters", "lightsticks", "everything"] as const;

export const currentProfilePatchSchema = z.object({
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

export interface PublicProfileDTO extends IdentityProfileDTO {}

export async function getCurrentIdentity(): Promise<IdentityProfileDTO | null> {
  const supabase = await createSupabaseServerClient();
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, tagline, bio, location, favorite_group_ids, bias_member_ids, favorite_era_ids, collector_interests, collector_type")
    .eq("user_id", userIdData)
    .maybeSingle();
  if (profileError || !profile) throw new Error("Current Seoully profile is unavailable.");

  return mapIdentity(account, profile);
}

export async function getPublicProfile(userId: string): Promise<PublicProfileDTO | null> {
  const parsedId = z.string().uuid().safeParse(userId);
  if (!parsedId.success) return null;
  const supabase = await createSupabaseServerClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, handle, display_name, tagline, bio, location, favorite_group_ids, bias_member_ids, favorite_era_ids, collector_interests, collector_type, created_at")
    .eq("user_id", parsedId.data)
    .maybeSingle();
  if (error || !profile) return null;
  return mapIdentity({ id: profile.user_id, created_at: profile.created_at }, profile);
}

export async function updateCurrentProfile(input: unknown): Promise<IdentityProfileDTO> {
  const patch = currentProfilePatchSchema.parse(input);
  if (Object.keys(patch).length === 0) throw new Error("empty_profile_update");
  const current = await getCurrentIdentity();
  if (!current) throw new Error("unauthenticated");

  const payload: Record<string, unknown> = {};
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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update(payload).eq("user_id", current.user.id);
  if (error?.code === "23505") throw new Error("handle_taken");
  if (error) throw new Error("profile_update_failed");

  const updated = await getCurrentIdentity();
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
  },
): IdentityProfileDTO {
  const userId = profile.user_id as UserId;
  const joinedAt = account.created_at.slice(0, 10);
  const mappedProfile: Pick<Profile, "userId" | "tagline" | "bio" | "location" | "favoriteGroupIds" | "biasMemberIds" | "favoriteEraIds" | "collectorInterests" | "collectorType"> = {
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
