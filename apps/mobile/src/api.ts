import { supabase } from "./supabase";

const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

export async function resolveNativeIdentity<T>(): Promise<T | null> {
  if (!baseUrl) return null;
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return null;
  const response = await fetch(`${baseUrl}/api/mobile/session`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const payload = await response.json() as { identity?: T };
  return payload.identity ?? null;
}

export type NativeCatalogTemplate = {
  id: string;
  groupId: string;
  memberId: string | null;
  releaseId: string | null;
  kind: string;
  name: string;
  descriptor: string;
  status: string;
  groupName: string;
  memberName: string | null;
  releaseName: string | null;
};

export type NativeSearchUser = { userId: string; handle: string; displayName: string; avatarUrl?: string };

export async function searchCollectors(query: string): Promise<NativeSearchUser[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("social_search_failed");
  const payload = await response.json() as { users?: NativeSearchUser[] };
  return payload.users ?? [];
}

export async function searchCatalog(query: string): Promise<NativeCatalogTemplate[]> {
  if (!baseUrl) return [];
  const response = await fetch(`${baseUrl}/api/catalog/search?q=${encodeURIComponent(query)}&limit=24`);
  if (!response.ok) throw new Error("catalog_unavailable");
  const payload = await response.json() as { results?: NativeCatalogTemplate[] };
  return payload.results ?? [];
}

export async function createHolding(templateId: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${baseUrl}/api/mobile/holdings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
  if (!response.ok) throw new Error("holding_create_failed");
  return response.json();
}

export type NativeHolding = {
  id: string;
  templateId: string;
  acquiredAt: string;
  tradeStatus: "not-for-trade" | "for-trade";
  personalMediaUrl?: string;
  template: NativeCatalogTemplate;
};
export type NativeWishlistEntry = {
  id: string;
  templateId: string;
  template: NativeCatalogTemplate;
};

export async function loadMyHoldings(offset = 0, limit = 100): Promise<NativeHolding[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/holdings?offset=${offset}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("holding_read_failed");
  const payload = await response.json() as { holdings?: NativeHolding[] };
  return payload.holdings ?? [];
}

export async function loadMyHolding(holdingId: string): Promise<NativeHolding | null> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/holdings?holdingId=${encodeURIComponent(holdingId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("holding_read_failed");
  const payload = await response.json() as { holding?: NativeHolding | null };
  return payload.holding ?? null;
}

export async function loadAllMyHoldings(): Promise<NativeHolding[]> {
  const holdings: NativeHolding[] = [];
  for (let offset = 0; offset < 2_000; offset += 100) {
    const page = await loadMyHoldings(offset, 100);
    holdings.push(...page);
    if (page.length < 100) break;
  }
  return holdings;
}

export async function updateHoldingTradeStatus(holdingId: string, tradeStatus: NativeHolding["tradeStatus"]) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/holdings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ holdingId, tradeStatus }),
  });
  if (!response.ok) throw new Error("holding_trade_update_failed");
  const payload = await response.json() as { holding: NativeHolding };
  return payload.holding;
}

export async function loadAllMyWishlist(): Promise<NativeWishlistEntry[]> {
  const entries: NativeWishlistEntry[] = [];
  for (let offset = 0; offset < 2_000; offset += 100) {
    const page = await loadMyWishlist(offset, 100);
    entries.push(...page);
    if (page.length < 100) break;
  }
  return entries;
}

export async function loadMyWishlist(offset = 0, limit = 100): Promise<NativeWishlistEntry[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/wishlist?offset=${offset}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("wishlist_read_failed");
  const payload = await response.json() as { entries?: NativeWishlistEntry[] };
  return payload.entries ?? [];
}

