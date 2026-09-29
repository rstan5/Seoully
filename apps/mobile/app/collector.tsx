import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeFeedPost } from "../src/api";
import { useSocialRepository, type SocialCollector, type SocialCompatibility } from "../src/data";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { collectibleKindLabel, type MobileCopy } from "../src/i18n";
import { useCopy, useLocale } from "../src/locale";
import { colors } from "../src/theme";
import { SeoullyButton, SeoullyChip, SeoullyShelf } from "../src/ui/SeoullyControls";
import { SeoullyEmptyState } from "../src/ui/SeoullyEmptyState";
import { SeoullyFeedPost } from "../src/ui/SeoullyFeedPost";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import {
  formatCollectingSince,
  SeoullyHighlight,
  SeoullyProfileHead,
  SeoullyProfileMeta,
  SeoullyProfileVeil,
  SeoullyRoomUnderlay,
  SeoullyShelfRow,
} from "../src/ui/SeoullyProfile";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";
import { SeoullyTradeMatch } from "../src/ui/SeoullyTradeMatch";

function highlightsFromCollector(collector: SocialCollector) {
  const groups = new Map<string, { name: string; count: number; imageUrl?: string; colorway?: { base: string; accent: string; ink: string } }>();
  for (const holding of collector.holdings) {
    const name = holding.template.groupName || holding.template.name;
    const current = groups.get(name) ?? { name, count: 0, imageUrl: holding.personalMediaUrl, colorway: holding.template.colorway };
    current.count += 1;
    if (!current.imageUrl && holding.personalMediaUrl) current.imageUrl = holding.personalMediaUrl;
    if (!current.colorway && holding.template.colorway) current.colorway = holding.template.colorway;
    groups.set(name, current);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 4);
}

function displayReasons(compatibility: SocialCompatibility, copy: MobileCopy) {
  if (compatibility.source === "domain") return compatibility.reasons;
  const labels: Record<string, string> = {
    SHARED_TEMPLATE: copy.compatReasonSharedTemplate,
    SHARED_GROUP: copy.compatReasonSharedGroup,
    SHARED_MEMBER: copy.compatReasonSharedMember,
    SHARED_RELEASE: copy.compatReasonSharedRelease,
    SHARED_FAVORITE_GROUP: copy.compatReasonSharedFavoriteGroup,
    SHARED_BIAS: copy.compatReasonSharedBias,
  };
  return compatibility.reasons.map((raw) => {
    const [code, count] = raw.split(":");
    const label = labels[code ?? ""] ?? raw;
    return count ? `${label} (${count})` : label;
  });
}

