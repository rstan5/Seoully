import { PhotocardCollectorCount } from "../ui/PhotocardCollectorCount";
import { roomMessageStyles } from "./RoomMessage";
import { roomChromeSurface, type RoomChrome } from "./theme";
import { Modal, TextInput, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeHolding } from "../api";
import { collectibleKindLabel, type MobileCopy } from "../i18n";
import { filterStoredHoldings } from "./storedHoldings";
import { representationForHolding } from "./representation";
import { CachedSignedImage } from "../media/cachedMedia";
import { spacing } from "../theme";
import { chrome } from "../ui/shellLayout";
import { SeoullyText } from "../ui/SeoullyText";

export function StoredCollectionSheet({
  roomChrome,
  visible,
  holdings,
  query,
  editing,
  reducedMotion,
  copy,
  bottomInset,
  onChangeQuery,
  onClose,
  onInspect,
  onPlace,
  onBinder,
  onEditToPlace,
}: {
  roomChrome: RoomChrome;
  visible: boolean;
  holdings: NativeHolding[];
  query: string;
  editing: boolean;
  reducedMotion: boolean;
  copy: MobileCopy;
  bottomInset: number;
  onChangeQuery: (value: string) => void;
  onClose: () => void;
  onInspect?: (holdingId: string) => void;
  onPlace?: (holding: NativeHolding) => void;
  onBinder?: (holding: NativeHolding) => void;
  onEditToPlace?: () => void;
}) {
  const matches = filterStoredHoldings(holdings, query);
  return <Modal
    animationType={reducedMotion ? "none" : "slide"}
    onRequestClose={onClose}
    transparent
    visible={visible}
  >
    <View style={styles.frame}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.dismiss} />
      <View style={[styles.sheet, roomChromeSurface(roomChrome), { paddingBottom: bottomInset + chrome.companionSize + chrome.companionClearance }]}>
        <View style={[styles.header, roomMessageStyles.sheetHeader]}>
          <SeoullyText color={roomChrome.color} variant="handle" style={styles.title}>{copy.storedCollection}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close} hitSlop={8}>
            <SeoullyText variant="button" color={roomChrome.color}>{copy.close}</SeoullyText>
          </Pressable>
        </View>
        <View style={styles.search}>
          <View style={styles.searchRow}>
            <TextInput accessibilityLabel={copy.storedSearch} value={query} placeholder={copy.storedSearchPlaceholder}
              placeholderTextColor={roomChrome.color} selectionColor={roomChrome.color}
              autoCorrect={false} autoCapitalize="none" returnKeyType="search" onChangeText={onChangeQuery}
              style={[styles.searchInput, roomChromeSurface(roomChrome), { color: roomChrome.color }]} />
            {query.trim() ? <Pressable style={styles.close} onPress={() => onChangeQuery("")}><SeoullyText color={roomChrome.color} variant="button">{copy.searchClear}</SeoullyText></Pressable> : null}
          </View>
        </View>
        {matches.length === 0 ? <SeoullyText color={roomChrome.color} variant="secondary">{holdings.length === 0 ? copy.storedEmpty : copy.storedEmptySearch}</SeoullyText> : <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {matches.map((holding) => {
            const look = representationForHolding(holding);
            return <View key={holding.id} style={[styles.row, roomChromeSurface(roomChrome)]}>
            {look.imageUrl ? <CachedSignedImage cacheKey={holding.id} url={look.imageUrl} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: look.color }]} />}
            <View style={styles.meta}>
              <SeoullyText color={roomChrome.color} numberOfLines={1} variant="handle" style={styles.name}>{holding.template.name}</SeoullyText>
              <PhotocardCollectorCount templateId={holding.templateId} kind={holding.template.kind} color={roomChrome.color} />
              <SeoullyText numberOfLines={1} variant="caption" color={roomChrome.color}>
                {[holding.template.groupName, holding.template.memberName, collectibleKindLabel(holding.template.kind, copy)].filter(Boolean).join(" · ")}
              </SeoullyText>
              <View style={styles.actions}>
                {onInspect ? <Pressable style={styles.close} onPress={() => onInspect(holding.id)}><SeoullyText variant="caption" color={roomChrome.color}>{copy.viewCollectible}</SeoullyText></Pressable> : null}
                {holding.template.kind === "photocard" && onBinder ? <Pressable style={styles.close} onPress={() => onBinder(holding)}><SeoullyText variant="caption" color={roomChrome.color}>{copy.openBinder}</SeoullyText></Pressable> : editing && onPlace ? <Pressable style={styles.close} onPress={() => onPlace(holding)}><SeoullyText variant="caption" color={roomChrome.color}>{onBinder ? holding.template.kind === "poster" ? copy.placeOnWall : copy.placeOnSurface : copy.placeInRoom}</SeoullyText></Pressable> : null}
                {!editing && !(holding.template.kind === "photocard" && onBinder) && onEditToPlace ? <Pressable style={styles.close} onPress={onEditToPlace}><SeoullyText variant="caption" color={roomChrome.color}>{copy.editRoomToPlace}</SeoullyText></Pressable> : null}
              </View>
            </View>
          </View>;
          })}
        </ScrollView>}
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  close: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  searchInput: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 48, fontSize: 16, paddingHorizontal: 12 },
  frame: { flex: 1, justifyContent: "flex-end" },
  dismiss: { flex: 1, backgroundColor: "rgba(18, 14, 18, 0.28)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: "72%", paddingHorizontal: chrome.gutter, paddingTop: spacing.md },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { flex: 1, fontWeight: "700" },
  search: { marginBottom: spacing.sm, zIndex: 2 },
  list: { zIndex: 1 },
  row: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  thumb: { borderRadius: 8, height: 72, width: 52 },
  thumbFallback: { },
  meta: { flex: 1, gap: 4 },
  name: { },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