export async function setWishlistTemplate(templateId: string, wanted: boolean) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/wishlist`, {
    method: wanted ? "POST" : "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
  if (!response.ok) throw new Error("wishlist_update_failed");
}

export async function uploadHoldingPhoto(holdingId: string, uri: string, mimeType = "image/jpeg") {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const body = new FormData();
  body.append("holdingId", holdingId);
  body.append("file", { uri, name: "collectible.jpg", type: mimeType } as unknown as Blob);
  const response = await fetch(`${baseUrl}/api/mobile/media`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body });
  if (!response.ok) throw new Error("media_upload_failed");
  return response.json();
}

export async function uploadCatalogReferencePhoto(templateId: string, uri: string, mimeType = "image/jpeg") {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const body = new FormData();
  body.append("templateId", templateId);
  body.append("sourceKey", uri.slice(-160));
  body.append("file", { uri, name: "catalog-reference.jpg", type: mimeType } as unknown as Blob);
  const response = await fetch(`${baseUrl}/api/mobile/catalog/reference-images`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body });
  if (!response.ok) throw new Error("catalog_reference_upload_failed");
  return response.json();
}

export async function contributeCatalogItem(input: { name: string; kind: string; groupName: string; memberName?: string; releaseName?: string; descriptor?: string }) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${baseUrl}/api/mobile/catalog/contributions`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("catalog_contribution_failed");
  return response.json() as Promise<{ contribution: { template: NativeCatalogTemplate } }>;
}

export type NativeSocialAuthor = { userId: string; displayName: string; handle: string };
export type NativeCollectibleTag = { templateId: string; name: string; kind: string };
export type NativeFeedPost = {
  id: string;
  caption: string;
  createdAt: string;
  location?: string | null;
  author: NativeSocialAuthor;
  authorAvatarUrl?: string;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  media: { url: string; mediaType: string }[];
  taggedUsers?: NativeSocialAuthor[];
  taggedCollectibles?: NativeCollectibleTag[];
};
export type NativePostComment = { id: string; postId: string; body: string; createdAt: string; author: NativeSocialAuthor };
export type NativeFeedPage = { items: NativeFeedPost[]; nextCursor: string | null };
export async function loadFeed(cursor?: string): Promise<NativeFeedPage> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`${baseUrl}/api/mobile/feed${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("social_read_failed");
  const payload = await response.json() as { page?: { items?: NativeFeedPost[]; nextCursor?: string | null } };
  return { items: payload.page?.items ?? [], nextCursor: payload.page?.nextCursor ?? null };
}

export async function setPostLiked(postId: string, liked: boolean) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/posts/${encodeURIComponent(postId)}/like`, {
    method: liked ? "PUT" : "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("like_failed");
  return response.json() as Promise<{ liked: boolean }>;
}

export type NativeCommentPage = { items: NativePostComment[]; nextCursor: string | null };
export async function loadPostComments(postId: string, cursor?: string): Promise<NativeCommentPage> {
  const accessToken = await mobileAccessToken();
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`${baseUrl}/api/mobile/posts/${encodeURIComponent(postId)}/comments${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("comments_read_failed");
  const payload = await response.json() as { page?: { items?: NativePostComment[]; nextCursor?: string | null } };
  return { items: payload.page?.items ?? [], nextCursor: payload.page?.nextCursor ?? null };
}

export async function addPostComment(postId: string, body: string): Promise<NativePostComment> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw new Error("comment_create_failed");
  const payload = await response.json() as { comment: NativePostComment };
  return payload.comment;
}

export async function createNativePost(uri: string, caption: string, mimeType = "image/jpeg") {
  const accessToken = await mobileAccessToken();
  const body = new FormData();
  body.append("caption", caption);
  body.append("file", { uri, name: "seoully-post.jpg", type: mimeType } as unknown as Blob);
  const response = await fetch(`${baseUrl}/api/mobile/posts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  });
  if (!response.ok) throw new Error("post_create_failed");
  return response.json() as Promise<{ post: NativeFeedPost }>;
}

export type NativeIdentity = {
  user: { id: string; handle: string; displayName: string; joinedAt: string };
  profile: {
    tagline: string;
    bio: string;
    location?: string;
    favoriteGroupIds: string[];
    biasMemberIds: string[];
    favoriteEraIds: string[];
    collectorInterests: string[];
    collectorType?: string;
  };
};

