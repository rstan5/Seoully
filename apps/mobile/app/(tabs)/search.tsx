import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  loadCollectibleDiscovery,
  loadCollectorDiscovery,
  searchCatalog,
  type NativeCatalogTemplate,
  type NativeCollectibleDiscovery,
  type NativeCollectorDiscovery,
} from "../../src/api";
import { useCopy } from "../../src/locale";
import { colors, spacing } from "../../src/theme";

export default function SearchScreen() {
  const router = useRouter();
  const copy = useCopy();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NativeCatalogTemplate[] | null>(null);
  const [collectors, setCollectors] = useState<NativeCollectorDiscovery[]>([]);
  const [collectibles, setCollectibles] = useState<NativeCollectibleDiscovery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExplore = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const [nextCollectors, nextCollectibles] = await Promise.all([
        loadCollectorDiscovery(),
        loadCollectibleDiscovery(),
      ]);
      setCollectors(nextCollectors);
      setCollectibles(nextCollectibles);
    } catch {
      setError(copy.exploreUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.exploreUnavailable]);

  useEffect(() => {
    let active = true;
    void Promise.all([loadCollectorDiscovery(), loadCollectibleDiscovery()])
      .then(([nextCollectors, nextCollectibles]) => {
        if (!active) return;
        setCollectors(nextCollectors);
        setCollectibles(nextCollectibles);
      })
      .catch(() => {
        if (active) setError(copy.exploreUnavailable);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [copy.exploreUnavailable]);

  async function runSearch() {
    if (!query.trim()) return void loadExplore();
    setLoading(true);
    setError(null);
    try {
      setResults(await searchCatalog(query));
    } catch {
      setError(copy.catalogUnavailable);
    } finally {
      setLoading(false);
    }
  }

  function clearSearch(value: string) {
    setQuery(value);
    if (!value.trim()) void loadExplore();
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{copy.explore}</Text>
    <Text style={styles.body}>{copy.exploreLead}</Text>
    <View style={styles.searchRow}>
      <TextInput accessibilityLabel={copy.catalogSearchLabel} placeholder={copy.catalogSearchPlaceholder} value={query} onChangeText={clearSearch} onSubmitEditing={runSearch} returnKeyType="search" style={styles.input} />
      <Pressable accessibilityRole="button" onPress={runSearch} style={styles.searchButton}><Text style={styles.searchButtonText}>{copy.search}</Text></Pressable>
    </View>
    {loading && <ActivityIndicator color={colors.plum} style={styles.loading} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}

    {results ? <>
      <Text style={styles.sectionTitle}>{copy.catalogResults}</Text>
      {results.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/add", params: { templateId: item.id, name: item.name, kind: item.kind } })} style={styles.result}>
        <Text style={styles.resultTitle}>{item.name}</Text>
        <Text style={styles.resultMeta}>{[item.groupName, item.memberName, item.releaseName, item.kind].filter(Boolean).join(" · ")}</Text>
        {item.descriptor ? <Text style={styles.resultDescriptor}>{item.descriptor}</Text> : null}
        <Text style={styles.actionText}>{copy.addYourCopy}</Text>
      </Pressable>)}
      {!loading && results.length === 0 ? <Text style={styles.empty}>{copy.noCatalogMatches}</Text> : null}
    </> : <>
      {collectors.length > 0 ? <><Text style={styles.sectionTitle}>{copy.collectorsForYou}</Text>
        {collectors.map(({ collector, reciprocal, reasons }) => <View key={collector.userId} style={styles.result}>
          <Text style={styles.resultTitle}>{collector.displayName}</Text>
          <Text style={styles.resultMeta}>@{collector.handle}</Text>
          <Text style={styles.resultDescriptor}>{reciprocal ? copy.mutualMatch : reasonLabel(reasons[0]?.code, copy)}</Text>
        </View>)}
      </> : null}
      {collectibles.length > 0 ? <><Text style={styles.sectionTitle}>{copy.collectiblesForYou}</Text>
        {collectibles.map(({ template, reasons }) => <Pressable key={template.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/add", params: { templateId: template.id, name: template.name, kind: template.kind } })} style={styles.result}>
          <Text style={styles.resultTitle}>{template.name}</Text>
          <Text style={styles.resultMeta}>{template.kind}</Text>
          <Text style={styles.resultDescriptor}>{reasonLabel(reasons[0]?.code, copy)}</Text>
          <Text style={styles.actionText}>{copy.addYourCopy}</Text>
        </Pressable>)}
      </> : null}
      {!loading && !error && collectors.length === 0 && collectibles.length === 0 ? <Text style={styles.empty}>{copy.exploreEmpty}</Text> : null}
    </>}
  </ScrollView></SafeAreaView>;
}

type SearchCopy = ReturnType<typeof useCopy>;
function reasonLabel(code: string | undefined, copy: SearchCopy) {
  const normalized = code?.toLowerCase();
  if (normalized?.includes("wishlist")) return copy.basedOnWishlist;
  if (normalized?.includes("bias")) return copy.basedOnBias;
  if (normalized?.includes("group")) return copy.basedOnGroups;
  return copy.recommendedForYou;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { padding: spacing.lg, paddingBottom: 120 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 16, marginTop: spacing.md },
  searchRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginTop: spacing.lg },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, flex: 1, minHeight: 50, paddingHorizontal: spacing.md },
  searchButton: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", minHeight: 50, paddingHorizontal: spacing.md },
  searchButtonText: { color: colors.surface, fontWeight: "700" },
  loading: { marginTop: spacing.md },
  error: { color: colors.plum, marginTop: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "700", marginBottom: spacing.sm, marginTop: spacing.xl },
  result: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md },
  resultTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  resultMeta: { color: colors.plum, fontSize: 13, marginTop: spacing.xs },
  resultDescriptor: { color: colors.muted, fontSize: 13, marginTop: spacing.xs },
  actionText: { color: colors.plum, fontSize: 13, fontWeight: "700", marginTop: spacing.sm },
  empty: { color: colors.muted, paddingTop: spacing.lg },
});
