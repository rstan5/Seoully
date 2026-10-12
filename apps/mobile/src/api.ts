import type { ProfileThemeChoice } from "seoully-domain/types";
import { fetch as expoFetch } from "expo/fetch";
import { personalPhotoForm, photoMultipart } from "./media/photoUpload";
import { apiFailure, apiTransportFailure } from "./apiFailure";
import { isProductApiConfigured } from "./config-rules";
import { supabase } from "./supabase";
import type { AskSurfaceContext } from "seoully-domain/ask-context";

function productApiBase(): string {
  const value = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "").trim();
  if (!isProductApiConfigured(value)) throw new Error("product_api_unconfigured");
  return value;
}

export async function resolveNativeIdentity<T>(): Promise<T | null> {
  let apiBase: string;
  try {
    apiBase = productApiBase();
  } catch {
    return null;
  }
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) return null;
  const response = await fetch(`${apiBase}/api/mobile/session`, {
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
  imageUrl?: string;
  groupName: string;
  memberName: string | null;
  releaseName: string | null;
  colorway?: { base: string; accent: string; ink: string };
};

export type NativeSearchUser = { userId: string; handle: string; displayName: string; avatarUrl?: string };
export type NativeCollectibleSearchHit = {
  template: NativeCatalogTemplate;
  owner?: NativeSearchUser;
};

export async function searchCollectors(query: string): Promise<NativeSearchUser[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/search?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("social_search_failed");
  const payload = await response.json() as { users?: NativeSearchUser[] };
  return payload.users ?? [];
}

export async function searchPosts(query: string): Promise<NativeFeedPost[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/search?dest=posts&q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("social_search_failed");
  const payload = await response.json() as { posts?: NativeFeedPost[] };
  return payload.posts ?? [];
}

export async function searchDiscoverCollectibles(query: string): Promise<NativeCollectibleSearchHit[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/search?dest=collectibles&q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("social_search_failed");
  const payload = await response.json() as { collectibles?: NativeCollectibleSearchHit[] };
  return payload.collectibles ?? [];
}

export async function searchRooms(query: string): Promise<NativeRoomDiscovery[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/search?dest=rooms&q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("social_search_failed");
  const payload = await response.json() as { rooms?: NativeRoomDiscovery[] };
  return payload.rooms ?? [];
}

export async function searchCatalog(query: string): Promise<NativeCatalogTemplate[]> {
  const response = await fetch(`${productApiBase()}/api/catalog/search?q=${encodeURIComponent(query)}&limit=24`);
  if (!response.ok) throw new Error("catalog_unavailable");
  const payload = await response.json() as { results?: NativeCatalogTemplate[] };
  return payload.results ?? [];
}

export async function createHolding(templateId: string, holdingId?: string): Promise<{ holding: NativeHolding }> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${productApiBase()}/api/mobile/holdings`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ templateId, ...(holdingId ? { holdingId } : {}) }),
  }).catch(() => apiTransportFailure("holding_create"));
  if (!response.ok) return apiFailure(response, "holding_create");
  const payload = await response.json() as { holding?: NativeHolding };
  if (!payload.holding?.id) throw new Error("holding_create_failed");
  return { holding: payload.holding };
}

export type NativeHolding = {
  id: string;
  templateId: string;
  acquiredAt: string;
  tradeStatus: "not-for-trade" | "for-trade";
  personalMediaUrl?: string;
  hasPersonalMedia?: boolean;
  template: NativeCatalogTemplate;
};
export type NativeWishlistEntry = {
  id: string;
  templateId: string;
  template: NativeCatalogTemplate;
};

export async function loadMyHoldings(offset = 0, limit = 100): Promise<NativeHolding[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/holdings?offset=${offset}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("holding_read_failed");
  const payload = await response.json() as { holdings?: NativeHolding[] };
  return payload.holdings ?? [];
}

export async function loadMyHolding(holdingId: string): Promise<NativeHolding | null> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/holdings?holdingId=${encodeURIComponent(holdingId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => apiTransportFailure("holding_read"));
  if (!response.ok) return apiFailure(response, "holding_read");
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
  const response = await fetch(`${productApiBase()}/api/mobile/holdings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ holdingId, tradeStatus }),
  });
  if (!response.ok) throw new Error("holding_trade_update_failed");
  const payload = await response.json() as { holding: NativeHolding };
  return payload.holding;
}

