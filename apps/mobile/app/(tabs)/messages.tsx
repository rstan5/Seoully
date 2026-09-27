import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { loadConversations, type NativeConversation } from "../../src/api";
import { useCopy } from "../../src/locale";
import { colors, spacing } from "../../src/theme";

export default function MessagesScreen() {
  const copy = useCopy();
  const router = useRouter();
  const [conversations, setConversations] = useState<NativeConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    void loadConversations()
      .then((items) => { if (active) { setConversations(items); setError(null); } })
      .catch(() => { if (active) setError(copy.messagesUnavailable); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.messagesUnavailable]));
  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <Text style={styles.title}>{copy.messages}</Text>
    <Text style={styles.body}>{copy.messagesLead}</Text>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <FlatList data={conversations} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) =>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/thread", params: { conversationId: item.id, displayName: item.peer.displayName, handle: item.peer.handle } })} style={styles.conversation}>
        <Text style={styles.name}>{item.peer.displayName}</Text>
        <Text style={styles.handle}>@{item.peer.handle}</Text>
        <Text numberOfLines={1} style={styles.preview}>{item.lastMessage?.body ?? copy.newConversation}</Text>
      </Pressable>
    } ListEmptyComponent={!loading && !error ? <Text style={styles.empty}>{copy.messagesEmpty}</Text> : null} />
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, padding: spacing.lg },
  title: { color: colors.ink, fontSize: 32, fontWeight: "700" },
  body: { color: colors.muted, fontSize: 16, marginTop: spacing.md },
  loading: { marginTop: spacing.lg },
  error: { color: colors.plum, marginTop: spacing.md },
  list: { gap: spacing.sm, paddingBottom: 120, paddingTop: spacing.lg },
  conversation: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, padding: spacing.md },
  name: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  handle: { color: colors.plum, fontSize: 13, marginTop: 2 },
  preview: { color: colors.muted, marginTop: spacing.sm },
  empty: { color: colors.muted, marginTop: spacing.lg },
});
