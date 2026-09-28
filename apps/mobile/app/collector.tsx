import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  ensureConversation,
  loadCollectorPosts,
  loadCollectorProfile,
  setCollectorFollowing,
  setPostLiked,
  type NativeCollectorProfile,
  type NativeFeedPost,
} from "../src/api";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { useCopy, useLocale } from "../src/locale";
import { colors } from "../src/theme";
import { SeoullyButton, SeoullyChip, SeoullyShelf } from "../src/ui/SeoullyControls";
import { SeoullyEmptyState } from "../src/ui/SeoullyEmptyState";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import {
  formatCollectingSince,
  SeoullyProfileHead,
  SeoullyProfileMeta,
} from "../src/ui/SeoullyProfile";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function CollectorScreen() {
  const copy = useCopy();
  const { locale, toggleLocale } = useLocale();
  const router = useRouter();
  const { userId = "" } = useLocalSearchParams<{ userId?: string }>();
  const [profile, setProfile] = useState<NativeCollectorProfile | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
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
      setFollowingCount(result.follow.followingCount);
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
    try {
      await setCollectorFollowing(userId, next);
    } catch {
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

  return (
    <SeoullyScreen>
      <View style={styles.top}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.lang}>
          <SeoullyText variant="button">{copy.switchLanguage}</SeoullyText>
        </Pressable>
      </View>
      {loading && !profile ? <SeoullyLoadingState label={copy.profile} /> : null}
      {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}
      {profile ? (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <SeoullyProfileHead
              name={profile.user.displayName}
              handle={profile.user.handle}
              counts={[
                { value: posts.length, label: copy.profilePosts },
                { value: followers, label: copy.profileFollowers },
                { value: followingCount, label: copy.profileFollowingCount },
                { value: profile.collectionSummary?.holdingCount ?? 0, label: copy.profileCollected },
              ]}
            />
            <SeoullyProfileMeta
              bio={profile.profile.bio || profile.profile.tagline}
              location={profile.profile.location}
              since={profile.user.joinedAt ? copy.profileCollectingSince.replace("{date}", formatCollectingSince(profile.user.joinedAt, locale)) : undefined}
            />
            {profile.profile.collectorInterests.length > 0 ? (
              <View style={styles.chips}>
                {profile.profile.collectorInterests.map((interest) => (
                  <SeoullyChip key={interest} label={interest} />
                ))}
              </View>
            ) : null}
            <View style={styles.actions}>
              <SeoullyButton
                label={following ? copy.following : copy.follow}
                variant={following ? "ghost" : "primary"}
                disabled={busy}
                fill
                onPress={() => { void toggleFollow(); }}
              />
              <SeoullyButton label={copy.messageCollector} variant="ghost" disabled={busy} fill onPress={() => { void message(); }} />
            </View>
            <SeoullyButton
              label={copy.viewCollectorRoom}
              variant="enter"
              onPress={() => router.push({ pathname: "/collector-room", params: { userId } })}
            />
          </View>

          <SeoullyShelf title={copy.profilePostsTitle} empty={posts.length === 0 && !postsError ? copy.profileEmptyPosts : undefined}>
            {postsError ? <RetryNotice message={postsError} retryLabel={copy.retry} onRetry={refresh} /> : null}
            {posts.map((post) => (
              <CollectorPost
                key={post.id}
                copy={copy}
                post={post}
                onChange={(next) => setPosts((current) => current.map((item) => item.id === next.id ? next : item))}
              />
            ))}
            {postCursor ? (
              <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { void loadMorePosts(); }} style={styles.more}>
                <SeoullyText variant="button" color={colors.plum}>{loadingMore ? copy.saving : copy.loadMorePosts}</SeoullyText>
              </Pressable>
            ) : null}
          </SeoullyShelf>

          <SeoullyText variant="secondary" style={styles.connect}>
            {copy.profileConnect.replace("{name}", profile.user.displayName)}
          </SeoullyText>
        </ScrollView>
      ) : !loading && !error ? <SeoullyEmptyState align="start" body={copy.collectorUnavailable} /> : null}
    </SeoullyScreen>
  );
}

function CollectorPost({
  post,
  copy,
  onChange,
}: {
  post: NativeFeedPost;
  copy: ReturnType<typeof useCopy>;
  onChange: (post: NativeFeedPost) => void;
}) {
  const image = post.media.find((item) => item.mediaType === "image");
  async function toggleLike() {
    const nextLiked = !post.likedByMe;
    const optimistic = { ...post, likedByMe: nextLiked, likeCount: Math.max(0, post.likeCount + (nextLiked ? 1 : -1)) };
    onChange(optimistic);
    try {
      await setPostLiked(post.id, nextLiked);
    } catch {
      onChange(post);
    }
  }
  const likeLabel = post.likeCount === 1 ? copy.likeOne : copy.likeMany.replace("{count}", String(post.likeCount));
  return (
    <View style={styles.post}>
      {image ? <Image accessibilityIgnoresInvertColors source={{ uri: image.url }} style={styles.media} /> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ selected: post.likedByMe }} onPress={() => { void toggleLike(); }}>
        <SeoullyText variant="handle">{post.likedByMe ? copy.unlike : copy.like}</SeoullyText>
      </Pressable>
      {post.likeCount > 0 ? <SeoullyText variant="handle">{likeLabel}</SeoullyText> : null}
      <SeoullyText variant="body">
        <SeoullyText variant="handle">{post.author.handle}</SeoullyText>
        {"  "}
        {post.caption || copy.sharedMoment}
      </SeoullyText>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  lang: { justifyContent: "center", minHeight: 44, paddingHorizontal: 4 },
  container: { paddingBottom: 48 },
  card: { paddingHorizontal: 16, paddingTop: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  connect: { marginTop: 20, paddingHorizontal: 16 },
  post: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingBottom: 16,
    paddingTop: 12,
  },
  media: { aspectRatio: 4 / 3, borderRadius: 14, width: "100%" },
  more: { alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: 8 },
});
