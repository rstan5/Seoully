import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import { useSocialRepository } from "../src/data";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy } from "../src/locale";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { colors } from "../src/theme";
import { SeoullyChoiceChip } from "../src/ui/SeoullyControls";
import { SeoullyEmptyState } from "../src/ui/SeoullyEmptyState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyShelfRow } from "../src/ui/SeoullyProfile";
import { SeoullyText } from "../src/ui/SeoullyText";
import type { NativeHolding, NativeWishlistEntry } from "../src/api";

const COLLECTION_TAB_KEY = "seoully.mobile.collection-tab.v1";
type CollectionRow =
  | { kind: "holding"; id: string; holding: NativeHolding }
  | { kind: "wishlist"; id: string; entry: NativeWishlistEntry };

export default function CollectionScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [wishlist, setWishlist] = useState<NativeWishlistEntry[]>([]);
  const [tab, setTab] = useState<"collection" | "wishlist">("collection");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tabReady, setTabReady] = useState(false);
  const [kindFilter, setKindFilter] = useState("all");
  const [hasMore, setHasMore] = useState(false);
  const [hasMoreWishlist, setHasMoreWishlist] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHoldings, nextWishlist] = await Promise.all([
        social.loadMyHoldings(0, 100),
        social.loadMyWishlist(0, 100),
      ]);
      setHoldings(nextHoldings);
      setHasMore(nextHoldings.length === 100);
      setWishlist(nextWishlist);
      setHasMoreWishlist(nextWishlist.length === 100);
      setError(null);
    } catch {
      setError(copy.collectionUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.collectionUnavailable, social]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (tab === "collection") {
      if (!hasMore) return;
      setLoadingMore(true);
      try {
        const page = await social.loadMyHoldings(holdings.length, 100);
        setHoldings((current) => [...current, ...page.filter((item) => !current.some((existing) => existing.id === item.id))]);
        setHasMore(page.length === 100);
      } catch {
        setError(copy.collectionUnavailable);
      } finally {
        setLoadingMore(false);
      }
      return;
    }
    if (!hasMoreWishlist) return;
    setLoadingMore(true);
    try {
      const page = await social.loadMyWishlist(wishlist.length, 100);
      setWishlist((current) => [...current, ...page.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setHasMoreWishlist(page.length === 100);
    } catch {
      setError(copy.collectionUnavailable);
    } finally {
      setLoadingMore(false);
    }
  }, [copy.collectionUnavailable, hasMore, hasMoreWishlist, holdings.length, loading, loadingMore, social, tab, wishlist.length]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));
  useEffect(() => {
    const task = setTimeout(() => {
      void AsyncStorage.getItem(COLLECTION_TAB_KEY).then((stored) => {
        if (stored === "collection" || stored === "wishlist") setTab(stored);
        setTabReady(true);
      });
    }, 0);
    return () => clearTimeout(task);
  }, []);
  useEffect(() => {
    if (tabReady) void AsyncStorage.setItem(COLLECTION_TAB_KEY, tab);
  }, [tab, tabReady]);

  async function toggleTrade(holding: NativeHolding) {
    const nextStatus = holding.tradeStatus === "for-trade" ? "not-for-trade" : "for-trade";
    setBusyId(holding.id);
    try {
      const updated = await social.setHoldingTradeStatus(holding.id, nextStatus);
      setHoldings((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      setError(copy.collectionUnavailable);
    } finally {
      setBusyId(null);
    }
  }

  async function removeWanted(entry: NativeWishlistEntry) {
    setBusyId(entry.id);
    try {
      await social.setWishlist(entry.templateId, false);
      setWishlist((current) => current.filter((item) => item.id !== entry.id));
    } catch {
      setError(copy.collectionUnavailable);
    } finally {
      setBusyId(null);
    }
  }

  const kinds = [...new Set(holdings.map((holding) => holding.template.kind))];
  const rows: CollectionRow[] = tab === "collection"
    ? holdings.filter((holding) => kindFilter === "all" || holding.template.kind === kindFilter).map((holding) => ({ kind: "holding", id: holding.id, holding }))
    : wishlist.map((entry) => ({ kind: "wishlist", id: entry.id, entry }));
  const canPage = tab === "collection" ? hasMore : hasMoreWishlist;

  return (
    <SeoullyScreen>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.container}
        onEndReached={() => { if (canPage) void loadMore(); }}
        onEndReachedThreshold={0.35}
        ListHeaderComponent={(
          <View>
            <ScreenBack label={copy.back} onPress={() => router.back()} />
            <SeoullyText variant="title" style={styles.title}>
              {tab === "collection" ? copy.profileOwned : copy.profileWishlistTitle}
            </SeoullyText>
            <SeoullyText variant="secondary" style={styles.lead}>{copy.collectionLead}</SeoullyText>
            <View style={styles.tabs}>
              <SeoullyChoiceChip
                selected={tab === "collection"}
                label={`${copy.profileOwned} ${holdings.length}`}
                onPress={() => setTab("collection")}
              />
              <SeoullyChoiceChip
                selected={tab === "wishlist"}
                label={`${copy.profileWishlistTitle} ${wishlist.length}`}
                onPress={() => setTab("wishlist")}
              />
            </View>
            {tab === "collection" && kinds.length > 1 ? (
              <View style={styles.tabs}>
                {([["all", copy.allKinds] as const, ...kinds.map((kind) => [kind, collectibleKindLabel(kind, copy)] as const)]).map(([id, label]) => (
                  <SeoullyChoiceChip key={id} selected={kindFilter === id} label={label} onPress={() => setKindFilter(id)} />
                ))}
              </View>
            ) : null}
            {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
            {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? <SeoullyEmptyState align="start" body={tab === "collection" ? copy.collectionEmpty : copy.wishlistEmpty} /> : null}
        ListFooterComponent={canPage || loadingMore ? (
          <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { void loadMore(); }} style={styles.more}>
            <SeoullyText variant="button" color={colors.plum}>{loadingMore ? copy.saving : copy.loadMoreHoldings}</SeoullyText>
          </Pressable>
        ) : null}
        renderItem={({ item }) => item.kind === "holding" ? (
          <View style={styles.row}>
            <SeoullyShelfRow
              title={item.holding.template.name}
              meta={[item.holding.template.groupName, item.holding.template.memberName, item.holding.template.releaseName, collectibleKindLabel(item.holding.template.kind, copy)].filter(Boolean).join(" · ")}
              imageUrl={item.holding.personalMediaUrl}
              onPress={() => router.push({ pathname: "/collectible", params: { holdingId: item.holding.id } })}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: item.holding.tradeStatus === "for-trade", disabled: busyId === item.holding.id }}
              disabled={busyId === item.holding.id}
              onPress={() => { void toggleTrade(item.holding); }}
              style={styles.action}
            >
              <SeoullyText variant="caption" color={colors.plum}>
                {item.holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}
              </SeoullyText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.row}>
            <SeoullyShelfRow
              title={item.entry.template.name}
              meta={[item.entry.template.groupName, item.entry.template.memberName, item.entry.template.releaseName, collectibleKindLabel(item.entry.template.kind, copy)].filter(Boolean).join(" · ")}
              action={copy.removeFromWishlist}
              onPress={() => { void removeWanted(item.entry); }}
            />
          </View>
        )}
      />
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, paddingHorizontal: 16 },
  title: { marginTop: 8 },
  lead: { marginTop: 6, maxWidth: 320 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  loading: { marginTop: 24 },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  action: {
    alignSelf: "flex-end",
    backgroundColor: colors.lilacSoft,
    borderRadius: 999,
    marginBottom: 10,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  more: { alignItems: "center", justifyContent: "center", minHeight: 44, marginTop: 12 },
});
