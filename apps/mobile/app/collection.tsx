import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  loadMyHoldings,
  loadMyWishlist,
  setWishlistTemplate,
  updateHoldingTradeStatus,
  type NativeHolding,
  type NativeWishlistEntry,
} from "../src/api";
import { useCopy } from "../src/locale";
import { RetryNotice } from "../src/components/RetryNotice";
import { colors, spacing } from "../src/theme";

export default function CollectionScreen() {
  const copy = useCopy();
  const router = useRouter();
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [wishlist, setWishlist] = useState<NativeWishlistEntry[]>([]);
  const [tab, setTab] = useState<"collection" | "wishlist">("collection");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextHoldings, nextWishlist] = await Promise.all([loadMyHoldings(), loadMyWishlist()]);
      setHoldings(nextHoldings);
      setWishlist(nextWishlist);
      setError(null);
    } catch {
      setError(copy.collectionUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.collectionUnavailable]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

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

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>{copy.myCollection}</Text>
    <Text style={styles.lead}>{copy.collectionLead}</Text>
    <View style={styles.tabs}>
      <Tab selected={tab === "collection"} label={`${copy.collection} (${holdings.length})`} onPress={() => setTab("collection")} />
      <Tab selected={tab === "wishlist"} label={`${copy.wishlist} (${wishlist.length})`} onPress={() => setTab("wishlist")} />
    </View>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {!loading && tab === "collection" ? <>
      {holdings.map((holding) => <View key={holding.id} style={styles.card}>
        {holding.personalMediaUrl ? <Image source={{ uri: holding.personalMediaUrl }} style={styles.image} /> : null}
        <View style={styles.cardBody}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${copy.viewCollectible}: ${holding.template.name}`} onPress={() => router.push({ pathname: "/collectible", params: { holdingId: holding.id } })}>
            <Text style={styles.cardTitle}>{holding.template.name}</Text>
            <Text style={styles.meta}>{[holding.template.groupName, holding.template.memberName, holding.template.releaseName, holding.template.kind].filter(Boolean).join(" · ")}</Text>
            <Text style={styles.status}>{holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: holding.tradeStatus === "for-trade", disabled: busyId === holding.id }} disabled={busyId === holding.id} onPress={() => toggleTrade(holding)} style={styles.action}>
            <Text style={styles.actionText}>{holding.tradeStatus === "for-trade" ? copy.keepInCollection : copy.markForTrade}</Text>
          </Pressable>
        </View>
      </View>)}
      {holdings.length === 0 ? <Text style={styles.empty}>{copy.collectionEmpty}</Text> : null}
    </> : null}
    {!loading && tab === "wishlist" ? <>
      {wishlist.map((entry) => <View key={entry.id} style={styles.cardBodyOnly}>
        <Text style={styles.cardTitle}>{entry.template.name}</Text>
        <Text style={styles.meta}>{[entry.template.groupName, entry.template.memberName, entry.template.releaseName, entry.template.kind].filter(Boolean).join(" · ")}</Text>
        <Pressable accessibilityRole="button" disabled={busyId === entry.id} onPress={() => removeWanted(entry)} style={styles.action}><Text style={styles.actionText}>{copy.removeFromWishlist}</Text></Pressable>
      </View>)}
      {wishlist.length === 0 ? <Text style={styles.empty}>{copy.wishlistEmpty}</Text> : null}
    </> : null}
  </ScrollView></SafeAreaView>;
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
  tabs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  tab: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tabSelected: { backgroundColor: colors.plum, borderColor: colors.plum },
  tabText: { color: colors.ink, fontWeight: "700" },
  tabTextSelected: { color: colors.surface },
  loading: { marginTop: spacing.xl },
  error: { color: colors.plum, marginTop: spacing.md },
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
