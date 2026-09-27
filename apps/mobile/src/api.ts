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
  kind: string;
  name: string;
  descriptor: string;
  status: string;
  groupName: string;
  memberName: string | null;
  releaseName: string | null;
};

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

export async function loadMyHoldings(): Promise<NativeHolding[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/holdings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("holding_read_failed");
  const payload = await response.json() as { holdings?: NativeHolding[] };
  return payload.holdings ?? [];
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

export async function loadMyWishlist(): Promise<NativeWishlistEntry[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/wishlist`, {
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

export type NativeFeedPost = { id: string; caption: string; createdAt: string; author: { displayName: string; handle: string }; likeCount: number; commentCount: number; likedByMe: boolean; media: { url: string; mediaType: string }[] };
export type NativePostComment = { id: string; postId: string; body: string; createdAt: string; author: { displayName: string; handle: string } };
export async function loadFeed(): Promise<NativeFeedPost[]> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${baseUrl}/api/mobile/feed`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("social_read_failed");
  const payload = await response.json() as { page?: { items?: NativeFeedPost[] } };
  return payload.page?.items ?? [];
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

export async function loadPostComments(postId: string): Promise<NativePostComment[]> {
  const accessToken = await mobileAccessToken();
  const response = await fetch(`${baseUrl}/api/mobile/posts/${encodeURIComponent(postId)}/comments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("comments_read_failed");
  const payload = await response.json() as { page?: { items?: NativePostComment[] } };
  return payload.page?.items ?? [];
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

export async function updateNativeProfile(input: { displayName?: string; bio?: string; tagline?: string }) {
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

async function loadDiscovery<T>(surface: "collectors" | "collectibles"): Promise<T[]> {
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
