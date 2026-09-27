import { useEffect, useState } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

const CACHE_DIRECTORY = "seoully-signed-media";

export function useCachedSignedMedia(cacheKey?: string | null, url?: string | null) {
  const [cached, setCached] = useState<{ key: string; uri: string } | null>(null);
  const requestKey = cacheKey && url ? `${cacheKey}:${url}` : null;
  useEffect(() => {
    if (!cacheKey || !url || !requestKey) return;
    let active = true;
    const directory = new Directory(Paths.cache, CACHE_DIRECTORY);
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${safeCacheKey(cacheKey)}.img`);
    void File.downloadFileAsync(url, destination, { idempotent: true })
      .then((file) => { if (active) setCached({ key: requestKey, uri: file.uri }); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [cacheKey, requestKey, url]);
  return requestKey && cached?.key === requestKey ? cached.uri : null;
}

export function CachedSignedImage({
  cacheKey,
  url,
  style,
  resizeMode,
  accessibilityLabel,
}: {
  cacheKey: string;
  url?: string;
  style?: StyleProp<ImageStyle>;
  resizeMode?: "cover" | "contain" | "stretch" | "center" | "repeat";
  accessibilityLabel?: string;
}) {
  const uri = useCachedSignedMedia(cacheKey, url);
  if (!uri) return null;
  return <Image accessibilityLabel={accessibilityLabel} resizeMode={resizeMode} source={{ uri }} style={style} />;
}

function safeCacheKey(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
