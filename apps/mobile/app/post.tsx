import { useCallback, useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSocialRepository } from "../src/data";
import { loadNativePost, type NativeFeedPost } from "../src/api";
import { useCopy, useLocale } from "../src/locale";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { SeoullyFeedPost } from "../src/ui/SeoullyFeedPost";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
export default function PostScreen() {
  const { postId = "", authorId = "" } = useLocalSearchParams<{ postId?: string; authorId?: string }>();
  const social = useSocialRepository();
  const router = useRouter(); const copy = useCopy(); const { locale } = useLocale();
  const [post, setPost] = useState<NativeFeedPost | null>(null);
  const [failed, setFailed] = useState(false); const [retry, setRetry] = useState(0);
  const reload = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    let active = true;
    const request = social.kind === "demo" ? social.loadCollectorPosts(authorId).then(page => { const original = page.items.find(post => post.id === postId); if (!original) throw new Error("missing_post"); return original; }) : loadNativePost(postId);
    void request.then(item => { if (active) { setPost(item); setFailed(false); } }).catch(() => { if (active) { setPost(null); setFailed(true); } });
    return () => { active = false; };
  }, [authorId, postId, retry, social]);
  if (!post && !failed) return <SeoullyLoadingState fullScreen label={copy.sharedMoment} />;
  return <SeoullyScreen><ScrollView contentContainerStyle={{ paddingBottom: 80 }}><ScreenBack label={copy.back} onPress={() => router.back()} />
    {failed ? <RetryNotice message={copy.feedUnavailable} retryLabel={copy.retry} onRetry={reload} /> : null}
    {post ? <SeoullyFeedPost item={post} copy={copy} locale={locale} onChange={setPost} /> : null}
  </ScrollView></SeoullyScreen>;
}
