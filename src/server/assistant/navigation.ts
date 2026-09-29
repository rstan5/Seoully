import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAskNavigationAction,
  isAskSearchDestination,
  type AskNavigationAction,
  type AskSearchDestination,
  type AskSurfaceContext,
} from "@/domain/ask-context";
import { getPublicProfile } from "@/server/dal/profile";
import { getPublicRoomByHandle } from "@/server/dal/public-room";
import { viewerParticipatesInConversation } from "@/server/dal/messages";
import { getSharedCatalogTemplate } from "@/server/dal/catalog";

export async function viewerOwnsRoom(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await supabase.from("rooms").select("id").eq("owner_user_id", userId).maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

export async function collectorRoomIsAccessible(
  supabase: SupabaseClient,
  actorId: string,
  targetUserId: string,
): Promise<{ ok: true; handle: string } | { ok: false }> {
  if (targetUserId === actorId) {
    return (await viewerOwnsRoom(supabase, actorId)) ? { ok: true, handle: "" } : { ok: false };
  }
  const profile = await getPublicProfile(targetUserId, supabase);
  if (!profile?.user.handle) return { ok: false };
  if (!profile.roomAvailable) return { ok: false };
  try {
    const room = await getPublicRoomByHandle(profile.user.handle, supabase);
    if (!room || room.private || !room.room) return { ok: false };
    return { ok: true, handle: profile.user.handle };
  } catch {
    return { ok: false };
  }
}

export async function validateAskNavigation(
  action: AskNavigationAction,
  actorId: string,
  supabase: SupabaseClient,
): Promise<AskNavigationAction | null> {
  if (!isAskNavigationAction(action)) return null;
  if (action.type === "profile") {
    if (action.userId === actorId) return { type: "profile_self" };
    const profile = await getPublicProfile(action.userId, supabase);
    return profile ? action : null;
  }
  if (action.type === "room") {
    const access = await collectorRoomIsAccessible(supabase, actorId, action.userId);
    return access.ok ? action : null;
  }
  if (action.type === "conversation") {
    const participates = await viewerParticipatesInConversation(supabase, action.conversationId);
    return participates ? action : null;
  }
  if (action.type === "collectible") {
    const { data, error } = await supabase.from("holdings").select("id").eq("id", action.holdingId).eq("owner_user_id", actorId).maybeSingle();
    if (error || !data) return null;
    return action;
  }
  if (action.type === "public_collectible") {
    const profile = await getPublicProfile(action.userId, supabase);
    if (!profile) return null;
    if (action.templateId) {
      const template = await getSharedCatalogTemplate(action.templateId);
      if (!template) return null;
    }
    return action;
  }
  if (action.type === "search") {
    const destination = action.destination && isAskSearchDestination(action.destination) ? action.destination : undefined;
    return { type: "search", query: action.query.slice(0, 120), ...(destination ? { destination } : {}) };
  }
  return action;
}

export function navigationFromContext(
  destination: "profile" | "profile_self" | "room" | "collection" | "wishlist" | "search" | "inbox" | "composer" | "add" | "conversation",
  context: AskSurfaceContext,
  query: string,
  searchDestination?: AskSearchDestination,
): AskNavigationAction {
  if (destination === "search") {
    const q = (query || context.searchQuery || "").slice(0, 120);
    const dest = searchDestination ?? context.searchDestination;
    return { type: "search", query: q, ...(dest ? { destination: dest } : {}) };
  }
  if (destination === "conversation" && context.conversationId) {
    return { type: "conversation", conversationId: context.conversationId, ...(context.collectorUserId ? { userId: context.collectorUserId } : {}) };
  }
  if (destination === "profile" && context.collectorUserId) return { type: "profile", userId: context.collectorUserId };
  if (destination === "room" && (context.roomOwnerUserId || context.collectorUserId)) {
    return { type: "room", userId: context.roomOwnerUserId ?? context.collectorUserId! };
  }
  if (destination === "profile_self") return { type: "profile_self" };
  if (destination === "collection") return { type: "collection" };
  if (destination === "wishlist") return { type: "wishlist" };
  if (destination === "inbox") return { type: "inbox" };
  if (destination === "composer") return { type: "composer" };
  if (destination === "add") return { type: "add" };
  return { type: "profile_self" };
}
