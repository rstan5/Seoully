import { useEffect, useRef, useState } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { Directory, File, Paths } from "expo-file-system";

const CACHE_DIRECTORY = "seoully-signed-media";

let downloadSequence = 0;
// Exact signed URL + logical media identity: never reuse another viewer's URL.
// Share in-flight and completed downloads across page/card remounts.
const downloads = new Map<string, Promise<string>>();
const completed = new Map<string, string>();
function cachedDownload(cacheKey: string, url: string, requestKey: string) {
  const existing = downloads.get(requestKey);
  if (existing) return existing;
  const pending = (async () => {
    const directory = new Directory(Paths.cache, CACHE_DIRECTORY);
    directory.create({ idempotent: true, intermediates: true });
    const destination = new File(directory, `${safeCacheKey(cacheKey)}-${++downloadSequence}.img`);
    const file = await File.downloadFileAsync(url, destination, { idempotent: true });
    completed.set(requestKey, file.uri);
    // Bound session bookkeeping without deleting a file still used by a mesh.
    while (completed.size > 128) {
      const oldest = completed.keys().next().value!;
      completed.delete(oldest);
      downloads.delete(oldest);
    }
    return file.uri;
  })().catch(error => { downloads.delete(requestKey); completed.delete(requestKey); throw error; });
  downloads.set(requestKey, pending);
  return pending;
}

export function useCachedSignedMedia(cacheKey?: string | null, url?: string | null, onError?: () => void) {
  const failure = useRef(onError);
  useEffect(() => { failure.current = onError; }, [onError]);
  const [cached, setCached] = useState<{ key: string; uri: string } | null>(null);
  const requestKey = cacheKey && url ? `${cacheKey}:${url}` : null;
  useEffect(() => {
    if (!cacheKey || !url || !requestKey) return;
    let active = true;
    void cachedDownload(cacheKey, url, requestKey)
      .then((uri) => { if (active) setCached({ key: requestKey, uri }); })
      .catch(() => { if (active) failure.current?.(); });
    return () => { active = false; };
  }, [cacheKey, requestKey, url]);
  return requestKey ? (completed.get(requestKey) ?? (cached?.key === requestKey ? cached.uri : null)) : null;
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
