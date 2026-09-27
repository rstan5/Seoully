import { useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { searchCatalog, type NativeCatalogTemplate } from "../../src/api";
import { copy } from "../../src/i18n";
import { colors, spacing } from "../../src/theme";
export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NativeCatalogTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<NativeCatalogTemplate | null>(null);
  const [added, setAdded] = useState(false);
  async function runSearch() {
    setLoading(true); setError(null); setAdded(false);
    try { setResults(await searchCatalog(query)); } catch { setError("Catalog search is temporarily unavailable."); }
    setLoading(false);
  }
  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <Text style={styles.title}>{copy().search}</Text>
    <Text style={styles.body}>Find something collectors have already added.</Text>
    <View style={styles.searchRow}><TextInput accessibilityLabel="Search Seoully catalog" placeholder="Group, member, release..." value={query} onChangeText={setQuery} onSubmitEditing={runSearch} returnKeyType="search" style={styles.input} /><Pressable accessibilityRole="button" onPress={runSearch} style={styles.searchButton}><Text style={styles.searchButtonText}>Search</Text></Pressable></View>
    {loading && <ActivityIndicator color={colors.plum} style={styles.loading} />}
    {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    {selected && <View style={styles.selection}><Text style={styles.selectionTitle}>{selected.name}</Text><Text style={styles.resultMeta}>Add your personal copy to the collection.</Text><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/add", params: { templateId: selected.id, name: selected.name, kind: selected.kind } })} style={styles.addButton}><Text style={styles.searchButtonText}>{added ? "Added to collection" : "Continue"}</Text></Pressable></View>}
    <FlatList data={results} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => setSelected(item)} style={styles.result}><Text style={styles.resultTitle}>{item.name}</Text><Text style={styles.resultMeta}>{[item.groupName, item.memberName, item.releaseName, item.kind].filter(Boolean).join(" · ")}</Text>{item.descriptor ? <Text style={styles.resultDescriptor}>{item.descriptor}</Text> : null}</Pressable>} ListEmptyComponent={!loading && query ? <Text style={styles.empty}>No catalog matches yet.</Text> : null} />
  </View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: spacing.lg }, title: { color: colors.ink, fontSize: 32, fontWeight: "700" }, body: { color: colors.muted, fontSize: 16, marginTop: spacing.md }, searchRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginTop: spacing.lg }, input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, flex: 1, minHeight: 50, paddingHorizontal: spacing.md }, searchButton: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", minHeight: 50, paddingHorizontal: spacing.md }, searchButtonText: { color: colors.surface, fontWeight: "700" }, loading: { marginTop: spacing.md }, error: { color: colors.plum, marginTop: spacing.md }, selection: { backgroundColor: colors.blush, borderRadius: 16, marginTop: spacing.md, padding: spacing.md }, selectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" }, addButton: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 12, justifyContent: "center", marginTop: spacing.sm, minHeight: 46 }, list: { gap: spacing.sm, paddingVertical: spacing.lg }, result: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: spacing.md }, resultTitle: { color: colors.ink, fontSize: 16, fontWeight: "700" }, resultMeta: { color: colors.plum, fontSize: 13, marginTop: spacing.xs }, resultDescriptor: { color: colors.muted, fontSize: 13, marginTop: spacing.xs }, empty: { color: colors.muted, paddingTop: spacing.md } });
