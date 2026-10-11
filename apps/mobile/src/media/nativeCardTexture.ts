import { Texture } from "three";
import { prepCollectibleTexture } from "../room/roomMaterials";
import { photocardCoverUV } from "./photocard";

/** R3F native patches TextureLoader with an EXGL upload marker that Texture.copy omits. */
export function nativeCardTexture(source: Texture) {
  const map = source.clone() as Texture & { isDataTexture?: boolean };
  if ((source as Texture & { isDataTexture?: boolean }).isDataTexture) map.isDataTexture = true;
  const image = source.image as { width?: number; height?: number };
  const uv = photocardCoverUV(image?.width ?? 0, image?.height ?? 0);
  map.repeat.set(uv.repeatX, uv.repeatY);
  map.offset.set(uv.offsetX, uv.offsetY);
  return prepCollectibleTexture(map);
}