export async function removeHolding(holdingId: string) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/holdings`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ holdingId }),
  });
  if (!response.ok) throw new Error("holding_delete_failed");
}

export type NativeCollectorMatchItem = {
  templateId: string;
  name: string;
  ownedCopies: number;
  forTradeCopies: number;
  openToTrade: boolean;
};

export type NativeCollectorMatch = {
  compatibility: {
    score: number;
    engine: "people";
    evidenceStrength: string;
    visibilityLimited: boolean;
    reasons: { code: string; count: number }[];
  };
  trade: {
    theyOwnYourWants: NativeCollectorMatchItem[];
    youOwnTheirWants: NativeCollectorMatchItem[];
    reciprocal: boolean;
    strength: string;
    visibility: { collectionVisible: boolean; wishlistVisible: boolean };
  };
};

export async function loadCollectorMatch(userId: string): Promise<NativeCollectorMatch> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/collectors/${encodeURIComponent(userId)}/match`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("collector_match_unavailable");
  return response.json() as Promise<NativeCollectorMatch>;
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
  const response = await fetch(`${productApiBase()}/api/mobile/wishlist?offset=${offset}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("wishlist_read_failed");
  const payload = await response.json() as { entries?: NativeWishlistEntry[] };
  return payload.entries ?? [];
}

export async function setWishlistTemplate(templateId: string, wanted: boolean) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/wishlist`, {
    method: wanted ? "POST" : "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ templateId }),
  });
  if (!response.ok) throw new Error("wishlist_update_failed");
}

export async function uploadHoldingPhoto(holdingId: string, uri: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("unauthenticated");
  const body = await personalPhotoForm(holdingId, uri);
  const response = await expoFetch(`${productApiBase()}/api/mobile/media`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body }).catch(() => apiTransportFailure("media_upload"));
  if (!response.ok) return apiFailure(response, "media_upload");
  return response.json();
}

export async function uploadCatalogReferencePhoto(templateId: string, uri: string) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("unauthenticated");
  const body = await photoMultipart({ templateId, sourceKey: uri.slice(-160) }, uri);
  const response = await expoFetch(`${productApiBase()}/api/mobile/catalog/reference-images`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body });
  if (!response.ok) throw new Error("catalog_reference_upload_failed");
  return response.json();
}

