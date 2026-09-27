import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { loadFeed, type NativeFeedPost } from "../../src/api";
import { copy } from "../../src/i18n";
import { colors, spacing } from "../../src/theme";

export default function FeedScreen() {
  const t = copy();
  const [posts, setPosts] = useState<NativeFeedPost[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  useEffect(() => { void loadFeed().then(setPosts).catch(() => setError("Feed is temporarily unavailable.")).finally(() => setLoading(false)); }, []);
  return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.eyebrow}>{t.brand}</Text><Text style={styles.title}>{t.feed}</Text>{loading && <ActivityIndicator color={colors.plum} />}{error && <Text style={styles.body}>{error}</Text>}<FlatList data={posts} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.post}><Text style={styles.author}>{item.author.displayName} · @{item.author.handle}</Text><Text style={styles.caption}>{item.caption || "Shared a Seoully moment."}</Text><Text style={styles.meta}>{item.likeCount} likes · {item.commentCount} comments</Text></View>} ListEmptyComponent={!loading && !error ? <Text style={styles.body}>Your collector community will live here.</Text> : null} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: spacing.lg }, eyebrow: { color: colors.plum, fontSize: 15, fontWeight: "700" }, title: { color: colors.ink, fontSize: 34, fontWeight: "700", marginTop: spacing.xs }, body: { color: colors.muted, fontSize: 16, marginTop: spacing.md }, list: { gap: spacing.sm, paddingVertical: spacing.lg }, post: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: spacing.md }, author: { color: colors.plum, fontWeight: "700" }, caption: { color: colors.ink, fontSize: 16, marginTop: spacing.sm }, meta: { color: colors.muted, fontSize: 13, marginTop: spacing.sm } });
