import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import {
  loadCollectorPosts,
  loadCollectorProfile,
  loadMyHoldings,
  loadMyWishlist,
  loadNativeOnboarding,
  resolveNativeIdentity,
  setWishlistTemplate,
  updateHoldingTradeStatus,
  updateNativeProfile,
  type NativeFeedPost,
  type NativeHolding,
  type NativeIdentity,
  type NativeOnboardingState,
  type NativeWishlistEntry,
} from "../../src/api";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { RetryNotice } from "../../src/components/RetryNotice";
import { collectibleKindLabel } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { supabase } from "../../src/supabase";
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
  const [editing, setEditing] = useState(false);
  const [ownedExpanded, setOwnedExpanded] = useState(false);
  const [wishlistExpanded, setWishlistExpanded] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
      setDisplayName(nextIdentity.user.displayName);
      setTagline(nextIdentity.profile.tagline ?? "");
      setBio(nextIdentity.profile.bio ?? "");
      setLocation(nextIdentity.profile.location ?? "");
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

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateNativeProfile({ displayName, tagline, bio, location });
      setIdentity((current) => current
        ? {
            ...current,
            user: { ...current.user, displayName },
            profile: { ...current.profile, tagline, bio, location },
          }
        : current);
      setMessage(copy.profileSaved);
      setEditing(false);
    } catch {
      setMessage(copy.profileSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setMessage(copy.signOutFailed);
      setBusy(false);
      return;
    }
    router.replace("/");
  }

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

  if (editing) {
    return (
      <SeoullyScreen>
        <KeyboardScreen>
          <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
          <ScrollView contentContainerStyle={styles.edit} keyboardShouldPersistTaps="handled">
            <SeoullyText variant="title">{copy.profileEdit}</SeoullyText>
            <TextInput
              accessibilityLabel={copy.profileDisplayName}
              placeholder={copy.profileDisplayName}
              placeholderTextColor={colors.muted}
              value={displayName}
              onChangeText={setDisplayName}
              style={styles.input}
            />
            <TextInput
              accessibilityLabel={copy.profileTagline}
              placeholder={copy.profileTaglinePlaceholder}
              placeholderTextColor={colors.muted}
              value={tagline}
              onChangeText={setTagline}
              style={styles.input}
            />
            <TextInput
              accessibilityLabel={copy.profileBio}
              placeholder={copy.profileBioPlaceholder}
              placeholderTextColor={colors.muted}
              value={bio}
              onChangeText={setBio}
              multiline
              style={[styles.input, styles.bioInput]}
            />
            <TextInput
              accessibilityLabel={copy.profileLocation}
              placeholder={copy.profileLocationPlaceholder}
              placeholderTextColor={colors.muted}
              value={location}
              onChangeText={setLocation}
              style={styles.input}
            />
            <View style={styles.actions}>
              <SeoullyButton label={copy.saveProfile} disabled={busy} onPress={() => { void save(); }} />
              <SeoullyButton label={copy.back} variant="ghost" disabled={busy} onPress={() => setEditing(false)} />
            </View>
            {message ? <SeoullyText variant="secondary" color={colors.plum}>{message}</SeoullyText> : null}
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/onboarding", params: { edit: "1" } })}>
              <SeoullyText variant="button" color={colors.plum}>{copy.editCollectorTastes}</SeoullyText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void signOut(); }}>
              <SeoullyText variant="button" color={colors.plum}>{copy.signOut}</SeoullyText>
            </Pressable>
          </ScrollView>
        </KeyboardScreen>
      </SeoullyScreen>
    );
  }

  return (
    <SeoullyScreen>
      <KeyboardScreen>
        <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
        {loading && !identity ? <SeoullyLoadingState label={copy.profile} /> : null}
        {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}
        {identity ? (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.card}>
              <SeoullyProfileHead
                name={identity.user.displayName}
                handle={identity.user.handle}
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
              <View style={styles.actions}>
                <SeoullyButton label={copy.profileEdit} onPress={() => setEditing(true)} />
                <SeoullyButton label={copy.profileAddToCollection} variant="ghost" onPress={() => router.push("/add")} />
                <SeoullyButton label={copy.signOut} variant="ghost" disabled={busy} onPress={() => { void signOut(); }} />
              </View>
              <SeoullyButton label={copy.viewCollectorRoom} variant="enter" onPress={() => router.push("/room")} />
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
              {holdings.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={() => { void openCollection("collection"); }}>
                  <SeoullyText variant="button" color={colors.plum}>{copy.profileSeeAll}</SeoullyText>
                </Pressable>
              ) : null}
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
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 120 },
  card: { paddingHorizontal: 16, paddingTop: 18 },
  actions: { flexDirection: "row", gap: 8, marginTop: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  highlights: { gap: 12, paddingHorizontal: 16, paddingTop: 16 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  edit: { gap: 14, paddingBottom: 120, paddingHorizontal: 16, paddingTop: 18 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  bioInput: { minHeight: 110, paddingTop: 12, textAlignVertical: "top" },
  shelfAction: { paddingBottom: 8 },
});
