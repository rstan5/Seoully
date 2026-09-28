import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { loadConversations, type NativeConversation } from "../../src/api";
import { RetryNotice } from "../../src/components/RetryNotice";
import { useCopy, useLocale } from "../../src/locale";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyLoadingState } from "../../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullySearchRow } from "../../src/ui/SeoullySearch";
import { SeoullyText } from "../../src/ui/SeoullyText";

export default function MessagesScreen() {
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const router = useRouter();
  const [conversations, setConversations] = useState<NativeConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setConversations(await loadConversations());
      setError(null);
    } catch {
      setError(copy.messagesUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.messagesUnavailable]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <SeoullyScreen>
      <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
      <View style={styles.intro}>
        <SeoullyText variant="title">{copy.messages}</SeoullyText>
        <SeoullyText variant="secondary" style={styles.lead}>{copy.messagesLead}</SeoullyText>
      </View>
      {loading && conversations.length === 0 ? <SeoullyLoadingState label={copy.messages} /> : null}
      {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshing={loading && conversations.length > 0}
        onRefresh={refresh}
        renderItem={({ item }) => (
          <SeoullySearchRow
            title={item.peer.displayName}
            meta={`@${item.peer.handle}${item.lastMessage?.body ? ` · ${item.lastMessage.body}` : ""}`}
            leading={<SeoullyAvatar name={item.peer.displayName} size={40} />}
            onPress={() => router.push({
              pathname: "/thread",
              params: { conversationId: item.id, displayName: item.peer.displayName, handle: item.peer.handle },
            })}
          />
        )}
        ListEmptyComponent={!loading && !error ? <SeoullyEmptyState align="start" body={copy.messagesEmpty} /> : null}
      />
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 16, paddingTop: 12 },
  lead: { marginTop: 6, maxWidth: 320 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  list: { paddingBottom: 120, paddingHorizontal: 8, paddingTop: 8 },
});
