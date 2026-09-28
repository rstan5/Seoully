import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { loadDirectMessages, sendDirectMessage, type NativeDirectMessage } from "../src/api";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { useCopy } from "../src/locale";
import { colors } from "../src/theme";
import { SeoullyAvatar } from "../src/ui/SeoullyAvatar";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function ThreadScreen() {
  const copy = useCopy();
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string; displayName?: string; handle?: string }>();
  const conversationId = params.conversationId ?? "";
  const [messages, setMessages] = useState<NativeDirectMessage[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async (showLoading = true) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (showLoading) setLoading(true);
    try {
      setMessages(await loadDirectMessages(conversationId));
      setLoadError(null);
    } catch {
      setLoadError(copy.messagesUnavailable);
    } finally {
      if (showLoading) setLoading(false);
      refreshInFlight.current = false;
    }
  }, [conversationId, copy.messagesUnavailable]);
  useFocusEffect(useCallback(() => {
    void refresh();
    const task = setInterval(() => { void refresh(false); }, 10_000);
    return () => clearInterval(task);
  }, [refresh]));

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

  return (
    <SeoullyScreen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.header}>
          <ScreenBack label={copy.back} onPress={() => router.back()} />
          <View style={styles.who}>
            <SeoullyAvatar name={params.displayName ?? copy.collectorFallback} size={36} />
            <View>
              <SeoullyText variant="title">{params.displayName}</SeoullyText>
              {params.handle ? <SeoullyText variant="handle" color={colors.muted}>@{params.handle}</SeoullyText> : null}
            </View>
          </View>
        </View>
        {loading && messages.length === 0 ? <SeoullyLoadingState label={copy.messages} /> : null}
        {loadError ? <View style={styles.notice}><RetryNotice message={loadError} retryLabel={copy.retry} onRetry={() => { void refresh(); }} /></View> : null}
        {error ? <SeoullyText variant="secondary" color={colors.plum} style={styles.error}>{error}</SeoullyText> : null}
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.log}
          refreshing={loading && messages.length > 0}
          onRefresh={() => { void refresh(); }}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
              <SeoullyText variant="body" color={item.mine ? colors.ink : colors.ink}>{item.body}</SeoullyText>
            </View>
          )}
        />
        <View style={styles.composer}>
          <TextInput
            accessibilityLabel={copy.messagePlaceholder}
            placeholder={copy.messagePlaceholder}
            placeholderTextColor={colors.muted}
            value={body}
            onChangeText={setBody}
            multiline
            style={styles.input}
          />
          <Pressable accessibilityRole="button" disabled={!body.trim() || sending} onPress={send} style={styles.send}>
            <SeoullyText variant="button" color={body.trim() ? colors.plum : colors.muted}>{copy.send}</SeoullyText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  who: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 4 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  error: { paddingHorizontal: 16, paddingTop: 8 },
  log: { flexGrow: 1, gap: 8, justifyContent: "flex-end", paddingHorizontal: 16, paddingVertical: 16 },
  bubble: { borderRadius: 16, maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.lilacSoft },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.mist, borderColor: colors.border, borderWidth: 1 },
  composer: {
    alignItems: "flex-end",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  send: { justifyContent: "center", minHeight: 44, paddingHorizontal: 4 },
});
