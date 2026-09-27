import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { loadDirectMessages, sendDirectMessage, type NativeDirectMessage } from "../src/api";
import { RetryNotice } from "../src/components/RetryNotice";
import { useCopy } from "../src/locale";
import { colors, spacing } from "../src/theme";

export default function ThreadScreen() {
  const copy = useCopy();
  const params = useLocalSearchParams<{ conversationId?: string; displayName?: string; handle?: string }>();
  const conversationId = params.conversationId ?? "";
  const [messages, setMessages] = useState<NativeDirectMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMessages(await loadDirectMessages(conversationId));
      setLoadError(null);
    } catch {
      setLoadError(copy.messagesUnavailable);
    } finally {
      setLoading(false);
    }
  }, [conversationId, copy.messagesUnavailable]);
  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const message = await sendDirectMessage(conversationId, text);
      setMessages((current) => [...current, message]);
      setBody("");
    } catch {
      setError(copy.messageFailed);
    } finally {
      setSending(false);
    }
  }

  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
    <View style={styles.header}><Text style={styles.title}>{params.displayName}</Text><Text style={styles.handle}>@{params.handle}</Text></View>
    {loading ? <ActivityIndicator color={colors.plum} /> : null}
    {loadError ? <RetryNotice message={loadError} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    <FlatList data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.log} renderItem={({ item }) =>
      <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}><Text style={[styles.message, item.mine && styles.mineText]}>{item.body}</Text></View>
    } />
    <View style={styles.composer}>
      <TextInput accessibilityLabel={copy.messagePlaceholder} placeholder={copy.messagePlaceholder} value={body} onChangeText={setBody} multiline style={styles.input} />
      <Pressable accessibilityRole="button" disabled={!body.trim() || sending} onPress={send} style={styles.send}><Text style={styles.sendText}>{copy.send}</Text></Pressable>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { flex: 1 },
  header: { borderBottomColor: colors.border, borderBottomWidth: 1, padding: spacing.lg },
  title: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  handle: { color: colors.plum, fontSize: 13, marginTop: 2 },
  error: { color: colors.plum, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  log: { flexGrow: 1, gap: spacing.sm, justifyContent: "flex-end", padding: spacing.lg },
  bubble: { borderRadius: 16, maxWidth: "82%", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  mine: { alignSelf: "flex-end", backgroundColor: colors.plum },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
  message: { color: colors.ink, fontSize: 16 },
  mineText: { color: colors.surface },
  composer: { alignItems: "flex-end", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, flex: 1, maxHeight: 120, minHeight: 46, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  send: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", minHeight: 46, paddingHorizontal: spacing.md },
  sendText: { color: colors.surface, fontWeight: "700" },
});
