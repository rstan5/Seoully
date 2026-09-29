import { useCallback, useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { useSocialRepository, type SocialShareRecipient } from "../../src/data";
import { shareStatusCopyKey } from "../../src/data/honesty";
import { useCopy, useLocale } from "../../src/locale";
import { colors, radii } from "../../src/theme";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullySearchField, SeoullySearchRow } from "../../src/ui/SeoullySearch";
import { SeoullyText } from "../../src/ui/SeoullyText";

export default function SendToScreen() {
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const social = useSocialRepository();
  const params = useLocalSearchParams<{ postId?: string; caption?: string; handle?: string; displayName?: string; mediaUrl?: string }>();
  const postId = typeof params.postId === "string" ? params.postId : "";
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<SocialShareRecipient[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const previewCaption = useMemo(() => (typeof params.caption === "string" ? params.caption : ""), [params.caption]);
  const previewHandle = typeof params.handle === "string" ? params.handle : "seoully";
  const mediaUrl = typeof params.mediaUrl === "string" ? params.mediaUrl : "";

  const search = useCallback(async (value: string) => {
    setQuery(value);
    setStatus(null);
    setPeople(await social.searchShareRecipients(value));
  }, [social]);

  useFocusEffect(useCallback(() => {
    void social.searchShareRecipients("").then(setPeople);
  }, [social]));

  async function send(peer: SocialShareRecipient) {
    if (!postId || busy) return;
    setBusy(true);
    setStatus(null);
    try {
      if (!social.capabilities.deliverShare) {
        setStatus(copy.sendToBlocked);
        return;
      }
      const body = previewCaption || `@${previewHandle}`;
      const result = await social.sendShare(postId, peer.userId, body);
      setStatus(copy[shareStatusCopyKey(result.delivered)]);
    } catch {
      setStatus(copy.sendToBlocked);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SeoullyScreen>
      <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
      <KeyboardScreen>
        <View style={styles.intro}>
          <SeoullyText variant="title">{copy.sendTo}</SeoullyText>
          <View style={styles.preview}>
            {mediaUrl ? <Image accessibilityIgnoresInvertColors source={{ uri: mediaUrl }} style={styles.thumb} /> : <View style={styles.dot} />}
            <View style={styles.previewCopy}>
              <SeoullyText variant="handle">@{previewHandle}</SeoullyText>
              {previewCaption ? <SeoullyText variant="secondary" numberOfLines={2}>{previewCaption}</SeoullyText> : null}
            </View>
          </View>
          <SeoullySearchField
            value={query}
            placeholder={copy.sendToSearch}
            label={copy.sendToSearch}
            clearLabel={copy.searchClear}
            onChange={(value) => { void search(value); }}
            onSubmit={() => { void search(query); }}
            onClear={() => { void search(""); }}
          />
          {status ? <SeoullyText variant="secondary" color={colors.plum} style={styles.status}>{status}</SeoullyText> : null}
        </View>
        <FlatList
          data={people}
          keyExtractor={(item) => item.userId}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SeoullySearchRow
              title={item.displayName}
              meta={`@${item.handle}`}
              leading={<SeoullyAvatar name={item.displayName} size={44} imageUrl={item.avatarUrl} />}
              onPress={() => { void send(item); }}
            />
          )}
          ListEmptyComponent={<SeoullyEmptyState align="start" body={query.trim() ? copy.sendToNone : copy.sendToEmpty} />}
        />
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  preview: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.card,
    flexDirection: "row",
    gap: 12,
    padding: 10,
  },
  thumb: { borderRadius: 10, height: 56, width: 56 },
  dot: { backgroundColor: colors.lilac, borderRadius: 8, height: 16, width: 16 },
  previewCopy: { flex: 1 },
  status: { marginTop: 2 },
  list: { paddingBottom: 120, paddingHorizontal: 8, paddingTop: 8 },
});
