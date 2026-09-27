import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { ensureConversation, loadCollectorPosts, loadCollectorProfile, setCollectorFollowing, setPostLiked, type NativeCollectorProfile, type NativeFeedPost } from "../src/api";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { useCopy } from "../src/locale";
import { colors, spacing } from "../src/theme";

export default function CollectorScreen() {
  const copy = useCopy();
  const router = useRouter();
  const { userId = "" } = useLocalSearchParams<{ userId?: string }>();
  const [profile, setProfile] = useState<NativeCollectorProfile | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [posts, setPosts] = useState<NativeFeedPost[]>([]);
  const [postCursor, setPostCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [result, page] = await Promise.all([
        loadCollectorProfile(userId),
        loadCollectorPosts(userId),
      ]);
      setProfile(result.profile);
      setFollowing(result.follow.following);
      setFollowers(result.follow.followers);
      setPosts(page.items);
      setPostCursor(page.nextCursor);
      setError(null);
      setPostsError(null);
    } catch {
      setError(copy.collectorUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.collectorUnavailable, userId]);
  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  async function loadMorePosts() {
    if (!postCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await loadCollectorPosts(userId, postCursor);
      setPosts((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setPostCursor(page.nextCursor);
      setPostsError(null);
    } catch {
      setPostsError(copy.feedUnavailable);
    } finally {
      setLoadingMore(false);
    }
  }

  async function toggleFollow() {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setFollowers((count) => Math.max(0, count + (next ? 1 : -1)));
    setBusy(true);
    try { await setCollectorFollowing(userId, next); }
    catch {
      setFollowing(!next);
      setFollowers((count) => Math.max(0, count + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const conversationId = await ensureConversation(userId);
      router.push({ pathname: "/thread", params: { conversationId, displayName: profile.user.displayName, handle: profile.user.handle } });
    } catch {
      setError(copy.messagesUnavailable);
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <ScreenBack label={copy.back} onPress={() => router.back()} />
    {loading ? <ActivityIndicator color={colors.plum} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {profile ? <>
      <Text style={styles.title}>{profile.user.displayName}</Text>
      <Text style={styles.handle}>@{profile.user.handle}</Text>
      {profile.profile.tagline ? <Text style={styles.tagline}>{profile.profile.tagline}</Text> : null}
      {profile.profile.bio ? <Text style={styles.bio}>{profile.profile.bio}</Text> : null}
      <View style={styles.stats}>
        <Text style={styles.stat}>{followers} {copy.followers}</Text>
        <Text style={styles.stat}>{profile.followingCount} {copy.following.toLowerCase()}</Text>
        {profile.collectionSummary ? <Text style={styles.stat}>{profile.collectionSummary.holdingCount} {copy.holdings}</Text> : null}
        {profile.collectionSummary ? <Text style={styles.stat}>{profile.collectionSummary.groupCount} {copy.groups}</Text> : null}
      </View>
      {profile.roomAvailable ? <Text style={styles.roomNote}>{copy.collectorHasRoom}</Text> : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: following }} disabled={busy} onPress={toggleFollow} style={[styles.button, following && styles.secondary]}><Text style={[styles.buttonText, following && styles.secondaryText]}>{following ? copy.following : copy.follow}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={message} style={styles.button}><Text style={styles.buttonText}>{copy.messageCollector}</Text></Pressable>
      </View>
      <Text style={styles.section}>{copy.collectorPosts}</Text>
      {postsError ? <RetryNotice message={postsError} retryLabel={copy.retry} onRetry={refresh} /> : null}
      {posts.map((post) => <CollectorPost key={post.id} copy={copy} post={post} onChange={(next) => setPosts((current) => current.map((item) => item.id === next.id ? next : item))} />)}
      {!loading && posts.length === 0 && !postsError ? <Text style={styles.empty}>{copy.collectorPostsEmpty}</Text> : null}
      {postCursor ? <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { void loadMorePosts(); }} style={styles.more}><Text style={styles.moreText}>{loadingMore ? copy.saving : copy.loadMorePosts}</Text></Pressable> : null}
    </> : null}
  </ScrollView></SafeAreaView>;
}

function CollectorPost({ post, copy, onChange }: { post: NativeFeedPost; copy: ReturnType<typeof useCopy>; onChange: (post: NativeFeedPost) => void }) {
  const image = post.media.find((item) => item.mediaType === "image");
  async function toggleLike() {
    const nextLiked = !post.likedByMe;
    const optimistic = { ...post, likedByMe: nextLiked, likeCount: Math.max(0, post.likeCount + (nextLiked ? 1 : -1)) };
    onChange(optimistic);
    try { await setPostLiked(post.id, nextLiked); }
    catch { onChange(post); }
  }
  return <View style={styles.post}>
    {image ? <Image accessibilityIgnoresInvertColors source={{ uri: image.url }} style={styles.media} /> : null}
    <Text style={styles.caption}>{post.caption || copy.sharedMoment}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ selected: post.likedByMe }} onPress={() => { void toggleLike(); }} style={styles.like}><Text style={styles.likeText}>{post.likedByMe ? copy.unlike : copy.like} · {post.likeCount}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.lg, paddingBottom: 80 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "700" },
  handle: { color: colors.plum, fontSize: 16, marginTop: spacing.xs },
  tagline: { color: colors.ink, fontSize: 18, fontWeight: "600", marginTop: spacing.lg },
  bio: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  stat: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999, borderWidth: 1, color: colors.ink, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  roomNote: { color: colors.muted, fontSize: 13, marginTop: spacing.md },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  button: { alignItems: "center", backgroundColor: colors.plum, borderColor: colors.plum, borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 50 },
  buttonText: { color: colors.surface, fontWeight: "700" },
  secondary: { backgroundColor: colors.surface },
  secondaryText: { color: colors.plum },
  section: { color: colors.ink, fontSize: 20, fontWeight: "700", marginTop: spacing.xl },
  empty: { color: colors.muted, marginTop: spacing.md },
  post: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginTop: spacing.md, overflow: "hidden" },
  media: { aspectRatio: 1, width: "100%" },
  caption: { color: colors.ink, fontSize: 15, padding: spacing.md },
  like: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  likeText: { color: colors.plum, fontWeight: "700" },
  more: { alignItems: "center", borderColor: colors.plum, borderRadius: 12, borderWidth: 1, justifyContent: "center", marginTop: spacing.md, minHeight: 44 },
  moreText: { color: colors.plum, fontWeight: "700" },
});
