import { useCallback, useEffect, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import {
  loadMyHoldings,
  loadMyWishlist,
  setWishlistTemplate,
  updateHoldingTradeStatus,
  type NativeHolding,
  type NativeWishlistEntry,
} from "../src/api";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy } from "../src/locale";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { CachedSignedImage } from "../src/media/cachedMedia";
import { colors, spacing } from "../src/theme";

const COLLECTION_TAB_KEY = "seoully.mobile.collection-tab.v1";
type CollectionRow =
  | { kind: "holding"; id: string; holding: NativeHolding }
  | { kind: "wishlist"; id: string; entry: NativeWishlistEntry };

export default function CollectionScreen() {
  const copy = useCopy();
  const router = useRouter();
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
      const [nextHoldings, nextWishlist] = await Promise.all([loadMyHoldings(0, 100), loadMyWishlist(0, 100)]);
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
  }, [copy.collectionUnavailable]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore) return;
    if (tab === "collection") {
      if (!hasMore) return;
      setLoadingMore(true);
      try {
        const page = await loadMyHoldings(holdings.length, 100);
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
      const page = await loadMyWishlist(wishlist.length, 100);
      setWishlist((current) => [...current, ...page.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setHasMoreWishlist(page.length === 100);
    } catch {
      setError(copy.collectionUnavailable);
    } finally {
      setLoadingMore(false);
    }
  }, [copy.collectionUnavailable, hasMore, hasMoreWishlist, holdings.length, loading, loadingMore, tab, wishlist.length]);

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
      const updated = await updateHoldingTradeStatus(holding.id, nextStatus);
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
      await setWishlistTemplate(entry.templateId, false);
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

  return <SafeAreaView style={styles.safe}><FlatList
    data={rows}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.container}
    onEndReached={() => { if (canPage) void loadMore(); }}
    onEndReachedThreshold={0.35}
    ListHeaderComponent={<View>
      <ScreenBack label={copy.back} onPress={() => router.back()} />
      <Text style={styles.title}>{copy.myCollection}</Text>
      <Text style={styles.lead}>{copy.collectionLead}</Text>
      <View style={styles.tabs}>
        <Tab selected={tab === "collection"} label={`${copy.collection} (${holdings.length})`} onPress={() => setTab("collection")} />
        <Tab selected={tab === "wishlist"} label={`${copy.wishlist} (${wishlist.length})`} onPress={() => setTab("wishlist")} />
      </View>
      {tab === "collection" && kinds.length > 1 ? <View style={styles.tabs}>{[["all", copy.allKinds] as const, ...kinds.map((kind) => [kind, collectibleKindLabel(kind, copy)] as const)].map(([id, label]) => <Tab key={id} selected={kindFilter === id} label={label} onPress={() => setKindFilter(id)} />)}</View> : null}
      {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
      {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    </View>}
    ListEmptyComponent={!loading ? <Text style={styles.empty}>{tab === "collection" ? copy.collectionEmpty : copy.wishlistEmpty}</Text> : null}
    ListFooterComponent={canPage || loadingMore ? <Pressable accessibilityRole="button" disabled={loadingMore} onPress={() => { void loadMore(); }} style={styles.action}>
      <Text style={styles.actionText}>{loadingMore ? copy.saving : copy.loadMoreHoldings}</Text>
    </Pressable> : null}
    renderItem={({ item }) => item.kind === "holding"
      ? <HoldingRow busy={busyId === item.holding.id} copy={copy} holding={item.holding} onOpen={() => router.push({ pathname: "/collectible", params: { holdingId: item.holding.id } })} onToggleTrade={() => { void toggleTrade(item.holding); }} />
      : <WishlistRow busy={busyId === item.entry.id} copy={copy} entry={item.entry} onRemove={() => { void removeWanted(item.entry); }} />}
  /></SafeAreaView>;
}

function HoldingRow({
  holding,
  copy,
  busy,
  onOpen,
  onToggleTrade,
}: {
  holding: NativeHolding;
  copy: ReturnType<typeof useCopy>;
  busy: boolean;
  onOpen: () => void;
  onToggleTrade: () => void;
}) {
  return <View style={styles.card}>
    {holding.personalMediaUrl ? <CachedSignedImage cacheKey={holding.id} url={holding.personalMediaUrl} style={styles.image} /> : null}
    <View style={styles.cardBody}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${copy.viewCollectible}: ${holding.template.name}`} onPress={onOpen}>
        <Text style={styles.cardTitle}>{holding.template.name}</Text>
        <Text style={styles.meta}>{[holding.template.groupName, holding.template.memberName, holding.template.releaseName, collectibleKindLabel(holding.template.kind, copy)].filter(Boolean).join(" · ")}</Text>
        <Text style={styles.status}>{holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: holding.tradeStatus === "for-trade", disabled: busy }} disabled={busy} onPress={onToggleTrade} style={styles.action}>
        <Text style={styles.actionText}>{holding.tradeStatus === "for-trade" ? copy.keepInCollection : copy.markForTrade}</Text>
      </Pressable>
    </View>
  </View>;
}

function WishlistRow({
  entry,
  copy,
  busy,
  onRemove,
}: {
  entry: NativeWishlistEntry;
  copy: ReturnType<typeof useCopy>;
  busy: boolean;
  onRemove: () => void;
}) {
  return <View style={styles.cardBodyOnly}>
    <Text style={styles.cardTitle}>{entry.template.name}</Text>
    <Text style={styles.meta}>{[entry.template.groupName, entry.template.memberName, entry.template.releaseName, collectibleKindLabel(entry.template.kind, copy)].filter(Boolean).join(" · ")}</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onRemove} style={styles.action}><Text style={styles.actionText}>{copy.removeFromWishlist}</Text></Pressable>
  </View>;
}

function Tab({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.tab, selected && styles.tabSelected]}>
    <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.lg, paddingBottom: 80 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "700" },
  lead: { color: colors.muted, fontSize: 16, marginTop: spacing.sm },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  tab: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tabSelected: { backgroundColor: colors.plum, borderColor: colors.plum },
  tabText: { color: colors.ink, fontWeight: "700" },
  tabTextSelected: { color: colors.surface },
  loading: { marginTop: spacing.xl },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginTop: spacing.md, overflow: "hidden" },
  image: { aspectRatio: 0.72, width: "100%" },
  cardBody: { padding: spacing.md },
  cardBodyOnly: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginTop: spacing.md, padding: spacing.md },
  cardTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  status: { color: colors.plum, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  action: { alignItems: "center", borderColor: colors.plum, borderRadius: 12, borderWidth: 1, marginTop: spacing.md, minHeight: 44, justifyContent: "center" },
  actionText: { color: colors.plum, fontWeight: "700" },
  empty: { color: colors.muted, marginTop: spacing.xl },
});
