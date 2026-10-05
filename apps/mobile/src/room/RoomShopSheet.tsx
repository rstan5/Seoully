import { ShopMiniature } from "./ShopMiniature";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { MobileCopy } from "../i18n";
import { colors, spacing } from "../theme";
import { chrome } from "../ui/shellLayout";
import { SeoullyText } from "../ui/SeoullyText";
import {
  canAddRoomObject,
  objectHasKind,
  SHOP_CATALOG,
  UNIQUE_ROOM_OBJECT_KINDS,
  type RoomObjectInstance,
  type RoomObjectKind,
} from "./roomObjects";

export function RoomShopSheet({
  visible,
  objects,
  reducedMotion,
  copy,
  bottomInset,
  onAdd,
  onClose,
}: {
  visible: boolean;
  objects: RoomObjectInstance[];
  reducedMotion: boolean;
  copy: MobileCopy;
  bottomInset: number;
  onAdd: (kind: RoomObjectKind) => void;
  onClose: () => void;
}) {
  return <Modal animationType={reducedMotion ? "none" : "slide"} onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.frame}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.dismiss} />
      <View style={[styles.sheet, { paddingBottom: bottomInset + chrome.companionSize + chrome.companionClearance }]}>
        <View style={styles.header}>
          <SeoullyText variant="handle" style={styles.title}>{copy.roomShop}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
            <SeoullyText variant="button" color={colors.plum}>{copy.close}</SeoullyText>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {SHOP_CATALOG.map((kind) => {
            const available = canAddRoomObject(objects, kind);
            const placed = objectHasKind(objects, kind);
            return <View key={kind}>
              {kind === "shelf" || kind === "rug" || kind === "wall-frame" ? <SeoullyText variant="caption" color={colors.muted} style={{ marginTop: spacing.sm }}>{kind === "shelf" ? copy.roomFurnitureGroup : kind === "rug" ? copy.roomDecorGroup : copy.roomWallGroup}</SeoullyText> : null}
              <View style={styles.row}>
              <ShopMiniature kind={kind} />
              <View style={styles.copy}>
                <SeoullyText variant="handle" style={styles.name}>{shopName(copy, kind)}</SeoullyText>
                <SeoullyText variant="caption" color={colors.muted}>
                  {placed && UNIQUE_ROOM_OBJECT_KINDS.has(kind) ? copy.roomShopInRoom : shopHint(copy, kind)}
                </SeoullyText>
              </View>
              {available ? <Pressable accessibilityRole="button" onPress={() => onAdd(kind)} style={styles.add}>
                <SeoullyText variant="button" color={colors.plum}>{copy.roomShopAdd}</SeoullyText>
              </Pressable> : null}
            </View></View>;
          })}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function shopName(copy: MobileCopy, kind: RoomObjectKind) {
  if (kind === "shelf") return copy.roomObjectShelf;
  if (kind === "desk") return copy.roomObjectDesk;
  if (kind === "chair") return copy.roomObjectChair;
  if (kind === "photo-string") return copy.roomObjectPhotoString;
  if (kind === "case") return copy.roomObjectCase;
  if (kind === "lamp") return copy.roomObjectLamp;
  if (kind === "plant") return copy.roomObjectPlant;
  if (kind === "rug") return copy.roomObjectRug;
  if (kind === "archive") return copy.roomObjectArchive;
  return copy.roomObjectWallFrame;
}

function shopHint(copy: MobileCopy, kind: RoomObjectKind) {
  if (kind === "desk") return copy.roomShopDeskHint;
  if (kind === "archive") return copy.roomShopArchiveHint;
  return copy.roomShopItemHint;
}

const styles = StyleSheet.create({
  frame: { flex: 1, justifyContent: "flex-end" },
  dismiss: { flex: 1, backgroundColor: "rgba(18, 14, 18, 0.28)" },
  sheet: { backgroundColor: colors.canvas, borderTopColor: colors.border, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: "52%", paddingHorizontal: chrome.gutter, paddingTop: spacing.sm },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { color: colors.ink, flex: 1, fontWeight: "700" },
  row: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 56, paddingVertical: spacing.xs },
  copy: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  name: { color: colors.ink, fontWeight: "700" },
  add: { alignItems: "center", borderColor: colors.plum, borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 44, minWidth: 72, paddingHorizontal: spacing.sm },
});
