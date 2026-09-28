import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { addPostComment, loadFeed, loadPostComments, setPostLiked, type NativeFeedPost, type NativePostComment } from "../../src/api";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { RetryNotice } from "../../src/components/RetryNotice";
import type { MobileCopy } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { colors } from "../../src/theme";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyLoadingState } from "../../src/ui/SeoullyLoadingState";
import { SeoullyPost } from "../../src/ui/SeoullyPost";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";

export default function FeedScreen() {
  const copy = useCopy();
  const { locale, toggleLocale } = useLocale();
  const [posts, setPosts] = useState<NativeFeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const page = await loadFeed();
      setPosts(page.items);
      setNextCursor(page.nextCursor);
      setError(null);
    } catch {
      setError(copy.feedUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.feedUnavailable]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  async function loadMore() {
    if (!nextCursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadFeed(nextCursor);
      setPosts((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setNextCursor(page.nextCursor);
    } catch {
      setError(copy.feedUnavailable);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <SeoullyScreen>
      <KeyboardScreen>
        <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
        {loading && posts.length === 0 && !error ? <SeoullyLoadingState label={copy.feedLoading} /> : null}
        {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading && posts.length > 0}
          onRefresh={refresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <FeedPost
              item={item}
              copy={copy}
              locale={locale}
              onChange={(next) => setPosts((current) => current.map((post) => post.id === next.id ? next : post))}
            />
          )}
          ListEmptyComponent={!loading && !error ? <SeoullyEmptyState title={copy.brand} body={`${copy.feedEmpty}\n\n${copy.feedEmptyLead}`} /> : null}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.plum} style={styles.more} /> : null}
        />
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

function FeedPost({
  item,
  copy,
  locale,
  onChange,
}: {
  item: NativeFeedPost;
  copy: MobileCopy;
  locale: "en" | "ko";
  onChange: (post: NativeFeedPost) => void;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<NativePostComment[] | null>(null);
  const [commentCursor, setCommentCursor] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  function openCollector(userId?: string) {
    if (!userId) return;
    router.push({ pathname: "/collector", params: { userId } });
  }

  async function toggleLike() {
    if (busy) return;
    const nextLiked = !item.likedByMe;
    const optimistic = { ...item, likedByMe: nextLiked, likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)) };
    onChange(optimistic);
    setBusy(true);
    try { await setPostLiked(item.id, nextLiked); }
    catch { onChange(item); }
    finally { setBusy(false); }
  }

  async function toggleComments() {
    if (comments) {
      setComments(null);
      setCommentCursor(null);
      return;
    }
    await loadComments();
  }

  async function loadComments(cursor?: string) {
    setCommentError(null);
    try {
      const page = await loadPostComments(item.id, cursor);
      setComments((current) => cursor ? [...(current ?? []), ...page.items.filter((comment) => !(current ?? []).some((existing) => existing.id === comment.id))] : page.items);
      setCommentCursor(page.nextCursor);
    } catch { setCommentError(copy.commentsUnavailable); }
  }

  async function submitComment() {
    const body = commentBody.trim();
    if (!body || busy) return;
    setBusy(true);
    setCommentError(null);
    try {
      const comment = await addPostComment(item.id, body);
      setComments((current) => [...(current ?? []), comment]);
      setCommentBody("");
      onChange({ ...item, commentCount: item.commentCount + 1 });
    } catch {
      setCommentError(copy.commentFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SeoullyPost
      item={item}
      copy={copy}
      locale={locale}
      comments={comments}
      commentCursor={commentCursor}
      commentBody={commentBody}
      commentError={commentError}
      busy={busy}
      onOpenCollector={openCollector}
      onToggleLike={() => { void toggleLike(); }}
      onToggleComments={() => { void toggleComments(); }}
      onLoadMoreComments={() => { void loadComments(commentCursor ?? undefined); }}
      onChangeComment={setCommentBody}
      onSubmitComment={() => { void submitComment(); }}
      onRetryComments={() => { void loadComments(); }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingBottom: 24 },
  notice: { paddingHorizontal: 16 },
  more: { marginVertical: 18 },
});
