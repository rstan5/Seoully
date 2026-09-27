import type { MediaRef } from "@/domain/types";

/** Uploads an explicitly consented copy; it never promotes the personal asset. */
export async function uploadCatalogReferenceImage(templateId: string, media: MediaRef) {
  if (!media.url.startsWith("data:")) return { ok: false as const, reason: "invalid_media" };
  const response = await fetch(media.url);
  const blob = await response.blob();
  const file = new File([blob], `${media.id}.image`, { type: blob.type || "image/png" });
  const formData = new FormData();
  formData.set("templateId", templateId);
  formData.set("sourceKey", media.id);
  formData.set("file", file);
  const result = await fetch("/api/catalog/reference-images", { method: "POST", body: formData });
  if (!result.ok) return { ok: false as const, reason: "catalog_reference_upload_failed" };
  return { ok: true as const, image: (await result.json()).image };
}
