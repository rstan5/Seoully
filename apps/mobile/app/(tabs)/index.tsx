import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeFeedPost, NativePostComment } from "../../src/api";
import { useSocialRepository, type FeedMode, type SocialSuggested } from "../../src/data";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { RetryNotice } from "../../src/components/RetryNotice";
import type { MobileCopy } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { colors } from "../../src/theme";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyChoiceChip } from "../../src/ui/SeoullyControls";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyLoadingState } from "../../src/ui/SeoullyLoadingState";
import { SeoullyPost } from "../../src/ui/SeoullyPost";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullyText } from "../../src/ui/SeoullyText";

export default function FeedScreen() {
  const copy = useCopy();
  const { locale, toggleLocale } = useLocale();
  const social = useSocialRepository();
  const [modes, setModes] = useState<{ production: FeedMode; demo: FeedMode }>({ production: "following", demo: "discover" });
  const mode = modes[social.kind];
  const [posts, setPosts] = useState<NativeFeedPost[]>([]);
  const [suggested, setSuggested] = useState<SocialSuggested[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (nextMode = mode) => {
    setLoading(true);
    try {
      const [page, people] = await Promise.all([social.loadFeed(nextMode), social.loadSuggested()]);
      setPosts(page.items);
      setNextCursor(page.nextCursor);
      setSuggested(people);
      setError(null);
    } catch {
      setError(copy.feedUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.feedUnavailable, mode, social]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  async function loadMore() {
    if (!nextCursor || loading || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await social.loadFeed(mode, nextCursor);
      setPosts((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setNextCursor(page.nextCursor);
    } catch {
      setError(copy.feedUnavailable);
    } finally {
      setLoadingMore(false);
    }
  }

  function changeMode(next: FeedMode) {
    setModes((current) => ({ ...current, [social.kind]: next }));
    void refresh(next);
  }

  const empty = mode === "following" ? copy.feedFollowingEmpty : copy.feedEmpty;

  return (
    <SeoullyScreen>
      <KeyboardScreen>
        <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
        {loading && posts.length === 0 && !error ? <SeoullyLoadingState label={copy.feedLoading} /> : null}
        {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={() => { void refresh(); }} /></View> : null}
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshing={loading && posts.length > 0}
          onRefresh={() => { void refresh(); }}
          onEndReached={() => { void loadMore(); }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View>
              {suggested.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggested}>
                  {suggested.map((person) => (
                    <SuggestedPerson key={person.user.userId} person={person} />
                  ))}
                </ScrollView>
              ) : null}
              {social.kind === "demo" ? (
                <View style={styles.modes}>
                  <SeoullyChoiceChip selected={mode === "following"} label={copy.feedFollowing} onPress={() => changeMode("following")} />
                  <SeoullyChoiceChip selected={mode === "discover"} label={copy.feedDiscover} onPress={() => changeMode("discover")} />
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <FeedPost
              item={item}
              copy={copy}
              locale={locale}
              onChange={(next) => setPosts((current) => current.map((post) => post.id === next.id ? next : post))}
            />
          )}
          ListEmptyComponent={!loading && !error ? <SeoullyEmptyState body={empty} /> : null}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.plum} style={styles.more} /> : null}
        />
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

function SuggestedPerson({ person }: { person: SocialSuggested }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/collector", params: { userId: person.user.userId } })}
      style={styles.person}
    >
      <SeoullyAvatar name={person.user.displayName} size={56} imageUrl={person.avatarUrl} />
      <SeoullyText variant="handle" numberOfLines={1}>{person.user.handle}</SeoullyText>
      <SeoullyText variant="caption" numberOfLines={2} style={styles.personMeta}>{person.meta}</SeoullyText>
    </Pressable>
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
  const social = useSocialRepository();
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
    try { await social.setPostLiked(item.id, nextLiked); }
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
      const page = await social.loadPostComments(item.id, cursor);
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
      const comment = await social.addPostComment(item.id, body);
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
  suggested: { gap: 14, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  person: { alignItems: "center", gap: 4, width: 76 },
  personMeta: { textAlign: "center" },
  modes: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
});
