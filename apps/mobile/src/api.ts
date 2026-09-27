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

export type NativeFeedPost = { id: string; caption: string; createdAt: string; author: { displayName: string; handle: string }; likeCount: number; commentCount: number; media: Array<{ url: string; mediaType: string }> };
export async function loadFeed(): Promise<NativeFeedPost[]> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${baseUrl}/api/mobile/feed`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("social_read_failed");
  const payload = await response.json() as { page?: { items?: NativeFeedPost[] } };
  return payload.page?.items ?? [];
}

export async function updateNativeProfile(input: { displayName?: string; bio?: string; tagline?: string }) {
  const { data } = await supabase.auth.getSession(); const accessToken = data.session?.access_token;
  if (!baseUrl || !accessToken) throw new Error("unauthenticated");
  const response = await fetch(`${baseUrl}/api/mobile/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) throw new Error("profile_update_failed"); return response.json();
}
