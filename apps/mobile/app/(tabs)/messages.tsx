import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, StyleSheet, View } from "react-native";
import { conversationPreview } from "../../src/comms";
import { useSocialRepository, type SocialConversation, type SocialShareRecipient } from "../../src/data";
import { useReportAskSurface } from "../../src/ask-surface";
import { useCopy, useLocale } from "../../src/locale";
import { colors } from "../../src/theme";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullySearchField, SeoullySearchRow } from "../../src/ui/SeoullySearch";
import { SeoullyText } from "../../src/ui/SeoullyText";

function formatWhen(value: string, locale: "en" | "ko") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
}

type InboxRow =
  | { kind: "person"; person: SocialShareRecipient }
  | { kind: "conversation"; conversation: SocialConversation };

export default function MessagesScreen() {
  const copy = useCopy();
  const { locale, toggleLocale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const [conversations, setConversations] = useState<SocialConversation[]>([]);
  const [people, setPeople] = useState<SocialShareRecipient[]>([]);
  const [query, setQuery] = useState("");
  const persist = social.capabilities.persistMessages;
  useReportAskSurface({ surface: "messages" });

  const refresh = useCallback(async () => {
    if (!persist) {
      setConversations([]);
      return;
    }
    setConversations(await social.loadConversations());
  }, [persist, social]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  async function search(value: string) {
    setQuery(value);
    if (!persist) return;
    setPeople(value.trim() ? await social.searchShareRecipients(value) : []);
  }

  function openPeer(userId: string, displayName: string, handle: string, conversationId?: string) {
    router.push({
      pathname: "/thread",
      params: { userId, displayName, handle, ...(conversationId ? { conversationId } : {}) },
    });
  }

  const showingPeople = query.trim().length > 0;
  const labels = { empty: copy.newConversation, sharedPost: copy.threadSharedPost, sharedCollectible: copy.threadSharedCollectible };
  const rows: InboxRow[] = showingPeople
    ? people.map((person) => ({ kind: "person", person }))
    : conversations.map((conversation) => ({ kind: "conversation", conversation }));

  return (
    <SeoullyScreen>
      <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
      <View style={styles.intro}>
        <SeoullyText variant="title">{copy.messages}</SeoullyText>
        {persist ? (
          <SeoullySearchField
            value={query}
            placeholder={copy.messagesSearch}
            label={copy.messagesSearch}
            clearLabel={copy.searchClear}
            onChange={(value) => { void search(value); }}
            onSubmit={() => { void search(query); }}
            onClear={() => { void search(""); }}
          />
        ) : (
          <SeoullyText variant="secondary" style={styles.lead}>{copy.messagesUnavailable}</SeoullyText>
        )}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.kind === "person" ? item.person.userId : item.conversation.id}
        contentContainerStyle={styles.list}
        onRefresh={persist ? refresh : undefined}
        refreshing={false}
        renderItem={({ item }) => {
          if (item.kind === "person") {
            return (
              <SeoullySearchRow
                title={item.person.displayName}
                meta={`@${item.person.handle}`}
                leading={<SeoullyAvatar name={item.person.displayName} size={44} imageUrl={item.person.avatarUrl} />}
                onPress={() => openPeer(item.person.userId, item.person.displayName, item.person.handle)}
              />
            );
          }
          const conversation = item.conversation;
          const preview = conversationPreview({
            body: conversation.lastMessage?.body ?? "",
            hasPost: Boolean(conversation.lastMessage?.postId),
            hasCollectibles: (conversation.lastMessage?.templateCount ?? 0) > 0,
          }, labels);
          return (
            <SeoullySearchRow
              title={conversation.peer.displayName}
              meta={`${preview}${conversation.lastMessage ? ` · ${formatWhen(conversation.lastMessage.createdAt, locale)}` : ""}`}
              leading={<SeoullyAvatar name={conversation.peer.displayName} size={44} imageUrl={conversation.peer.avatarUrl} />}
              trailing={conversation.unread ? <View style={styles.unread} /> : undefined}
              onPress={() => openPeer(conversation.peer.userId, conversation.peer.displayName, conversation.peer.handle, conversation.id)}
            />
          );
        }}
        ListEmptyComponent={(
          <SeoullyEmptyState
            align="start"
            body={!persist ? copy.messagesUnavailable : showingPeople ? copy.sendToNone : copy.messagesEmpty}
          />
        )}
      />
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  lead: { marginTop: 2, maxWidth: 320 },
  list: { paddingBottom: 120, paddingHorizontal: 8, paddingTop: 8 },
  unread: { backgroundColor: colors.plum, borderRadius: 5, height: 10, width: 10 },
});
