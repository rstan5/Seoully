import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeHolding } from "../api";
import { collectibleKindLabel, type MobileCopy } from "../i18n";
import { filterStoredHoldings } from "./storedHoldings";
import { representationForHolding } from "./representation";
import { CachedSignedImage } from "../media/cachedMedia";
import { colors, spacing } from "../theme";
import { chrome } from "../ui/shellLayout";
import { SeoullyEmptyState } from "../ui/SeoullyEmptyState";
import { SeoullySearchField } from "../ui/SeoullySearch";
import { SeoullyText } from "../ui/SeoullyText";

export function StoredCollectionSheet({
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
  onEditToPlace,
}: {
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
      <View style={[styles.sheet, { paddingBottom: bottomInset + chrome.companionSize + chrome.companionClearance }]}>
        <View style={styles.header}>
          <SeoullyText variant="handle" style={styles.title}>{copy.storedCollection}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <SeoullyText variant="button" color={colors.plum}>{copy.close}</SeoullyText>
          </Pressable>
        </View>
        <View style={styles.search}>
          <SeoullySearchField
            value={query}
            placeholder={copy.storedSearchPlaceholder}
            label={copy.storedSearch}
            clearLabel={copy.searchClear}
            onChange={onChangeQuery}
            onSubmit={() => undefined}
            onClear={() => onChangeQuery("")}
          />
        </View>
        {matches.length === 0 ? <SeoullyEmptyState
          align="start"
          body={holdings.length === 0 ? copy.storedEmpty : copy.storedEmptySearch}
        /> : <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
          {matches.map((holding) => {
            const look = representationForHolding(holding);
            return <View key={holding.id} style={styles.row}>
            {look.imageUrl ? <CachedSignedImage cacheKey={holding.id} url={look.imageUrl} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: look.color }]} />}
            <View style={styles.meta}>
              <SeoullyText numberOfLines={1} variant="handle" style={styles.name}>{holding.template.name}</SeoullyText>
              <SeoullyText numberOfLines={1} variant="caption" color={colors.muted}>
                {[holding.template.groupName, holding.template.memberName, collectibleKindLabel(holding.template.kind, copy)].filter(Boolean).join(" · ")}
              </SeoullyText>
              <View style={styles.actions}>
                {onInspect ? <Pressable onPress={() => onInspect(holding.id)}><SeoullyText variant="caption" color={colors.plum}>{copy.viewCollectible}</SeoullyText></Pressable> : null}
                {editing && onPlace ? <Pressable onPress={() => onPlace(holding)}><SeoullyText variant="caption" color={colors.plum}>{copy.placeInRoom}</SeoullyText></Pressable> : null}
                {!editing && onEditToPlace ? <Pressable onPress={onEditToPlace}><SeoullyText variant="caption" color={colors.plum}>{copy.editRoomToPlace}</SeoullyText></Pressable> : null}
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
  frame: { flex: 1, justifyContent: "flex-end" },
  dismiss: { flex: 1, backgroundColor: "rgba(18, 14, 18, 0.28)" },
  sheet: { backgroundColor: colors.canvas, borderTopColor: colors.border, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: "72%", paddingHorizontal: chrome.gutter, paddingTop: spacing.sm },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { color: colors.ink, flex: 1, fontWeight: "700" },
  search: { marginBottom: spacing.sm, zIndex: 2 },
  list: { zIndex: 1 },
  row: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
  thumb: { borderRadius: 8, height: 72, width: 52 },
  thumbFallback: { backgroundColor: colors.blush },
  meta: { flex: 1, gap: 4 },
  name: { color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