export async function contributeCatalogItem(input: { submissionKey: string; name: string; kind: string; groupName: string; memberName?: string; releaseName?: string; descriptor?: string }) {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${productApiBase()}/api/mobile/catalog/contributions`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("catalog_contribution_failed");
  return response.json() as Promise<{ contribution: { template: NativeCatalogTemplate } }>;
}

export type NativeSocialAuthor = { userId: string; displayName: string; handle: string };
export type NativeCollectibleTag = {
  templateId: string;
  name: string;
  kind: string;
  colorway?: { base: string; accent: string; ink: string };
};
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
  repostedByMe?: boolean;
  savedByMe?: boolean;
  repostOf?: string | null;
  originAuthor?: NativeSocialAuthor;
  media: { url: string; mediaType: string; duration?: string }[];
  taggedUsers?: NativeSocialAuthor[];
  taggedCollectibles?: NativeCollectibleTag[];
};
export type NativePostComment = { id: string; postId: string; body: string; createdAt: string; author: NativeSocialAuthor };
export type NativeFeedPage = { items: NativeFeedPost[]; nextCursor: string | null };
export async function loadFeed(cursor?: string, mode: "following" | "discover" = "following"): Promise<NativeFeedPage> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("unauthenticated");
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (mode === "discover") params.set("mode", "discover");
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await fetch(`${productApiBase()}/api/mobile/feed${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("social_read_failed");
  const payload = await response.json() as { page?: { items?: NativeFeedPost[]; nextCursor?: string | null } };
  return { items: payload.page?.items ?? [], nextCursor: payload.page?.nextCursor ?? null };
}

export async function setPostLiked(postId: string, liked: boolean) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/posts/${encodeURIComponent(postId)}/like`, {
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
  const response = await fetch(`${productApiBase()}/api/mobile/posts/${encodeURIComponent(postId)}/comments${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("comments_read_failed");
  const payload = await response.json() as { page?: { items?: NativePostComment[]; nextCursor?: string | null } };
  return { items: payload.page?.items ?? [], nextCursor: payload.page?.nextCursor ?? null };
}

export async function addPostComment(postId: string, body: string): Promise<NativePostComment> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/posts/${encodeURIComponent(postId)}/comments`, {
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
  const response = await fetch(`${productApiBase()}/api/mobile/posts`, {
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
    avatarUrl?: string;
    tagline: string;
    bio: string;
    location?: string;
    favoriteGroupIds: string[];
    biasMemberIds: string[];
    favoriteEraIds: string[];
    collectorInterests: string[];
    collectorType?: string;
    appearance?: ProfileThemeChoice;
  };
};

export async function updateNativeProfile(input: { avatarSubmissionId?: string; displayName?: string; bio?: string; tagline?: string; location?: string; appearance?: ProfileThemeChoice; collectorType?: string; favoriteGroupIds?: string[]; biasMemberIds?: string[] }) {
  const { data } = await supabase.auth.getSession(); const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${productApiBase()}/api/mobile/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("profile_update_failed"); return response.json();
}

export type NativeOnboardingStep = "group" | "bias" | "interest" | "done";
export type NativeOnboardingGroup = {
  catalogId?: string;
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
  userId: string;
  firstHome: { identityReady: boolean; holdingId: string | null; roomId: string | null; placedHoldingId: string | null; binderHoldingId?: string | null } | null;
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
  | { action: "interests"; collectorInterests: string[] }
  | { action: "complete" };

async function mobileAccessToken() {
  productApiBase();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("unauthenticated");
  return accessToken;
}

export type NativeAskCard = {
  kind: "collector" | "collectible" | "room" | "holding";
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  action?: { type: string; userId?: string; query?: string; destination?: string; conversationId?: string; holdingId?: string; templateId?: string };
};

export async function askSeoullyNative(input: {
  locale: "en" | "ko";
  question: string;
  history: { role: "user" | "assistant"; content: string }[];
  context?: AskSurfaceContext;
}) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/assistant`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.status === 401) throw new Error("unauthenticated");
  if (!response.ok) throw new Error("assistant_unavailable");
  return response.json() as Promise<{ reply?: string; cards?: NativeAskCard[]; navigation?: NativeAskCard["action"] }>;
}

export async function searchCollectorGroups(query: string, signal?: AbortSignal): Promise<NativeOnboardingState["groups"]> {
  const token = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/catalog/groups?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw new Error("groups_unavailable");
  const body = await response.json() as { groups: NativeOnboardingState["groups"] };
  return body.groups;
}

export type NativeCollectorMember = NativeOnboardingState["members"][number] & { groupName?: string };
export async function searchCollectorMembers(query: string, signal?: AbortSignal): Promise<NativeCollectorMember[]> {
  const token = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/catalog/members?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!response.ok) throw new Error("members_unavailable");
  const body = await response.json() as { members: NativeCollectorMember[] };
  return body.members;
}

