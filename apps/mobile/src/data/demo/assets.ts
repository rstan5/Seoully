import { Image } from "react-native";

const DEMO_MEDIA: Record<string, number> = {
  "/avatars/soo.png": require("seoully-public/avatars/soo.png"),
  "/avatars/minji.png": require("seoully-public/avatars/minji.png"),
  "/posts/minji-concert.png": require("seoully-public/posts/minji-concert.png"),
  "/posts/minji-seoul.png": require("seoully-public/posts/minji-seoul.png"),
  "/posts/minji-unbox.png": require("seoully-public/posts/minji-unbox.png"),
  "/posts/minji-friends.png": require("seoully-public/posts/minji-friends.png"),
  "/posts/soo-concert.png": require("seoully-public/posts/soo-concert.png"),
  "/posts/soo-unbox.png": require("seoully-public/posts/soo-unbox.png"),
};

export function demoAssetUri(path: string | undefined) {
  if (!path) return undefined;
  const asset = DEMO_MEDIA[path];
  if (!asset) return undefined;
  return Image.resolveAssetSource(asset).uri;
}
