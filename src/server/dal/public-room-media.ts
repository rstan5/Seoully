import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** Restricted locator only. This client never signs media or replaces caller-auth DAL clients. */
export function createPublicRoomMediaLocatorClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("public_room_media_configuration_missing");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function signPublicRoomMedia(
  viewer: SupabaseClient, roomId: string, placementIds: string[],
): Promise<Map<string, string>> {
  z.string().uuid().parse(roomId);
  const ids = z.array(z.string().uuid()).max(500).parse([...new Set(placementIds)]);
  const result = new Map<string, string>();
  if (!ids.length) return result;
  const locator = createPublicRoomMediaLocatorClient();
  const { data, error } = await locator.rpc("get_public_room_media_locations", {
    p_room_id: roomId, p_placement_ids: ids,
  });
  if (error || !Array.isArray(data)) throw new Error("public_room_media_lookup_failed");
  const allowed = new Set(ids);
  for (const value of data) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    if (typeof row.placementId !== "string" || !allowed.has(row.placementId)
      || row.bucket !== "collectible-media" || typeof row.path !== "string" || !row.path) continue;
    // The authenticated viewer's existing storage policy rechecks public visibility.
    // Never return the locator payload or credentials, even on failure.
    const signed = await viewer.storage.from("collectible-media").createSignedUrl(row.path, 300);
    if (signed.data?.signedUrl) result.set(row.placementId, signed.data.signedUrl);
  }
  return result;
}
