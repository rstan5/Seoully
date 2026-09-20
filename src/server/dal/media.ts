import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const holdingSchema = z.string().uuid();

export interface MediaAssetDTO {
  id: string;
  holdingId: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: string;
}

export async function uploadHoldingMedia(input: { holdingId: unknown; file: File }): Promise<MediaAssetDTO> {
  const holdingId = holdingSchema.parse(input.holdingId);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  if (!(input.file instanceof File)) throw new Error("invalid_media");
  if (!allowedMime.has(input.file.type)) throw new Error("unsupported_media_type");
  if (input.file.size <= 0 || input.file.size > MAX_BYTES) throw new Error("media_too_large");
  if (!(await matchesImageSignature(input.file))) throw new Error("invalid_media");

  const supabase = await createSupabaseServerClient();
  const { data: holding, error: holdingError } = await supabase.from("holdings")
    .select("id").eq("id", holdingId).eq("owner_user_id", identity.user.id).maybeSingle();
  if (holdingError) throw new Error("holding_read_failed");
  if (!holding) throw new Error("holding_not_found");

  const { data: previous } = await supabase.from("media_assets")
    .select("id,storage_bucket,storage_path").eq("holding_id", holdingId).maybeSingle();
  const assetId = crypto.randomUUID();
  const path = `${identity.user.id}/${assetId}/original`;
  const upload = await supabase.storage.from("collectible-media").upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (upload.error) throw new Error("media_upload_failed");

  const { data: asset, error } = await supabase.from("media_assets").upsert({
    id: assetId,
    owner_user_id: identity.user.id,
    holding_id: holdingId,
    storage_bucket: "collectible-media",
    storage_path: path,
    media_kind: "image",
    mime_type: input.file.type,
    byte_size: input.file.size,
  }, { onConflict: "holding_id" }).select("id,holding_id,mime_type,byte_size,width,height,storage_bucket,storage_path,created_at").single();
  if (error || !asset) {
    await supabase.storage.from("collectible-media").remove([path]);
    throw new Error("media_record_failed");
  }
  if (previous?.storage_path && previous.storage_path !== path) {
    await supabase.storage.from(previous.storage_bucket ?? "collectible-media").remove([previous.storage_path]);
  }
  return signAsset(supabase, asset);
}

export async function getMyHoldingMedia(input: unknown): Promise<MediaAssetDTO | null> {
  const holdingId = holdingSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("media_assets")
    .select("id,holding_id,mime_type,byte_size,width,height,storage_bucket,storage_path,created_at")
    .eq("holding_id", holdingId).eq("owner_user_id", identity.user.id).maybeSingle();
  if (error) throw new Error("media_read_failed");
  return data ? signAsset(supabase, data) : null;
}

export async function removeMyHoldingMedia(input: unknown): Promise<{ removed: boolean }> {
  const holdingId = holdingSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data: asset, error: readError } = await supabase.from("media_assets")
    .select("id,storage_bucket,storage_path").eq("holding_id", holdingId).eq("owner_user_id", identity.user.id).maybeSingle();
  if (readError) throw new Error("media_read_failed");
  if (!asset) return { removed: false };
  const { error } = await supabase.from("media_assets").delete().eq("id", asset.id).eq("owner_user_id", identity.user.id);
  if (error) throw new Error("media_delete_failed");
  const cleanup = await supabase.storage.from(asset.storage_bucket).remove([asset.storage_path]);
  if (cleanup.error) console.warn("media_storage_cleanup_failed", cleanup.error.message);
  return { removed: true };
}

async function signAsset(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, row: Record<string, unknown>): Promise<MediaAssetDTO> {
  const { data, error } = await supabase.storage.from(String(row.storage_bucket)).createSignedUrl(String(row.storage_path), 3600);
  if (error || !data?.signedUrl) throw new Error("media_delivery_failed");
  return {
    id: String(row.id), holdingId: String(row.holding_id), mimeType: String(row.mime_type),
    byteSize: Number(row.byte_size), width: typeof row.width === "number" ? row.width : null,
    height: typeof row.height === "number" ? row.height : null, url: data.signedUrl, createdAt: String(row.created_at),
  };
}

export { MAX_BYTES };

async function matchesImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/png") return bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  if (file.type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}