export async function updateNativeProfile(input: { displayName?: string; bio?: string; tagline?: string; location?: string }) {
  const { data } = await supabase.auth.getSession(); const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${baseUrl}/api/mobile/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("profile_update_failed"); return response.json();
}

export type NativeOnboardingStep = "group" | "bias" | "interest" | "done";
export type NativeOnboardingGroup = {
  id: string;
  name: string;
  nativeName: string;
  memberIds: string[];
};
export type NativeOnboardingMember = {
  id: string;
  groupId: string;
  stageName: string;
  nativeName: string;
};
export type NativeOnboardingState = {
  step: NativeOnboardingStep;
  favoriteGroupIds: string[];
  biasMemberIds: string[];
  collectorInterests: string[];
  groups: NativeOnboardingGroup[];
  members: NativeOnboardingMember[];
};
export type NativeOnboardingPatch =
  | { action: "groups"; favoriteGroupIds: string[] }
  | { action: "bias"; biasMemberIds: string[] }
  | { action: "interests"; collectorInterests: string[] };

async function mobileAccessToken() {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  return accessToken;
}

export async function loadNativeOnboarding(): Promise<NativeOnboardingState> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/onboarding`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("onboarding_unavailable");
  return response.json() as Promise<NativeOnboardingState>;
}

export async function updateNativeOnboarding(
  patch: NativeOnboardingPatch,
): Promise<{ step: NativeOnboardingStep }> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/onboarding`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error("onboarding_update_failed");
  return response.json() as Promise<{ step: NativeOnboardingStep }>;
}

export type NativeDiscoveryReason = {
  code: string;
  ids?: string[];
  count?: number;
};
export type NativeCollectorDiscovery = {
  collector: { userId: string; handle: string; displayName: string };
  rankScore: number;
  compatibilityScore: number;
  evidenceStrength: string;
  wishlistItemsOwnedCount: number;
  wishlistItemsForTradeCount: number;
  itemsTheyWantFromMeCount: number;
  reciprocal: boolean;
  reciprocalForTrade: boolean;
  reasons: NativeDiscoveryReason[];
};
export type NativeCollectibleDiscovery = {
  template: {
    id: string;
    name: string;
    kind: string;
    groupId: string;
    memberId: string | null;
    releaseId: string | null;
  };
  rankScore: number;
  reasons: NativeDiscoveryReason[];
};
export type NativeRoomDiscovery = {
  roomId: string;
  collector: { userId: string; handle: string; displayName: string };
  rankScore: number;
  displayedHoldingCount: number;
  relevantDisplayedCount: number;
  reasons: NativeDiscoveryReason[];
};

async function loadDiscovery<T>(surface: "collectors" | "collectibles" | "rooms"): Promise<T[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/discovery/${surface}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ limit: 12 }),
  });
  if (!response.ok) throw new Error("discovery_unavailable");
  const payload = await response.json() as { items?: T[] };
  return payload.items ?? [];
}

export function loadCollectorDiscovery() {
  return loadDiscovery<NativeCollectorDiscovery>("collectors");
}

export function loadCollectibleDiscovery() {
  return loadDiscovery<NativeCollectibleDiscovery>("collectibles");
}

export function loadRoomDiscovery() {
  return loadDiscovery<NativeRoomDiscovery>("rooms");
}

export type NativeConversation = {
  id: string;
  peer: { userId: string; handle: string; displayName: string };
  lastMessage: { body: string; createdAt: string; mine: boolean } | null;
};
export type NativeDirectMessage = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean;
};

export async function loadConversations(): Promise<NativeConversation[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("messages_read_failed");
  const payload = await response.json() as { conversations?: NativeConversation[] };
  return payload.conversations ?? [];
}

export async function ensureConversation(peerUserId: string): Promise<string> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ peerUserId }),
  });
  if (!response.ok) throw new Error("conversation_create_failed");
  const payload = await response.json() as { conversationId: string };
  return payload.conversationId;
}

