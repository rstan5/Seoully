import { roomChromeSurface, type RoomChrome } from "./theme";
import { ShopMiniature } from "./ShopMiniature";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { MobileCopy } from "../i18n";
import { spacing } from "../theme";
import { chrome } from "../ui/shellLayout";
import { SeoullyText } from "../ui/SeoullyText";
import {
  canAddRoomObject,
  SHOP_CATALOG,
  type RoomObjectInstance,
  type RoomObjectKind,
} from "./roomObjects";

export function RoomShopSheet({
  roomChrome,
  visible,
  objects,
  reducedMotion,
  copy,
  bottomInset,
  onAdd,
  onClose,
}: {
  roomChrome: RoomChrome;
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
      <View style={[styles.sheet, roomChromeSurface(roomChrome), { paddingBottom: bottomInset + chrome.companionSize + chrome.companionClearance }]}>
        <View style={styles.header}>
          <SeoullyText color={roomChrome.color} variant="handle" style={styles.title}>{copy.roomShop}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close} hitSlop={8}>
            <SeoullyText variant="button" color={roomChrome.color}>{copy.close}</SeoullyText>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          {SHOP_CATALOG.map((kind) => {
            const available = canAddRoomObject(objects, kind);
            return <View key={kind}>
              {kind === "shelf" || kind === "rug" || kind === "wall-frame" ? <SeoullyText variant="caption" color={roomChrome.color} style={{ marginTop: spacing.sm }}>{kind === "shelf" ? copy.roomFurnitureGroup : kind === "rug" ? copy.roomDecorGroup : copy.roomWallGroup}</SeoullyText> : null}
              <View style={[styles.row, roomChromeSurface(roomChrome)]}>
              <ShopMiniature kind={kind} />
              <View style={styles.copy}>
                <SeoullyText color={roomChrome.color} variant="handle" style={styles.name}>{shopName(copy, kind)}</SeoullyText>
                <SeoullyText variant="caption" color={roomChrome.color}>
                  {shopHint(copy, kind)}
                </SeoullyText>
              </View>
              {available ? <Pressable accessibilityRole="button" onPress={() => onAdd(kind)} style={[styles.add, roomChromeSurface(roomChrome)]}>
                <SeoullyText variant="button" color={roomChrome.color}>{copy.roomShopAdd}</SeoullyText>
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
  close: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  frame: { flex: 1, justifyContent: "flex-end" },
  dismiss: { flex: 1, backgroundColor: "rgba(18, 14, 18, 0.28)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: "52%", paddingHorizontal: chrome.gutter, paddingTop: spacing.sm },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { flex: 1, fontWeight: "700" },
  row: { alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", minHeight: 56, paddingVertical: spacing.xs },
  copy: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  name: { fontWeight: "700" },
  add: { alignItems: "center", borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 44, minWidth: 72, paddingHorizontal: spacing.sm },
});