export default function CollectorScreen() {
  const copy = useCopy();
  const { locale, toggleLocale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const { userId = "" } = useLocalSearchParams<{ userId?: string }>();
  const [collector, setCollector] = useState<SocialCollector | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [posts, setPosts] = useState<NativeFeedPost[]>([]);
  const [postCursor, setPostCursor] = useState<string | null>(null);
  const [ownedExpanded, setOwnedExpanded] = useState(false);
  const [wishlistExpanded, setWishlistExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const viewerId = social.viewerId();
  const isSelf = Boolean(viewerId && viewerId === userId);

  const refresh = useCallback(async () => {
    if (viewerId && userId === viewerId) {
      router.replace("/(tabs)/profile");
      return;
    }
    setLoading(true);
    try {
      const [next, page] = await Promise.all([
        social.loadCollector(userId),
        social.loadCollectorPosts(userId),
      ]);
      setCollector(next);
      setFollowing(next.follow.following);
      setFollowers(next.follow.followers);
      setFollowingCount(next.follow.followingCount);
      setPosts(page.items);
      setPostCursor(page.nextCursor);
      setError(null);
      setPostsError(null);
      setNotice(null);
    } catch {
      setError(copy.collectorUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.collectorUnavailable, router, social, userId, viewerId]);

  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  const highlights = useMemo(() => (collector ? highlightsFromCollector(collector) : []), [collector]);

  async function loadMorePosts() {
    if (!postCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await social.loadCollectorPosts(userId, postCursor);
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
    if (busy || isSelf) return;
    const next = !following;
    setFollowing(next);
    setFollowers((count) => Math.max(0, count + (next ? 1 : -1)));
    setBusy(true);
    try {
      await social.setFollowing(userId, next);
    } catch {
      setFollowing(!next);
      setFollowers((count) => Math.max(0, count + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    if (!collector || busy) return;
    setNotice(social.kind === "demo" ? copy.messagesBlocked : copy.messagesUnavailable);
  }

  function messageAboutTrade(templateIds: string[]) {
    // Reserved for DM prefill after 20261001000000_direct_messages.sql.
    void templateIds;
    setNotice(social.kind === "demo" ? copy.messagesBlocked : copy.messagesTradeUnavailable);
  }

  function enterRoom() {
    if (!collector) return;
    if (social.kind === "demo" || !collector.roomAvailable) {
      setNotice(social.kind === "demo" ? copy.demoRoomUnavailable : copy.roomPrivate);
      return;
    }
    router.push({ pathname: "/collector-room", params: { userId } });
  }

  return (
    <SeoullyScreen backgroundColor={collector?.theme?.mist ?? colors.mist}>
      <SeoullyRoomUnderlay theme={collector?.theme} />
      <SeoullyProfileVeil theme={collector?.theme} />
      <View style={styles.top}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.lang}>
          <SeoullyText variant="button">{copy.switchLanguage}</SeoullyText>
        </Pressable>
      </View>
      {loading && !collector ? <SeoullyLoadingState label={copy.profile} /> : null}
      {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}
      {collector ? (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <SeoullyProfileHead
              name={collector.user.displayName}
              handle={collector.user.handle}
              imageUrl={collector.avatarUrl}
              counts={[
                { value: posts.length, label: copy.profilePosts },
                { value: followers, label: copy.profileFollowers },
                { value: followingCount, label: copy.profileFollowingCount },
                ...(social.capabilities.publicCollectionRows
                  ? [
                      { value: collector.holdingCount, label: copy.profileCollected },
                      { value: collector.wishlist.length, label: copy.profileWishlistCount },
                    ]
                  : []),
              ]}
            />
            <SeoullyProfileMeta
              bio={collector.profile.bio || collector.profile.tagline}
              location={collector.profile.location}
              since={collector.user.joinedAt ? copy.profileCollectingSince.replace("{date}", formatCollectingSince(collector.user.joinedAt, locale)) : undefined}
              collectorType={collector.profile.collectorType}
            />
            {!isSelf ? (
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
            ) : null}
            <View style={styles.enter}>
              <SeoullyButton
                label={copy.viewCollectorRoom}
                variant="enter"
                onPress={enterRoom}
              />
            </View>
            {notice ? <SeoullyText variant="secondary" style={styles.inlineNotice}>{notice}</SeoullyText> : null}
            <SeoullyText variant="caption" color={colors.muted} style={styles.inlineNotice}>{copy.profileUnderlayHint}</SeoullyText>
          </View>

          {collector.groups.length > 0 || collector.biases.length > 0 || collector.eras.length > 0 ? (
            <View style={styles.chips}>
              {collector.groups.map((group) => <SeoullyChip key={group.id} label={group.name} />)}
              {collector.biases.map((member) => <SeoullyChip key={member.id} label={member.name} tone="bias" />)}
              {collector.eras.map((era) => <SeoullyChip key={era.id} label={era.name} />)}
            </View>
          ) : null}

          {highlights.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
              {highlights.map((slice) => (
                <SeoullyHighlight
                  key={slice.name}
                  name={slice.name}
                  countLabel={copy.profileOwnedCount.replace("{count}", String(slice.count))}
                  imageUrl={slice.imageUrl}
                  colorway={slice.colorway}
                />
              ))}
            </ScrollView>
          ) : null}

          {collector.compatibility ? (
            <View style={styles.compat}>
              <SeoullyText variant="title">
                {copy.compatScore.replace("{score}", String(collector.compatibility.score))}
              </SeoullyText>
              <SeoullyText variant="section" style={styles.compatLabel}>{copy.compatTitle}</SeoullyText>
              {displayReasons(collector.compatibility, copy).slice(0, 4).map((reason) => (
                <SeoullyText key={reason} variant="secondary" style={styles.compatReason}>{reason}</SeoullyText>
              ))}
              <SeoullyTradeMatch
                compatibility={collector.compatibility}
                copy={copy}
                canMessage={social.capabilities.persistMessages}
                onMessage={messageAboutTrade}
              />
            </View>
          ) : null}

          <SeoullyShelf title={copy.profilePostsTitle} empty={posts.length === 0 && !postsError ? copy.profileEmptyPosts : undefined}>
            {postsError ? <RetryNotice message={postsError} retryLabel={copy.retry} onRetry={refresh} /> : null}
            {posts.map((post) => (
              <SeoullyFeedPost
                key={post.id}
                item={post}
                copy={copy}
                locale={locale}
                onChange={(next) => setPosts((current) => current.map((item) => item.id === next.id ? next : item))}
              />
            ))}
            {postCursor ? (
              <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { void loadMorePosts(); }} style={styles.more}>
                <SeoullyText variant="button" color={colors.plum}>{loadingMore ? copy.saving : copy.loadMorePosts}</SeoullyText>
              </Pressable>
            ) : null}
          </SeoullyShelf>

          {social.capabilities.publicCollectionRows ? (
            <>
          <SeoullyShelf
            title={copy.profileOwned}
            count={collector.holdingCount}
            expanded={ownedExpanded}
            onToggle={() => setOwnedExpanded((value) => !value)}
            empty={collector.holdings.length === 0 ? copy.profileEmptyOwned : undefined}
          >
            {collector.holdings.map((holding) => (
              <SeoullyShelfRow
                key={holding.id}
                title={holding.template.name}
                meta={[
                  holding.template.groupName,
                  holding.template.memberName,
                  collectibleKindLabel(holding.template.kind, copy),
                  holding.tradeStatus === "for-trade" ? copy.compatOpenToTrade : undefined,
                ].filter(Boolean).join(" · ")}
                colorway={holding.template.colorway}
                imageUrl={holding.personalMediaUrl}
              />
            ))}
          </SeoullyShelf>

          <SeoullyShelf
            title={copy.profileWishlistTitle}
            count={collector.wishlist.length}
            expanded={wishlistExpanded}
            onToggle={() => setWishlistExpanded((value) => !value)}
            empty={collector.wishlist.length === 0 ? copy.profileEmptyWish : undefined}
          >
            {collector.wishlist.map((entry) => (
              <SeoullyShelfRow
                key={entry.id}
                title={entry.template.name}
                meta={[entry.template.groupName, entry.template.memberName, collectibleKindLabel(entry.template.kind, copy)].filter(Boolean).join(" · ")}
                colorway={entry.template.colorway}
              />
            ))}
          </SeoullyShelf>
            </>
          ) : (
            <SeoullyText variant="secondary" style={styles.connect}>{copy.publicShelvesUnavailable}</SeoullyText>
          )}

          <SeoullyText variant="secondary" style={styles.connect}>
            {copy.profileConnect.replace("{name}", collector.user.displayName)}
          </SeoullyText>
        </ScrollView>
      ) : !loading && !error ? <SeoullyEmptyState align="start" body={copy.collectorUnavailable} /> : null}
    </SeoullyScreen>
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
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  highlights: { gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  enter: { marginTop: 10 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  inlineNotice: { marginTop: 10 },
  compat: {
    backgroundColor: colors.mist,
    borderRadius: 16,
    gap: 4,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
  },
  compatLabel: { marginTop: 2 },
  compatReason: { marginTop: 4 },
  connect: { marginTop: 20, paddingHorizontal: 16 },
  more: { alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: 8 },
});
