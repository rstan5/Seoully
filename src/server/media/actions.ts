"use server";

import { getMyHoldingMedia, removeMyHoldingMedia, uploadHoldingMedia } from "@/server/dal/media";

export async function uploadMedia(formData: FormData) {
  try {
    const file = formData.get("file");
    if (!(file instanceof File)) return { ok: false as const, reason: "invalid_media" };
    return { ok: true as const, asset: await uploadHoldingMedia({ holdingId: formData.get("holdingId"), file }) };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "media_upload_failed" };
  }
}

export async function getHoldingMedia(input: unknown) {
  try { return { ok: true as const, asset: await getMyHoldingMedia(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "media_read_failed" }; }
}

export async function removeHoldingMedia(input: unknown) {
  try { return { ok: true as const, result: await removeMyHoldingMedia(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "media_delete_failed" }; }
}
