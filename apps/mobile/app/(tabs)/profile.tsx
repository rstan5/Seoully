import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  loadCollectorPosts,
  loadCollectorProfile,
  loadMyHoldings,
  loadMyWishlist,
  loadNativeOnboarding,
  resolveNativeIdentity,
  setWishlistTemplate,
  updateHoldingTradeStatus,
  type NativeFeedPost,
  type NativeHolding,
  type NativeIdentity,
  type NativeOnboardingState,
  type NativeWishlistEntry,
} from "../../src/api";
import { RetryNotice } from "../../src/components/RetryNotice";
import { collectibleKindLabel } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { colors } from "../../src/theme";
import { SeoullyButton, SeoullyChip, SeoullyShelf } from "../../src/ui/SeoullyControls";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyLoadingState } from "../../src/ui/SeoullyLoadingState";
import {
  formatCollectingSince,
  SeoullyHighlight,
  SeoullyProfileHead,
  SeoullyProfileMeta,
  SeoullyShelfRow,
} from "../../src/ui/SeoullyProfile";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullyText } from "../../src/ui/SeoullyText";

const COLLECTION_TAB_KEY = "seoully.mobile.collection-tab.v1";

function highlightsFromHoldings(holdings: NativeHolding[]) {
  const groups = new Map<string, { name: string; count: number; imageUrl?: string }>();
  for (const holding of holdings) {
    const name = holding.template.groupName || holding.template.name;
    const current = groups.get(name) ?? { name, count: 0, imageUrl: holding.personalMediaUrl };
    current.count += 1;
    if (!current.imageUrl && holding.personalMediaUrl) current.imageUrl = holding.personalMediaUrl;
    groups.set(name, current);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 4);
}