export async function loadDirectMessages(conversationId: string): Promise<NativeDirectMessage[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/messages/${encodeURIComponent(conversationId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("messages_read_failed");
  const payload = await response.json() as { messages?: NativeDirectMessage[] };
  return payload.messages ?? [];
}

export async function sendDirectMessage(conversationId: string, body: string): Promise<NativeDirectMessage> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/messages/${encodeURIComponent(conversationId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) throw new Error("message_send_failed");
  const payload = await response.json() as { message: NativeDirectMessage };
  return payload.message;
}

export type NativeCollectorProfile = {
  user: { id: string; handle: string; displayName: string; joinedAt: string };
  profile: { tagline: string; bio: string; location?: string; collectorInterests: string[] };
  followerCount: number;
  followingCount: number;
  roomAvailable: boolean;
  collectionSummary?: { holdingCount: number; uniqueTemplateCount: number; groupCount: number };
};

export type NativePublicRoom = {
  owner: { userId: string; handle: string; displayName: string };
  private: boolean;
  viewerUserId?: string;
  room: {
    id: string;
    placements: {
      id: string;
      zoneId: string;
      slot: number;
      offset: Record<string, number> | null;
      transform: Record<string, number> | null;
      surfaceId: string | null;
      holding: {
        templateId: string;
        tradeStatus: string;
        template: Record<string, unknown>;
        personalMediaUrl?: string;
      };
    }[];
  } | null;
};

export async function loadCollectorRoom(userId: string): Promise<NativePublicRoom> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/collectors/${encodeURIComponent(userId)}/room`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("public_room_read_failed");
  return response.json() as Promise<NativePublicRoom>;
}

export async function loadCollectorProfile(userId: string) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/collectors/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("collector_read_failed");
  return response.json() as Promise<{
    profile: NativeCollectorProfile;
    follow: { following: boolean; followers: number; followingCount: number };
  }>;
}

export async function setCollectorFollowing(userId: string, following: boolean) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/collectors/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ following }),
  });
  if (!response.ok) throw new Error("follow_failed");
  return response.json() as Promise<{ following: boolean }>;
}

export async function loadCollectorPosts(userId: string, cursor?: string): Promise<NativeFeedPage> {
  const accessToken = await mobileAccessToken();
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`${baseUrl}/api/mobile/collectors/${encodeURIComponent(userId)}/posts${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("social_read_failed");
  const payload = await response.json() as { page?: { items?: NativeFeedPost[]; nextCursor?: string | null } };
  return { items: payload.page?.items ?? [], nextCursor: payload.page?.nextCursor ?? null };
}

export type NativeRoomThemeId = "hearth" | "blossom" | "midnight";
export type NativeRoom = { id: string; ownerUserId: string; themeId: NativeRoomThemeId };
export type NativeRoomPlacement = {
  id: string;
  roomId: string;
  holdingId: string;
  zoneId: string;
  slot: number;
  offset: Record<string, number> | null;
  transform: Record<string, number> | null;
  surfaceId: string | null;
};
export type NativeRoomSnapshot = {
  room: NativeRoom;
  placements: NativeRoomPlacement[];
  holdings: NativeHolding[];
};

export async function loadNativeRoom(): Promise<NativeRoomSnapshot> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/room`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("room_read_failed");
  return response.json() as Promise<NativeRoomSnapshot>;
}

export async function saveNativeRoomPlacement(input: {
  roomId: string;
  holdingId: string;
  zoneId: string;
  slot: number;
  transform: { x: number; y: number; z: number; rotateX?: number; rotateY?: number; rotateZ?: number; scale?: number };
  surfaceId?: string;
}) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/room`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("room_placement_write_failed");
  const payload = await response.json() as { placement: NativeRoomPlacement };
  return payload.placement;
}

export async function saveNativeRoomTheme(roomId: string, themeId: NativeRoomThemeId) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/room`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, themeId }),
  });
  if (!response.ok) throw new Error("room_theme_write_failed");
  const payload = await response.json() as { room: NativeRoom };
  return payload.room;
}

export async function removeNativeRoomPlacement(roomId: string, holdingId: string) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/room`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, holdingId }),
  });
  if (!response.ok) throw new Error("room_placement_delete_failed");
}
