import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadMyHoldings, updateHoldingTradeStatus, type NativeHolding } from "../src/api";
import { RetryNotice } from "../src/components/RetryNotice";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy, useLocale } from "../src/locale";
import { colors, spacing } from "../src/theme";

export default function CollectibleDetailScreen() {
  const copy = useCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const { holdingId = "" } = useLocalSearchParams<{ holdingId?: string }>();
  const [holding, setHolding] = useState<NativeHolding | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const item = (await loadMyHoldings()).find((candidate) => candidate.id === holdingId) ?? null;
      setHolding(item);
      setError(item ? null : copy.collectibleUnavailable);
    } catch {
      setError(copy.collectibleUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.collectibleUnavailable, holdingId]);
  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  async function toggleTrade() {
    if (!holding || busy) return;
    setBusy(true);
    try {
      setHolding(await updateHoldingTradeStatus(holding.id, holding.tradeStatus === "for-trade" ? "not-for-trade" : "for-trade"));
      setError(null);
    } catch {
      setError(copy.collectionUnavailable);
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>{copy.back}</Text></Pressable>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {holding ? <>
      {holding.personalMediaUrl ? <Image accessibilityLabel={copy.personalPreview} resizeMode="contain" source={{ uri: holding.personalMediaUrl }} style={styles.image} /> : <View style={styles.fallback}><Text style={styles.fallbackText}>{holding.template.name}</Text></View>}
      <Text style={styles.kind}>{collectibleKindLabel(holding.template.kind, copy)}</Text>
      <Text style={styles.title}>{holding.template.name}</Text>
      <Text style={styles.meta}>{[holding.template.groupName, holding.template.memberName, holding.template.releaseName].filter(Boolean).join(" · ")}</Text>
      {holding.template.descriptor ? <Text style={styles.descriptor}>{holding.template.descriptor}</Text> : null}
      <View style={styles.statusRow}><Text style={styles.status}>{holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}</Text><Text style={styles.acquired}>{copy.acquired} {new Date(holding.acquiredAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}</Text></View>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: holding.tradeStatus === "for-trade", disabled: busy }} disabled={busy} onPress={toggleTrade} style={styles.primary}><Text style={styles.primaryText}>{holding.tradeStatus === "for-trade" ? copy.keepInCollection : copy.markForTrade}</Text></Pressable>
      <View style={styles.destinations}><Pressable accessibilityRole="button" onPress={() => router.push("/room")} style={styles.destination}><Text style={styles.destinationText}>{copy.viewRoom}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/binder")} style={styles.destination}><Text style={styles.destinationText}>{copy.viewBinder}</Text></Pressable></View>
    </> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.lg, paddingBottom: 80 },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  backText: { color: colors.plum, fontWeight: "700" },
  loading: { marginTop: spacing.xl },
  image: { alignSelf: "center", aspectRatio: 55 / 85, maxHeight: 500, width: "82%" },
  fallback: { alignItems: "center", alignSelf: "center", aspectRatio: 55 / 85, backgroundColor: colors.blush, borderRadius: 18, justifyContent: "center", padding: spacing.lg, width: "82%" },
  fallbackText: { color: colors.ink, fontSize: 22, fontWeight: "700", textAlign: "center" },
  kind: { color: colors.plum, fontSize: 12, fontWeight: "700", marginTop: spacing.lg, textTransform: "uppercase" },
  title: { color: colors.ink, fontSize: 28, fontWeight: "700", marginTop: spacing.xs },
  meta: { color: colors.muted, fontSize: 15, marginTop: spacing.xs },
  descriptor: { color: colors.ink, fontSize: 16, lineHeight: 23, marginTop: spacing.md },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  status: { color: colors.plum, fontWeight: "700" },
  acquired: { color: colors.muted },
  primary: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", marginTop: spacing.lg, minHeight: 52 },
  primaryText: { color: colors.surface, fontWeight: "700" },
  destinations: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  destination: { alignItems: "center", borderColor: colors.plum, borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 },
  destinationText: { color: colors.plum, fontWeight: "700" },
});
