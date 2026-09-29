import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeFeedPost } from "../../src/api";
import { useSocialRepository, type FeedMode, type SocialSuggested } from "../../src/data";
import { useReportAskSurface } from "../../src/ask-surface";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { RetryNotice } from "../../src/components/RetryNotice";
import type { MobileCopy } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { colors, elevation } from "../../src/theme";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyFeedPost } from "../../src/ui/SeoullyFeedPost";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyLoadingState } from "../../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullyText } from "../../src/ui/SeoullyText";

export default function FeedScreen() {
  const copy = useCopy();
  const { locale, toggleLocale } = useLocale();
  const social = useSocialRepository();
  const router = useRouter();
  const [modes, setModes] = useState<{ production: FeedMode; demo: FeedMode }>({ production: "discover", demo: "discover" });
  const mode = social.capabilities.discoverFeed ? modes[social.kind] : "following";
  useReportAskSurface({ surface: mode === "following" ? "following" : "discover" });
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

  const empty = mode === "following" ? copy.feedFollowingEmpty : copy.feedEmptyDiscover;

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
                    <SuggestedPerson key={person.user.userId} person={person} copy={copy} />
                  ))}
                </ScrollView>
              ) : null}
              <View style={styles.modes}>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "following" }} onPress={() => changeMode("following")} style={styles.mode}>
                  <SeoullyText variant="handle" color={mode === "following" ? colors.ink : colors.muted}>{copy.feedFollowing}</SeoullyText>
                  <View style={[styles.modeLine, mode === "following" && styles.modeLineOn]} />
                </Pressable>
              {social.capabilities.discoverFeed ? (
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: mode === "discover" }} onPress={() => changeMode("discover")} style={styles.mode}>
                  <SeoullyText variant="handle" color={mode === "discover" ? colors.ink : colors.muted}>{copy.feedDiscover}</SeoullyText>
                  <View style={[styles.modeLine, mode === "discover" && styles.modeLineOn]} />
                </Pressable>
              ) : null}
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <SeoullyFeedPost
              item={item}
              copy={copy}
              locale={locale}
              onChange={(next) => setPosts((current) => current.map((post) => post.id === next.id ? next : post))}
            />
          )}
          ListEmptyComponent={!loading && !error ? (
            <View>
              <SeoullyEmptyState body={empty} />
              {mode === "following" ? (
                <View style={styles.emptyActions}>
                  {social.capabilities.discoverFeed ? (
                    <Pressable accessibilityRole="button" onPress={() => changeMode("discover")} style={styles.emptyAction}>
                      <SeoullyText variant="button" color={colors.plum}>{copy.feedOpenDiscover}</SeoullyText>
                    </Pressable>
                  ) : null}
                  <Pressable accessibilityRole="button" onPress={() => router.push("/search")} style={styles.emptyAction}>
                    <SeoullyText variant="button" color={colors.plum}>{copy.feedOpenSearch}</SeoullyText>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.plum} style={styles.more} /> : null}
        />
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

function SuggestedPerson({ person, copy }: { person: SocialSuggested; copy: MobileCopy }) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: "/collector", params: { userId: person.user.userId } })}
      style={styles.person}
    >
      <SeoullyAvatar name={person.user.displayName} size={56} imageUrl={person.avatarUrl} />
      <SeoullyText variant="handle" numberOfLines={1} style={styles.personName}>{person.user.handle}</SeoullyText>
      <View style={styles.personScore}>
        <SeoullyText variant="caption" color={colors.plum}>{copy.feedMatchScore.replace("{score}", String(person.score))}</SeoullyText>
      </View>
      {person.subtitleKind === "reciprocal" ? (
        <SeoullyText variant="caption" numberOfLines={2} style={styles.personMeta}>{copy.feedSuggestedReciprocal}</SeoullyText>
      ) : person.subtitleKind === "wishlist" ? (
        <SeoullyText variant="caption" numberOfLines={2} style={styles.personMeta}>{copy.feedSuggestedWishlist}</SeoullyText>
      ) : person.subtitle ? (
        <SeoullyText variant="caption" numberOfLines={2} style={styles.personMeta}>{person.subtitle}</SeoullyText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, paddingBottom: 24 },
  notice: { paddingHorizontal: 16 },
  more: { marginVertical: 18 },
  suggested: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12, paddingBottom: 14, paddingHorizontal: 16, paddingTop: 16 },
  person: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    minWidth: 92,
    paddingBottom: 8,
    paddingHorizontal: 8,
    paddingTop: 10,
    ...elevation.card,
  },
  personName: { fontSize: 12 },
  personScore: {
    backgroundColor: colors.lilacSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  personMeta: { maxWidth: 88, textAlign: "center" },
  modes: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    marginHorizontal: 16,
  },
  mode: { alignItems: "center", flex: 1, paddingBottom: 10, paddingTop: 11 },
  modeLine: { backgroundColor: "transparent", height: 2, marginTop: 8, width: "100%" },
  modeLineOn: { backgroundColor: colors.ink },
  emptyActions: { alignItems: "center", gap: 10, marginTop: 16, paddingHorizontal: 20 },
  emptyAction: { minHeight: 44, justifyContent: "center" },
});
