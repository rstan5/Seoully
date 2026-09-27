import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Image, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { addPostComment, loadFeed, loadPostComments, setPostLiked, type NativeFeedPost, type NativePostComment } from "../../src/api";
import { RetryNotice } from "../../src/components/RetryNotice";
import { useCopy } from "../../src/locale";
import type { MobileCopy } from "../../src/i18n";
import { colors, spacing } from "../../src/theme";

export default function FeedScreen() {
  const copy = useCopy();
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
  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <Text style={styles.eyebrow}>{copy.brand}</Text>
    <Text style={styles.title}>{copy.feed}</Text>
    {loading && <ActivityIndicator color={colors.plum} />}
    {error && <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} />}
    <FlatList data={posts} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshing={loading && posts.length > 0} onRefresh={refresh} onEndReached={loadMore} onEndReachedThreshold={0.4} renderItem={({ item }) =>
      <PostCard item={item} copy={copy} onChange={(next) => setPosts((current) => current.map((post) => post.id === next.id ? next : post))} />
    } ListEmptyComponent={!loading && !error ? <Text style={styles.body}>{copy.feedEmpty}</Text> : null} ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.plum} /> : null} />
  </View></SafeAreaView>;
}

function PostCard({ item, copy, onChange }: { item: NativeFeedPost; copy: MobileCopy; onChange: (post: NativeFeedPost) => void }) {
  const router = useRouter();
  const [comments, setComments] = useState<NativePostComment[] | null>(null);
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
    if (comments) return setComments(null);
    await loadComments();
  }

  async function loadComments() {
    setCommentError(null);
    try { setComments(await loadPostComments(item.id)); }
    catch { setCommentError(copy.commentsUnavailable); }
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

  const image = item.media.find((media) => media.mediaType === "image");
  return <View style={styles.post}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${copy.viewCollector}: ${item.author.displayName}`} onPress={() => openCollector(item.author.userId)}>
      <Text style={styles.author}>{item.author.displayName} · @{item.author.handle}</Text>
    </Pressable>
    {image ? <Image accessibilityIgnoresInvertColors source={{ uri: image.url }} style={styles.media} /> : null}
    <Text style={styles.caption}>{item.caption || copy.sharedMoment}</Text>
    <Text style={styles.meta}>{item.likeCount} {copy.likes} · {item.commentCount} {copy.comments}</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: item.likedByMe }} disabled={busy} onPress={toggleLike} style={[styles.action, item.likedByMe && styles.actionSelected]}>
        <Text style={[styles.actionLabel, item.likedByMe && styles.actionLabelSelected]}>{item.likedByMe ? copy.unlike : copy.like}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={toggleComments} style={styles.action}>
        <Text style={styles.actionLabel}>{comments ? copy.hideComments : copy.viewComments}</Text>
      </Pressable>
    </View>
    {commentError ? <RetryNotice message={commentError} retryLabel={copy.retry} onRetry={() => { void loadComments(); }} /> : null}
    {comments ? <View style={styles.comments}>
      {comments.map((comment) => <View key={comment.id} style={styles.comment}><Pressable accessibilityRole="button" onPress={() => openCollector(comment.author.userId)}><Text style={styles.commentAuthor}>@{comment.author.handle}</Text></Pressable><Text style={styles.commentBody}>{comment.body}</Text></View>)}
      <View style={styles.commentComposer}>
        <TextInput accessibilityLabel={copy.commentPlaceholder} placeholder={copy.commentPlaceholder} value={commentBody} onChangeText={setCommentBody} onSubmitEditing={submitComment} style={styles.commentInput} />
        <Pressable accessibilityRole="button" disabled={!commentBody.trim() || busy} onPress={submitComment} style={styles.commentButton}><Text style={styles.commentButtonLabel}>{copy.postComment}</Text></Pressable>
      </View>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, padding: spacing.lg },
  eyebrow: { color: colors.plum, fontSize: 15, fontWeight: "700" },
  title: { color: colors.ink, fontSize: 34, fontWeight: "700", marginTop: spacing.xs },
  body: { color: colors.muted, fontSize: 16, marginTop: spacing.md },
  list: { gap: spacing.sm, paddingBottom: 120, paddingVertical: spacing.lg },
  post: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: spacing.md },
  author: { color: colors.plum, fontWeight: "700" },
  media: { aspectRatio: 4 / 3, borderRadius: 12, marginTop: spacing.sm, width: "100%" },
  caption: { color: colors.ink, fontSize: 16, marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  action: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  actionSelected: { backgroundColor: colors.blush, borderColor: colors.plum },
  actionLabel: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  actionLabelSelected: { color: colors.plum },
  error: { color: colors.plum, fontSize: 13, marginTop: spacing.sm },
  comments: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md },
  comment: { flexDirection: "row", gap: spacing.xs },
  commentAuthor: { color: colors.plum, fontSize: 13, fontWeight: "700" },
  commentBody: { color: colors.ink, flex: 1, fontSize: 13 },
  commentComposer: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  commentInput: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.ink, flex: 1, minHeight: 42, paddingHorizontal: spacing.sm },
  commentButton: { backgroundColor: colors.plum, borderRadius: 12, justifyContent: "center", minHeight: 42, paddingHorizontal: spacing.sm },
  commentButtonLabel: { color: colors.surface, fontSize: 13, fontWeight: "700" },
});