export async function loadNativeOnboarding(signal?: AbortSignal): Promise<NativeOnboardingState> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/onboarding`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error("onboarding_unavailable");
  return response.json() as Promise<NativeOnboardingState>;
}

export async function updateNativeOnboarding(
  patch: NativeOnboardingPatch,
): Promise<{ step: NativeOnboardingStep }> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/onboarding`, {
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
  const response = await fetch(`${productApiBase()}/api/mobile/discovery/${surface}`, {
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
  lastMessage: {
    body: string;
    createdAt: string;
    mine: boolean;
    postId?: string;
    templateCount?: number;
  } | null;
  unread?: boolean;
};
export type NativeDirectMessagePost = {
  id: string;
  authorUserId: string;
  authorHandle: string;
  caption: string;
  mediaUrl?: string;
};
export type NativeDirectMessageCollectible = {
  templateId: string;
  name: string;
  kind: string;
};
export type NativeDirectMessage = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  post?: NativeDirectMessagePost | null;
  collectibles?: NativeDirectMessageCollectible[];
};
export type NativeNotice = {
  id: string;
  kind: "like" | "comment" | "follow" | "trade" | "activity" | "repost";
  actor: { userId: string; handle: string; displayName: string };
  createdAt: string;
  read: boolean;
  postId?: string;
  templateIds?: string[];
};

function throwIfMessagesUnavailable(response: Response, fallback: string) {
  if (response.ok) return;
  throw new Error(response.status === 503 ? "messages_unavailable" : fallback);
}

export async function loadConversations(): Promise<NativeConversation[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/messages`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  throwIfMessagesUnavailable(response, "messages_read_failed");
  const payload = await response.json() as { conversations?: NativeConversation[] };
  return payload.conversations ?? [];
}

export async function ensureConversation(peerUserId: string): Promise<string> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ peerUserId }),
  });
  throwIfMessagesUnavailable(response, "conversation_create_failed");
  const payload = await response.json() as { conversationId: string };
  return payload.conversationId;
}

export async function loadDirectMessages(conversationId: string): Promise<NativeDirectMessage[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/messages/${encodeURIComponent(conversationId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  throwIfMessagesUnavailable(response, "messages_read_failed");
  const payload = await response.json() as { messages?: NativeDirectMessage[] };
  return payload.messages ?? [];
}

export async function sendDirectMessage(input: {
  conversationId?: string;
  peerUserId?: string;
  body?: string;
  postId?: string;
  templateIds?: string[];
}): Promise<NativeDirectMessage> {
  const accessToken = await mobileAccessToken();
  const path = input.conversationId
    ? `${productApiBase()}/api/mobile/messages/${encodeURIComponent(input.conversationId)}`
    : `${productApiBase()}/api/mobile/messages`;
  const response = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      peerUserId: input.peerUserId,
      body: input.body,
      postId: input.postId,
      templateIds: input.templateIds,
    }),
  });
  throwIfMessagesUnavailable(response, "message_send_failed");
  const payload = await response.json() as { message: NativeDirectMessage };
  return payload.message;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/messages/${encodeURIComponent(conversationId)}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  throwIfMessagesUnavailable(response, "messages_read_failed");
}

export async function loadProductionNotices(): Promise<{ items: NativeNotice[]; unreadCount: number }> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/notices`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(response.status === 503 ? "notices_unavailable" : "notices_read_failed");
  const payload = await response.json() as { notices?: NativeNotice[]; unreadCount?: number };
  return { items: payload.notices ?? [], unreadCount: payload.unreadCount ?? 0 };
}

export async function markProductionNoticesRead(): Promise<void> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/notices`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(response.status === 503 ? "notices_unavailable" : "notices_read_failed");
}

export type NativeCollectorProfile = {
  user: { id: string; handle: string; displayName: string; joinedAt: string };
  profile: {
    avatarUrl?: string;
    tagline: string;
    bio: string;
    location?: string;
    collectorInterests: string[];
    collectorType?: string;
    appearance?: ProfileThemeChoice;
    favoriteGroupIds?: string[];
    biasMemberIds?: string[];
    favoriteEraIds?: string[];
  };
  visibility?: { collectionPublic: boolean; wishlistPublic: boolean };
  followerCount: number;
  followingCount: number;
  roomAvailable: boolean;
  collectionSummary?: { holdingCount: number; uniqueTemplateCount: number; groupCount: number };
};

export type NativePublicCollectorCollection = {
  collectionPublic: boolean;
  wishlistPublic: boolean;
  holdings: NativeHolding[];
  wishlist: NativeWishlistEntry[];
};

export async function loadCollectorCollection(userId: string): Promise<NativePublicCollectorCollection> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/collectors/${encodeURIComponent(userId)}/collection`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("collector_collection_failed");
  return response.json() as Promise<NativePublicCollectorCollection>;
}

