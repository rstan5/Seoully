import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeCatalogTemplate, NativeSearchUser } from "../api";
import { useSocialRepository } from "../data";
import { useCopy } from "../locale";
import { colors } from "../theme";
import { PhotocardCollectorCount } from "./PhotocardCollectorCount";
import { SeoullyAvatar } from "./SeoullyAvatar";
import { SeoullyButton } from "./SeoullyControls";
import { SeoullyText } from "./SeoullyText";

export type PostTag = { id: string; name: string; subtitle?: string; avatarUrl?: string; imageUrl?: string; kind?: string };
export function PostTagPicker({ kind, selected, onSelect, onClose }: { kind: "collectible" | "collector"; selected: PostTag[]; onSelect: (item: PostTag) => void; onClose: () => void }) {
  const copy = useCopy();
  const social = useSocialRepository();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<PostTag[]>([]);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const task = setTimeout(() => {
      setPending(true); setFailed(false);
      const request = kind === "collectible" ? social.searchCatalog(query).then(results => [...new Map(results.filter(item => ["photocard","album","vinyl","poster","lightstick","plushie","figure","book","apparel","memorabilia"].includes(item.kind)).map(item => [item.id, item])).values()].map((item: NativeCatalogTemplate) => ({ id: item.id, name: item.name, imageUrl: item.imageUrl, kind: item.kind, subtitle: [item.groupName, item.memberName, item.releaseName, item.descriptor].filter(Boolean).join(" · ") }))) :
        social.searchCollectors(query).then(results => results.map((item: NativeSearchUser) => ({ id: item.userId, name: item.displayName, subtitle: item.handle, avatarUrl: item.avatarUrl })));
      void request.then(results => { if (active) setItems(results); }).catch(() => { if (active) { setItems([]); setFailed(true); } }).finally(() => { if (active) setPending(false); });
    }, 180);
    return () => { active = false; clearTimeout(task); };
  }, [kind, query, retry, social]);
  const available = items.filter(item => !selected.some(tag => tag.id === item.id));
  return <Modal animationType="slide" onRequestClose={onClose}>
    <View style={[styles.sheet, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.header}><SeoullyText variant="title">{kind === "collectible" ? copy.tagCollectible : copy.tagCollectors}</SeoullyText><SeoullyButton label={copy.back} variant="ghost" onPress={onClose} /></View>
      <TextInput accessibilityLabel={copy.search} placeholder={copy.search} placeholderTextColor={colors.muted} value={query} maxLength={120} onChangeText={setQuery} style={styles.input} autoFocus />
      <SeoullyText variant="caption">{copy.postTagLimit}</SeoullyText>
      <ScrollView keyboardShouldPersistTaps="handled">
        {pending ? <SeoullyText variant="secondary">{copy.profileCatalogSearching}</SeoullyText> : null}
        {failed ? <SeoullyButton label={copy.retry} variant="ghost" onPress={() => setRetry(value => value + 1)} /> : !pending && !available.length ? <SeoullyText variant="secondary">{copy.postTagEmpty}</SeoullyText> : null}
        {available.map(item => <Pressable key={item.id} accessibilityRole="button" disabled={selected.length >= 10} onPress={() => onSelect(item)} style={styles.result}>
          {kind === "collectible" && item.imageUrl ? <Image accessibilityLabel={item.name} source={{ uri: item.imageUrl }} resizeMode="contain" style={{ width: 44, height: 64, borderRadius: 5 }} /> : null}
          {kind === "collector" ? <SeoullyAvatar name={item.name} imageUrl={item.avatarUrl} /> : null}
          <View style={styles.copy}><SeoullyText variant="handle">{item.name}</SeoullyText>{item.subtitle ? <SeoullyText variant="secondary">{item.subtitle}</SeoullyText> : null}{kind === "collectible" ? <>{!item.imageUrl ? <SeoullyText variant="caption">{copy.catalogNeedsMedia}</SeoullyText> : null}<PhotocardCollectorCount templateId={item.id} kind={item.kind ?? ""} /></> : null}</View>
        </Pressable>)}
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({ sheet: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 16, gap: 14 }, header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, input: { color: colors.ink, backgroundColor: colors.surface, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, fontSize: 16 }, result: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, minHeight: 52 }, copy: { flex: 1 } });