export default function ProfileScreen() {
  const router = useRouter();
  const copy = useCopy();
  const { locale, toggleLocale } = useLocale();
  const [identity, setIdentity] = useState<NativeIdentity | null>(null);
  const [followers, setFollowers] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [holdingCount, setHoldingCount] = useState(0);
  const [posts, setPosts] = useState<NativeFeedPost[]>([]);
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [wishlist, setWishlist] = useState<NativeWishlistEntry[]>([]);
  const [onboarding, setOnboarding] = useState<NativeOnboardingState | null>(null);
  const [ownedExpanded, setOwnedExpanded] = useState(false);
  const [wishlistExpanded, setWishlistExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const nextIdentity = await resolveNativeIdentity<NativeIdentity>();
      if (!nextIdentity?.user.id) throw new Error("identity_unavailable");
      const [publicProfile, page, nextHoldings, nextWishlist, tastes] = await Promise.all([
        loadCollectorProfile(nextIdentity.user.id),
        loadCollectorPosts(nextIdentity.user.id),
        loadMyHoldings(0, 100),
        loadMyWishlist(0, 100),
        loadNativeOnboarding().catch(() => null),
      ]);
      setIdentity(nextIdentity);
      setFollowers(publicProfile.follow.followers);
      setFollowingCount(publicProfile.follow.followingCount);
      setHoldingCount(publicProfile.profile.collectionSummary?.holdingCount ?? nextHoldings.length);
      setPosts(page.items);
      setHoldings(nextHoldings);
      setWishlist(nextWishlist);
      setOnboarding(tastes);
      setError(null);
    } catch {
      setError(copy.profileUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.profileUnavailable]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const groups = useMemo(() => {
    const ids = identity?.profile.favoriteGroupIds ?? [];
    return (onboarding?.groups ?? []).filter((group) => ids.includes(group.id));
  }, [identity, onboarding]);
  const biases = useMemo(() => {
    const ids = identity?.profile.biasMemberIds ?? [];
    return (onboarding?.members ?? []).filter((member) => ids.includes(member.id));
  }, [identity, onboarding]);
  const highlights = useMemo(() => highlightsFromHoldings(holdings), [holdings]);

  async function toggleTrade(holding: NativeHolding) {
    const next = holding.tradeStatus === "for-trade" ? "not-for-trade" : "for-trade";
    setHoldings((current) => current.map((item) => item.id === holding.id ? { ...item, tradeStatus: next } : item));
    try {
      await updateHoldingTradeStatus(holding.id, next);
    } catch {
      setHoldings((current) => current.map((item) => item.id === holding.id ? holding : item));
    }
  }

  async function removeWanted(templateId: string) {
    setWishlist((current) => current.filter((entry) => entry.templateId !== templateId));
    try {
      await setWishlistTemplate(templateId, false);
    } catch {
      await refresh();
    }
  }

  async function openCollection(tab: "collection" | "wishlist") {
    await AsyncStorage.setItem(COLLECTION_TAB_KEY, tab);
    router.push("/collection");
  }

  return (
    <SeoullyScreen>
      <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
      {loading && !identity ? <SeoullyLoadingState label={copy.profile} /> : null}
      {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}
      {identity ? (
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.card}>
            <SeoullyProfileHead
              name={identity.user.displayName}
              handle={identity.user.handle}
              editLabel={copy.profileEdit}
              onEdit={() => router.push("/edit-profile")}
              counts={[
                { value: posts.length, label: copy.profilePosts },
                { value: followers, label: copy.profileFollowers },
                { value: followingCount, label: copy.profileFollowingCount },
                { value: holdingCount, label: copy.profileCollected },
                { value: wishlist.length, label: copy.profileWishlistCount },
              ]}
            />
            <SeoullyProfileMeta
              bio={identity.profile.bio || identity.profile.tagline}
              location={identity.profile.location}
              since={identity.user.joinedAt ? copy.profileCollectingSince.replace("{date}", formatCollectingSince(identity.user.joinedAt, locale)) : undefined}
              collectorType={identity.profile.collectorType}
            />
            <SeoullyButton label={copy.viewCollectorRoom} variant="enter" onPress={() => router.push("/room")} />
            <View style={styles.collectAction}>
              <SeoullyButton
                label={copy.profileAddToCollection}
                variant="ghost"
                block
                onPress={() => router.push("/collect")}
              />
            </View>
          </View>

          {groups.length > 0 || biases.length > 0 ? (
            <View style={styles.chips}>
              {groups.map((group) => <SeoullyChip key={group.id} label={group.name} />)}
              {biases.map((member) => <SeoullyChip key={member.id} label={member.stageName} tone="bias" />)}
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
                />
              ))}
            </ScrollView>
          ) : null}

          <SeoullyShelf title={copy.profilePostsTitle} empty={posts.length === 0 ? copy.profileEmptyPostsSelf : undefined}>
            {posts.slice(0, 6).map((post) => {
              const image = post.media.find((media) => media.mediaType === "image");
              return (
                <SeoullyShelfRow
                  key={post.id}
                  title={post.caption || copy.sharedMoment}
                  meta={post.author.handle}
                  imageUrl={image?.url}
                />
              );
            })}
          </SeoullyShelf>

          <SeoullyShelf
            title={copy.profileOwned}
            count={holdingCount}
            expanded={ownedExpanded}
            onToggle={() => setOwnedExpanded((value) => !value)}
            empty={holdings.length === 0 ? copy.profileEmptyOwnedSelf : undefined}
          >
            {holdings.slice(0, 8).map((holding) => (
              <View key={holding.id}>
                <SeoullyShelfRow
                  title={holding.template.name}
                  meta={[holding.template.groupName, holding.template.memberName, collectibleKindLabel(holding.template.kind, copy)].filter(Boolean).join(" · ")}
                  imageUrl={holding.personalMediaUrl}
                  onPress={() => router.push({ pathname: "/collectible", params: { holdingId: holding.id } })}
                />
                <Pressable accessibilityRole="button" onPress={() => { void toggleTrade(holding); }} style={styles.shelfAction}>
                  <SeoullyText variant="caption" color={colors.plum}>
                    {holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}
                  </SeoullyText>
                </Pressable>
              </View>
            ))}
            {holdings.length === 0 ? (
              <Pressable accessibilityRole="button" onPress={() => router.push("/collect")} style={styles.shelfAction}>
                <SeoullyText variant="button" color={colors.plum}>{copy.profileAddToCollection}</SeoullyText>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => { void openCollection("collection"); }}>
                <SeoullyText variant="button" color={colors.plum}>{copy.profileSeeAll}</SeoullyText>
              </Pressable>
            )}
          </SeoullyShelf>

          <SeoullyShelf
            title={copy.profileWishlistTitle}
            count={wishlist.length}
            expanded={wishlistExpanded}
            onToggle={() => setWishlistExpanded((value) => !value)}
            empty={wishlist.length === 0 ? copy.profileEmptyWishSelf : undefined}
          >
            {wishlist.slice(0, 8).map((entry) => (
              <SeoullyShelfRow
                key={entry.id}
                title={entry.template.name}
                meta={[entry.template.groupName, entry.template.memberName, collectibleKindLabel(entry.template.kind, copy)].filter(Boolean).join(" · ")}
                action={copy.removeFromWishlist}
                onPress={() => { void removeWanted(entry.templateId); }}
              />
            ))}
            {wishlist.length > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => { void openCollection("wishlist"); }}>
                <SeoullyText variant="button" color={colors.plum}>{copy.profileSeeAll}</SeoullyText>
              </Pressable>
            ) : null}
          </SeoullyShelf>
        </ScrollView>
      ) : null}
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 120 },
  card: { paddingHorizontal: 16, paddingTop: 18 },
  collectAction: { marginTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  highlights: { gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  shelfAction: { paddingBottom: 8 },
});
