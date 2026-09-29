import { useCallback, useMemo, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ScreenBack } from "../src/components/ScreenBack";
import { messageHasSendableContext } from "../src/comms";
import { useSocialRepository, type SocialMessage } from "../src/data";
import { useReportAskSurface } from "../src/ask-surface";
import { useCopy } from "../src/locale";
import { colors, radii } from "../src/theme";
import { SeoullyAvatar } from "../src/ui/SeoullyAvatar";
import { SeoullyButton } from "../src/ui/SeoullyControls";
import { SeoullyEmptyState } from "../src/ui/SeoullyEmptyState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export default function ThreadScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const params = useLocalSearchParams<{
    conversationId?: string;
    userId?: string;
    displayName?: string;
    handle?: string;
    postId?: string;
    caption?: string;
    mediaUrl?: string;
    previewHandle?: string;
    templateIds?: string;
    trade?: string;
  }>();
  const peerUserId = typeof params.userId === "string" ? params.userId : "";
  const attachedIds = useMemo(
    () => (typeof params.templateIds === "string" ? params.templateIds.split(",").map((id) => id.trim()).filter(Boolean) : []),
    [params.templateIds],
  );
  const [conversationId, setConversationId] = useState(typeof params.conversationId === "string" ? params.conversationId : "");
  const [items, setItems] = useState<SocialMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sentPost, setSentPost] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const persist = social.capabilities.persistMessages;
  const pendingPost = !sentPost && typeof params.postId === "string" ? params.postId : "";
  useReportAskSurface({
    surface: "conversation",
    ...(conversationId ? { conversationId } : {}),
    ...(peerUserId ? { collectorUserId: peerUserId } : {}),
    ...(typeof params.handle === "string" ? { collectorHandle: params.handle } : {}),
  });

  const refresh = useCallback(async () => {
    if (!persist || !conversationId) {
      setItems([]);
      return;
    }
    const next = await social.loadMessages(conversationId);
    setItems(next);
    await social.markConversationRead(conversationId);
  }, [conversationId, persist, social]);

  useFocusEffect(useCallback(() => {
    setSentPost(false);
    void refresh();
  }, [refresh]));

  async function send() {
    const body = draft.trim();
    if (!persist || busy || !peerUserId) return;
    if (!messageHasSendableContext({ body, postId: pendingPost || undefined, templateIds: attachedIds })) return;
    setBusy(true);
    setError(null);
    try {
      const created = await social.sendMessage({
        ...(conversationId ? { conversationId } : {}),
        peerUserId,
        body,
        ...(pendingPost ? { postId: pendingPost } : {}),
        ...(attachedIds.length ? { templateIds: attachedIds } : {}),
      });
      setConversationId(created.conversationId);
      setDraft("");
      if (pendingPost) setSentPost(true);
      const next = await social.loadMessages(created.conversationId);
      setItems(next);
      await social.markConversationRead(created.conversationId);
    } catch {
      setError(copy.messageFailed);
    } finally {
      setBusy(false);
    }
  }

  const canSend = persist && !busy && messageHasSendableContext({
    body: draft,
    postId: pendingPost || undefined,
    templateIds: attachedIds,
  });

  return (
    <SeoullyScreen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.header}>
          <ScreenBack label={copy.back} onPress={() => router.back()} />
          <View style={styles.who}>
            <SeoullyAvatar name={params.displayName ?? copy.collectorFallback} size={36} />
            <View>
              <SeoullyText variant="handle">{params.displayName}</SeoullyText>
              {params.handle ? <SeoullyText variant="caption" color={colors.muted}>@{params.handle}</SeoullyText> : null}
            </View>
          </View>
        </View>
        {!persist ? <SeoullyEmptyState body={copy.messagesUnavailable} /> : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.log}
            renderItem={({ item }) => (
              <View style={[styles.row, item.mine && styles.mineRow]}>
                <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
                  {item.body ? (
                    <SeoullyText variant="body" color={item.mine ? colors.onPrimary : colors.ink}>{item.body}</SeoullyText>
                  ) : null}
                  {item.post ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: "/collector", params: { userId: item.post!.authorUserId } })}
                      style={styles.card}
                    >
                      {item.post.mediaUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: item.post.mediaUrl }} style={styles.thumb} /> : <View style={styles.dot} />}
                      <View style={styles.cardCopy}>
                        <SeoullyText variant="handle" color={item.mine ? colors.onPrimary : colors.ink}>@{item.post.authorHandle}</SeoullyText>
                        <SeoullyText variant="caption" color={item.mine ? colors.onPrimary : colors.muted} numberOfLines={2}>{item.post.caption}</SeoullyText>
                      </View>
                    </Pressable>
                  ) : null}
                  {item.collectibles.length > 0 ? (
                    <View style={styles.chips}>
                      {item.collectibles.map((collectible) => (
                        <View key={collectible.templateId} style={styles.chip}>
                          <View style={[styles.swatch, { backgroundColor: collectible.colorway?.base ?? colors.pink }]} />
                          <SeoullyText variant="caption" color={item.mine ? colors.onPrimary : colors.ink}>{collectible.name}</SeoullyText>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
                <SeoullyText variant="caption">{formatWhen(item.createdAt)}</SeoullyText>
              </View>
            )}
            ListEmptyComponent={!pendingPost && attachedIds.length === 0 ? <SeoullyEmptyState align="start" body={copy.messagesEmpty} /> : null}
          />
        )}
        {persist ? (
          <View style={styles.compose}>
            {pendingPost ? (
              <View style={styles.attach}>
                {params.mediaUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: String(params.mediaUrl) }} style={styles.thumb} /> : <View style={styles.dot} />}
                <View style={styles.cardCopy}>
                  <SeoullyText variant="handle">@{params.previewHandle ?? params.handle ?? "seoully"}</SeoullyText>
                  {params.caption ? <SeoullyText variant="caption" numberOfLines={2}>{String(params.caption)}</SeoullyText> : null}
                </View>
              </View>
            ) : null}
            {attachedIds.length > 0 ? (
              <View style={styles.attach}>
                <SeoullyText variant="caption">{params.trade === "1" ? copy.compatMessageTrade : copy.threadAttached}</SeoullyText>
              </View>
            ) : null}
            {error ? <SeoullyText variant="caption" color={colors.plum}>{error}</SeoullyText> : null}
            <View style={styles.composeRow}>
              <TextInput
                accessibilityLabel={copy.messagePlaceholder}
                placeholder={pendingPost ? copy.threadAddMessage : attachedIds.length ? copy.threadPlaceholderAbout : copy.messagePlaceholder}
                placeholderTextColor={colors.muted}
                value={draft}
                onChangeText={setDraft}
                style={styles.input}
              />
              <SeoullyButton label={copy.send} disabled={!canSend} onPress={() => { void send(); }} />
            </View>
          </View>
        ) : null}
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
  log: { gap: 10, paddingHorizontal: 16, paddingVertical: 12 },
  row: { alignItems: "flex-start", gap: 4, maxWidth: "86%" },
  mineRow: { alignItems: "flex-end", alignSelf: "flex-end" },
  bubble: {
    backgroundColor: colors.mist,
    borderBottomLeftRadius: 6,
    borderRadius: 18,
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mine: { backgroundColor: colors.plum, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.mist },
  card: { alignItems: "center", flexDirection: "row", gap: 8 },
  cardCopy: { flex: 1, gap: 2 },
  thumb: { borderRadius: 10, height: 48, width: 48 },
  dot: { backgroundColor: colors.lilac, borderRadius: 8, height: 16, width: 16 },
  chips: { gap: 6 },
  chip: { alignItems: "center", flexDirection: "row", gap: 6 },
  swatch: { borderRadius: 9, height: 18, width: 18 },
  compose: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  attach: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: 10,
    padding: 8,
  },
  composeRow: { alignItems: "center", flexDirection: "row", gap: 8 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
