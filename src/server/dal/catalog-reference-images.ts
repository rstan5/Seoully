import "server-only";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentIdentity, getCurrentIdentityFromClient } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

const MAX_BYTES = 10 * 1024 * 1024;
const allowedMime = new Set(["image/jpeg", "image/png", "image/webp"]);
const templateSchema = z.string().uuid();

export interface CatalogReferenceImageDTO {
  id: string;
  templateId: string;
  contributedByUserId: string;
  sourceType: "community_contribution";
  status: "active" | "pending" | "rejected" | "removed";
  mimeType: string;
  byteSize: number;
  url: string;
  createdAt: string;
}

export async function createCatalogReferenceImage(input: {
  templateId: unknown;
  file: File;
  sourceKey?: unknown;
}, client?: SupabaseClient): Promise<CatalogReferenceImageDTO> {
  const templateId = templateSchema.parse(input.templateId);
  const identity = client ? await getCurrentIdentityFromClient(client) : await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  await validateImage(input.file);

  const sourceKey = typeof input.sourceKey === "string" && input.sourceKey.trim()
    ? input.sourceKey.trim().slice(0, 160)
    : crypto.randomUUID();
  const supabase = client ?? await createSupabaseServerClient();

  const { data: contribution, error: contributionError } = await supabase
    .from("catalog_contributions")
    .select("template_id")
    .eq("template_id", templateId)
    .eq("contributor_user_id", identity.user.id)
    .limit(1)
    .maybeSingle();
  if (contributionError) throw new Error("catalog_reference_authorization_failed");
  if (!contribution) throw new Error("catalog_reference_not_authorized");

  const { data: existing } = await supabase
    .from("catalog_reference_images")
    .select("id,template_id,contributed_by_user_id,source_type,status,mime_type,byte_size,storage_bucket,storage_path,created_at")
    .eq("collectible_template_id", templateId)
    .eq("contributed_by_user_id", identity.user.id)
    .eq("source_key", sourceKey)
    .maybeSingle();
  if (existing) return signReference(supabase, existing);

  const id = crypto.randomUUID();
  const path = `${identity.user.id}/${templateId}/${id}`;
  const upload = await supabase.storage.from("catalog-reference-images").upload(path, input.file, {
    contentType: input.file.type,
    upsert: false,
  });
  if (upload.error) throw new Error("catalog_reference_upload_failed");

  const { data: row, error } = await supabase.from("catalog_reference_images").insert({
    id,
    collectible_template_id: templateId,
    storage_bucket: "catalog-reference-images",
    storage_path: path,
    contributed_by_user_id: identity.user.id,
    source_type: "community_contribution",
    status: "active",
    mime_type: input.file.type,
    byte_size: input.file.size,
    source_key: sourceKey,
  }).select("id,template_id:collectible_template_id,contributed_by_user_id,source_type,status,mime_type,byte_size,storage_bucket,storage_path,created_at").single();
  if (error || !row) {
    await supabase.storage.from("catalog-reference-images").remove([path]);
    if (error?.code === "23505") {
      const retry = await supabase.from("catalog_reference_images")
        .select("id,template_id:collectible_template_id,contributed_by_user_id,source_type,status,mime_type,byte_size,storage_bucket,storage_path,created_at")
        .eq("collectible_template_id", templateId).eq("contributed_by_user_id", identity.user.id).eq("source_key", sourceKey).maybeSingle();
      if (retry.data) return signReference(supabase, retry.data);
    }
    throw new Error("catalog_reference_record_failed");
  }
  return signReference(supabase, row);
}

export async function listActiveCatalogReferenceImages(templateIds: string[]): Promise<CatalogReferenceImageDTO[]> {
  const ids = z.array(templateSchema).max(50).parse(templateIds);
  if (ids.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("catalog_reference_images")
    .select("id,template_id:collectible_template_id,contributed_by_user_id,source_type,status,mime_type,byte_size,storage_bucket,storage_path,created_at")
    .in("collectible_template_id", ids)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) throw new Error("catalog_reference_read_failed");
  return Promise.all((data ?? []).map((row) => signReference(supabase, row)));
}

async function validateImage(file: File) {
  if (!(file instanceof File)) throw new Error("invalid_media");
  if (!allowedMime.has(file.type)) throw new Error("unsupported_media_type");
  if (file.size <= 0 || file.size > MAX_BYTES) throw new Error("media_too_large");
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const valid = file.type === "image/png"
    ? bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])
    : file.type === "image/jpeg"
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!valid) throw new Error("invalid_media");
}

async function signReference(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, row: Record<string, unknown>): Promise<CatalogReferenceImageDTO> {
  const { data, error } = await supabase.storage.from(String(row.storage_bucket)).createSignedUrl(String(row.storage_path), 3600);
  if (error || !data?.signedUrl) throw new Error("catalog_reference_delivery_failed");
  return {
    id: String(row.id),
    templateId: String(row.template_id),
    contributedByUserId: String(row.contributed_by_user_id),
    sourceType: "community_contribution",
    status: row.status as CatalogReferenceImageDTO["status"],
    mimeType: String(row.mime_type),
    byteSize: Number(row.byte_size),
    url: data.signedUrl,
    createdAt: String(row.created_at),
  };
}

export { MAX_BYTES as CATALOG_REFERENCE_MAX_BYTES };
