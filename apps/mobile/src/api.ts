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