export async function loadPublicCollectorHolding(userId: string, holdingId: string): Promise<NativeHolding> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/collectors/${encodeURIComponent(userId)}/collection/holdings/${encodeURIComponent(holdingId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("public_holding_read_failed");
  const payload = await response.json() as { holding?: NativeHolding };
  if (!payload.holding?.id) throw new Error("public_holding_read_failed");
  return payload.holding;
}

export type NativePublicRoom = {
  owner: { userId: string; handle: string; displayName: string };
  private: boolean;
  viewerUserId?: string;
  room: {
    id: string;
    style?: NativeRoomStyle;
    layout?: Record<string, unknown>;
    photoStringCards?: import("./room/photoString").PublicPhotoStringCard[];
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
  const response = await fetch(`${productApiBase()}/api/mobile/collectors/${encodeURIComponent(userId)}/room`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("public_room_read_failed");
  return response.json() as Promise<NativePublicRoom>;
}

export async function loadCollectorProfile(userId: string) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/collectors/${encodeURIComponent(userId)}`, {
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
  const response = await fetch(`${productApiBase()}/api/mobile/collectors/${encodeURIComponent(userId)}`, {
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
  const response = await fetch(`${productApiBase()}/api/mobile/collectors/${encodeURIComponent(userId)}/posts${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("social_read_failed");
  const payload = await response.json() as { page?: { items?: NativeFeedPost[]; nextCursor?: string | null } };
  return { items: payload.page?.items ?? [], nextCursor: payload.page?.nextCursor ?? null };
}

export type NativeRoomThemeId = "hearth" | "blossom" | "midnight";
export type NativeRoomStyle = {
  wall: "plum" | "cream" | "ink" | "blush" | "sage";
  floor: "walnut" | "oak" | "charcoal" | "blush-wood";
  furniture: "walnut" | "oak" | "ink" | "blush";
  rug: "rose" | "cream" | "ink" | "sage";
  light: "warm" | "day" | "soft" | "night";
  brightness: "dim" | "normal" | "bright";
  binder?: "cream" | "blush" | "lavender" | "sage" | "sky" | "cocoa" | "charcoal";
};
export type NativeRoom = { id: string; ownerUserId: string; themeId: NativeRoomThemeId; style?: NativeRoomStyle; layout?: Record<string, unknown> };
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
  const response = await fetch(`${productApiBase()}/api/mobile/room`, {
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
  const response = await fetch(`${productApiBase()}/api/mobile/room`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }).catch(() => apiTransportFailure("room_placement"));
  if (!response.ok) await apiFailure(response, "room_placement");
  const payload = await response.json() as { placement: NativeRoomPlacement };
  return payload.placement;
}

export async function saveNativeRoomLayout(roomId: string, layout: Record<string, unknown>) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/room`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, layout }),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(failure.error === "room_layout_unavailable" ? failure.error : "room_layout_write_failed");
  }
  const payload = await response.json() as { room: NativeRoom };
  return payload.room;
}

export async function saveNativeRoomStyle(roomId: string, style: NativeRoomStyle) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/room`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, style }),
  });
  if (!response.ok) throw new Error("room_style_write_failed");
  const payload = await response.json() as { room: NativeRoom };
  return payload.room;
}

export async function saveNativeRoomTheme(roomId: string, themeId: NativeRoomThemeId) {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/room`, {
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
  const response = await fetch(`${productApiBase()}/api/mobile/room`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, holdingId }),
  });
  if (!response.ok) throw new Error("room_placement_delete_failed");
}

export type ProfileCapabilities = { profileAvatar: boolean; catalogIdentityContributions: boolean };
export async function readProfileCapabilities(): Promise<ProfileCapabilities> {
  const token = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/profile/capabilities`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("profile_capabilities_unavailable");
  return response.json();
}
export async function uploadProfileAvatar(uri: string, submissionId: string): Promise<string> {
  const token = await mobileAccessToken();
  const body = await photoMultipart({ submissionId }, uri);
  const response = await expoFetch(`${productApiBase()}/api/mobile/profile/avatar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
  if (!response.ok) throw new Error("avatar_upload_failed");
  const saved = await response.json();
  if (saved.avatarSubmissionId !== submissionId) throw new Error("avatar_upload_unconfirmed");
  return submissionId;
}
export async function contributeCatalogIdentity(input: { submissionId: string; kind: "group" | "member"; name: string; groupId?: string }): Promise<{ id: string; groupId: string; memberId: string | null; submittedName: string }> {
  const token = await mobileAccessToken();
  const response = await fetch(`${productApiBase()}/api/mobile/catalog/identity-contributions`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("identity_contribution_failed");
  const { contribution } = await response.json();
  if (!contribution?.id || !contribution.groupId || (input.kind === "member" && !contribution.memberId)) throw new Error("identity_contribution_unconfirmed");
  return contribution;
}
