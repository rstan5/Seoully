import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import type { NativeConversation } from "../../src/api";
import { useSocialRepository } from "../../src/data";
import { useCopy, useLocale } from "../../src/locale";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullySearchRow } from "../../src/ui/SeoullySearch";
import { SeoullyText } from "../../src/ui/SeoullyText";

export default function MessagesScreen() {
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const [conversations, setConversations] = useState<NativeConversation[]>([]);
  const refresh = useCallback(async () => {
    setConversations([]);
    void social.capabilities.persistMessages;
  }, [social.capabilities.persistMessages]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  return (
    <SeoullyScreen>
      <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
      <View style={styles.intro}>
        <SeoullyText variant="title">{copy.messages}</SeoullyText>
        <SeoullyText variant="secondary" style={styles.lead}>{copy.messagesUnavailable}</SeoullyText>
      </View>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onRefresh={refresh}
        refreshing={false}
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
        ListEmptyComponent={<SeoullyEmptyState align="start" body={copy.messagesUnavailable} />}
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
