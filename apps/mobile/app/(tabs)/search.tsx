import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  ensureConversation,
  loadCollectibleDiscovery,
  loadCollectorDiscovery,
  searchCatalog,
  searchCollectors,
  setWishlistTemplate,
  type NativeCatalogTemplate,
  type NativeSearchUser,
  type NativeCollectibleDiscovery,
  type NativeCollectorDiscovery,
} from "../../src/api";
import { collectibleKindLabel } from "../../src/i18n";
import { useCopy } from "../../src/locale";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { RetryNotice } from "../../src/components/RetryNotice";
import { colors, spacing } from "../../src/theme";

const SEARCH_QUERY_KEY = "seoully.mobile.search-query.v1";

export default function SearchScreen() {
  const router = useRouter();
  const copy = useCopy();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NativeCatalogTemplate[] | null>(null);
  const [people, setPeople] = useState<NativeSearchUser[]>([]);
  const [collectors, setCollectors] = useState<NativeCollectorDiscovery[]>([]);
  const [collectibles, setCollectibles] = useState<NativeCollectibleDiscovery[]>([]);
  const [wantedIds, setWantedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExplore = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    setPeople([]);
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

  const runSearch = useCallback(async (nextQuery: string) => {
    const text = nextQuery.trim().slice(0, 120);
    if (!text) return void loadExplore();
    setQuery(text);
    setLoading(true);
    setError(null);
    try {
      const [catalog, users] = await Promise.all([
        searchCatalog(text),
        searchCollectors(text),
      ]);
      setResults(catalog);
      setPeople(users);
      void AsyncStorage.setItem(SEARCH_QUERY_KEY, text);
    } catch {
      setError(copy.catalogUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.catalogUnavailable, loadExplore]);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(SEARCH_QUERY_KEY).then((stored) => {
      if (!active) return;
      if (stored?.trim()) void runSearch(stored);
      else void loadExplore();
    });
    return () => { active = false; };
  }, [loadExplore, runSearch]);

  function clearSearch(value: string) {
    setQuery(value);
    if (!value.trim()) {
      void AsyncStorage.removeItem(SEARCH_QUERY_KEY);
      void loadExplore();
    }
  }

  async function saveWanted(templateId: string) {
    if (wantedIds.has(templateId)) return;
    try {
      await setWishlistTemplate(templateId, true);
      setWantedIds((current) => new Set(current).add(templateId));
    } catch {
      setError(copy.catalogUnavailable);
    }
  }

  async function messageCollector(collector: NativeCollectorDiscovery["collector"]) {
    try {
      const conversationId = await ensureConversation(collector.userId);
      router.push({ pathname: "/thread", params: { conversationId, displayName: collector.displayName, handle: collector.handle } });
    } catch {
      setError(copy.messagesUnavailable);
    }
  }

  return <SafeAreaView style={styles.safe}><KeyboardScreen><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{copy.explore}</Text>
    <Text style={styles.body}>{copy.exploreLead}</Text>
    <View style={styles.searchRow}>
      <TextInput accessibilityLabel={copy.catalogSearchLabel} placeholder={copy.catalogSearchPlaceholder} value={query} onChangeText={clearSearch} onSubmitEditing={() => { void runSearch(query); }} returnKeyType="search" style={styles.input} />
      <Pressable accessibilityRole="button" onPress={() => { void runSearch(query); }} style={styles.searchButton}><Text style={styles.searchButtonText}>{copy.search}</Text></Pressable>
    </View>
    {loading && <ActivityIndicator color={colors.plum} style={styles.loading} />}
    {error && <RetryNotice message={error} retryLabel={copy.retry} onRetry={results ? () => { void runSearch(query); } : loadExplore} />}

    {results ? <>
      <Text style={styles.sectionTitle}>{copy.collectorResults}</Text>
      {people.map((person) => <View key={person.userId} style={styles.result}>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/collector", params: { userId: person.userId } })}><Text style={styles.resultTitle}>{person.displayName}</Text></Pressable>
        <Text style={styles.resultMeta}>@{person.handle}</Text>
        <Pressable accessibilityRole="button" onPress={() => messageCollector({ userId: person.userId, displayName: person.displayName, handle: person.handle })}><Text style={styles.actionText}>{copy.messageCollector}</Text></Pressable>
      </View>)}
      {!loading && people.length === 0 ? <Text style={styles.empty}>{copy.noCollectorMatches}</Text> : null}
      <Text style={styles.sectionTitle}>{copy.catalogResults}</Text>
      {results.map((item) => <View key={item.id} style={styles.result}>
        <Text style={styles.resultTitle}>{item.name}</Text>
        <Text style={styles.resultMeta}>{[item.groupName, item.memberName, item.releaseName, collectibleKindLabel(item.kind, copy)].filter(Boolean).join(" · ")}</Text>
        {item.descriptor ? <Text style={styles.resultDescriptor}>{item.descriptor}</Text> : null}
        <View style={styles.resultActions}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/add", params: { templateId: item.id, name: item.name, kind: item.kind } })}><Text style={styles.actionText}>{copy.addYourCopy}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={wantedIds.has(item.id)} onPress={() => saveWanted(item.id)}><Text style={styles.actionText}>{wantedIds.has(item.id) ? copy.savedToWishlist : copy.saveToWishlist}</Text></Pressable>
        </View>
      </View>)}
      {!loading && results.length === 0 ? <Text style={styles.empty}>{copy.noCatalogMatches}</Text> : null}
    </> : <>
      {collectors.length > 0 ? <><Text style={styles.sectionTitle}>{copy.collectorsForYou}</Text>
        {collectors.map(({ collector, reciprocal, reasons }) => <View key={collector.userId} style={styles.result}>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/collector", params: { userId: collector.userId } })}><Text style={styles.resultTitle}>{collector.displayName}</Text></Pressable>
          <Text style={styles.resultMeta}>@{collector.handle}</Text>
          <Text style={styles.resultDescriptor}>{reciprocal ? copy.mutualMatch : reasonLabel(reasons[0]?.code, copy)}</Text>
          <Pressable accessibilityRole="button" onPress={() => messageCollector(collector)}><Text style={styles.actionText}>{copy.messageCollector}</Text></Pressable>
        </View>)}
      </> : null}
      {collectibles.length > 0 ? <><Text style={styles.sectionTitle}>{copy.collectiblesForYou}</Text>
        {collectibles.map(({ template, reasons }) => <View key={template.id} style={styles.result}>
          <Text style={styles.resultTitle}>{template.name}</Text>
          <Text style={styles.resultMeta}>{collectibleKindLabel(template.kind, copy)}</Text>
          <Text style={styles.resultDescriptor}>{reasonLabel(reasons[0]?.code, copy)}</Text>
          <View style={styles.resultActions}><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/add", params: { templateId: template.id, name: template.name, kind: template.kind } })}><Text style={styles.actionText}>{copy.addYourCopy}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={wantedIds.has(template.id)} onPress={() => saveWanted(template.id)}><Text style={styles.actionText}>{wantedIds.has(template.id) ? copy.savedToWishlist : copy.saveToWishlist}</Text></Pressable>
          </View>
        </View>)}
      </> : null}
      {!loading && !error && collectors.length === 0 && collectibles.length === 0 ? <Text style={styles.empty}>{copy.exploreEmpty}</Text> : null}
    </>}
  </ScrollView></KeyboardScreen></SafeAreaView>;
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
  resultActions: { flexDirection: "row", gap: spacing.lg },
  empty: { color: colors.muted, paddingTop: spacing.lg },
});
