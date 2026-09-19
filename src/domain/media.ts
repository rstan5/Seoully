import type { MediaRef, PostMedia } from "./types";

const MAX_BYTES = 2_500_000;

export type MediaError =
  | { ok: false; code: "too-large" | "not-image" | "unreadable"; message: string }
  | { ok: true; media: MediaRef };

/**
 * Local image ingest. Cloud storage can replace the data-URL later without
 * changing callers — they already hold a MediaRef, not a File.
 */
export async function readLocalImage(file: File): Promise<MediaError> {
  if (!file.type.startsWith("image/")) {
    return { ok: false, code: "not-image", message: "That file isn’t an image." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, code: "too-large", message: "Keep photos under 2.5 MB for now." };
  }
  try {
    const url = await fileToDataUrl(file);
    return {
      ok: true,
      media: {
        id: `media-${Date.now()}`,
        kind: "image",
        url,
        source: "local",
      },
    };
  } catch {
    return { ok: false, code: "unreadable", message: "Couldn’t read that photo." };
  }
}

export type PostMediaError = "not-media" | "too-large" | "unreadable";
export type LocalPostMediaResult =
  | { ok: true; media: PostMedia }
  | { ok: false; code: PostMediaError };

/** Read an image or video for a normal post using the existing local data-URL pipeline. */
export async function readLocalPostMedia(file: File): Promise<LocalPostMediaResult> {
  const image = file.type.startsWith("image/");
  const video = file.type.startsWith("video/");
  if (!image && !video) return { ok: false, code: "not-media" };
  if (file.size > MAX_BYTES) return { ok: false, code: "too-large" };

  if (image) {
    const result = await readLocalImage(file);
    if (!result.ok) {
      return { ok: false, code: result.code === "too-large" ? "too-large" : "unreadable" };
    }
    return {
      ok: true,
      media: { kind: "photo", url: result.media.url, alt: file.name },
    };
  }

  try {
    return {
      ok: true,
      media: { kind: "video", url: await fileToDataUrl(file), alt: file.name },
    };
  } catch {
    return { ok: false, code: "unreadable" };
  }
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("empty"));
    };
    reader.readAsDataURL(file);
  });
}
