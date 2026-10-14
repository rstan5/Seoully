import { File } from "expo-file-system";

const MAX_BYTES = 10 * 1024 * 1024;
/** The Expo SDK's multipart encoder supports File.bytes(), not RN URI descriptors. */
export function personalPhotoForm(holdingId: string, uri: string): Promise<FormData> {
  return photoMultipart({ holdingId }, uri);
}

export async function photoMultipart(fields: Record<string, string>, uri: string, maxBytes = MAX_BYTES): Promise<FormData> {
  let file: File;
  let bytes: Uint8Array;
  try {
    file = new File(uri);
    if (!file.exists || file.size <= 0) throw new Error("unreadable");
    if (file.size > maxBytes) throw new Error("media_too_large");
    bytes = await file.bytes();
  } catch (error) {
    if (error instanceof Error && error.message === "media_too_large") throw error;
    throw new Error("media_local_file_unreadable");
  }
  if (!bytes.length) throw new Error("media_local_file_unreadable");
  if (bytes.length > maxBytes) throw new Error("media_too_large");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, index) => bytes[index] === value);
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0,4)) === "RIFF" && String.fromCharCode(...bytes.slice(8,12)) === "WEBP";
  const type = jpeg ? "image/jpeg" : png ? "image/png" : webp ? "image/webp" : null;
  if (!type || file.type !== type) throw new Error("unsupported_media_type");
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  body.append("file", file);
  return body;
}
