"use client";

import type { MediaRef } from "@/domain/types";

export async function uploadPersonalMedia(holdingId: string, media: MediaRef) {
  if (!media.url.startsWith("data:")) return { ok: false as const, reason: "invalid_media" };
  const response = await fetch(media.url);
  const blob = await response.blob();
  const file = new File([blob], `${media.id}.png`, { type: blob.type || "image/png" });
  const formData = new FormData();
  formData.set("holdingId", holdingId);
  formData.set("file", file);
  const result = await fetch("/api/media", { method: "POST", body: formData });
  if (!result.ok) return { ok: false as const, reason: "media_upload_failed" };
  return { ok: true as const, asset: (await result.json()).asset };
}
