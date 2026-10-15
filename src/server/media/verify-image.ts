import "server-only";
import sharp from "sharp";
/** Decode untrusted stored imagery without modifying its original bytes/crop. */
export async function verifyImage(bytes: Uint8Array, mimeType: string) {
  try {
    const image=sharp(bytes,{limitInputPixels:64_000_000,failOn:"warning"});
    const meta=await image.metadata();
    const format={"image/jpeg":"jpeg","image/png":"png","image/webp":"webp"}[mimeType];
    if(!format || meta.format!==format || !meta.width || !meta.height) throw new Error("invalid_media");
    await image.resize(1,1,{fit:"inside"}).raw().toBuffer();
  } catch {throw new Error("invalid_media");}
}
