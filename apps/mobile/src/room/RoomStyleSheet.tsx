import { relativeLuminance } from "../ui/profileContrast";
import { roomChromeSurface, type RoomChrome } from "./theme";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { MobileCopy } from "../i18n";
import { spacing } from "../theme";
import { chrome } from "../ui/shellLayout";
import { SeoullyText } from "../ui/SeoullyText";
import {
  ROOM_BRIGHTNESS_IDS,
  ROOM_FLOOR_IDS,
  ROOM_FURNITURE_IDS,
  ROOM_LIGHT_IDS,
  ROOM_RUG_IDS,
  ROOM_WALL_IDS,
  styleSwatch,
  type NativeRoomStyle,
} from "./roomStyle";

export function RoomStyleSheet({
  roomChrome,
  visible,
  style,
  reducedMotion,
  copy,
  bottomInset,
  onChange,
  onClose,
}: {
  roomChrome: RoomChrome;
  visible: boolean;
  style: NativeRoomStyle;
  reducedMotion: boolean;
  copy: MobileCopy;
  bottomInset: number;
  onChange: (next: NativeRoomStyle) => void;
  onClose: () => void;
}) {
  return <Modal animationType={reducedMotion ? "none" : "slide"} onRequestClose={onClose} transparent visible={visible}>
    <View style={styles.frame}>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.dismiss} />
      <View style={[styles.sheet, roomChromeSurface(roomChrome), { paddingBottom: bottomInset + chrome.companionSize + chrome.companionClearance }]}>
        <View style={styles.header}>
          <SeoullyText color={roomChrome.color} variant="handle" style={styles.title}>{copy.roomStyle}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.close} hitSlop={8}>
            <SeoullyText variant="button" color={roomChrome.color}>{copy.close}</SeoullyText>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled">
          <StyleRow roomChrome={roomChrome} label={copy.styleWall} ids={ROOM_WALL_IDS} selected={style.wall} kind="wall" nameFor={(id) => styleLabel(copy, "wall", id)} onPick={(wall) => onChange({ ...style, wall })} />
          <StyleRow roomChrome={roomChrome} label={copy.styleFloor} ids={ROOM_FLOOR_IDS} selected={style.floor} kind="floor" nameFor={(id) => styleLabel(copy, "floor", id)} onPick={(floor) => onChange({ ...style, floor })} />
          <StyleRow roomChrome={roomChrome} label={copy.styleFurniture} ids={ROOM_FURNITURE_IDS} selected={style.furniture} kind="furniture" nameFor={(id) => styleLabel(copy, "furniture", id)} onPick={(furniture) => onChange({ ...style, furniture })} />
          <StyleRow roomChrome={roomChrome} label={copy.styleRug} ids={ROOM_RUG_IDS} selected={style.rug} kind="rug" nameFor={(id) => styleLabel(copy, "rug", id)} onPick={(rug) => onChange({ ...style, rug })} />
          <StyleRow roomChrome={roomChrome} label={copy.styleLight} ids={ROOM_LIGHT_IDS} selected={style.light} kind="light" nameFor={(id) => styleLabel(copy, "light", id)} onPick={(light) => onChange({ ...style, light })} />
          <StyleRow roomChrome={roomChrome} label={copy.styleBrightness} ids={ROOM_BRIGHTNESS_IDS} selected={style.brightness} kind="brightness" nameFor={(id) => styleLabel(copy, "brightness", id)} onPick={(brightness) => onChange({ ...style, brightness })} />
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

function styleLabel(copy: MobileCopy, kind: string, id: string) {
  const labels: Record<string, string> = {
    "wall:plum": copy.styleWallPlum,
    "wall:cream": copy.styleWallCream,
    "wall:ink": copy.styleWallInk,
    "wall:blush": copy.styleWallBlush,
    "wall:sage": copy.styleWallSage,
    "floor:walnut": copy.styleFloorWalnut,
    "floor:oak": copy.styleFloorOak,
    "floor:charcoal": copy.styleFloorCharcoal,
    "floor:blush-wood": copy.styleFloorBlushWood,
    "furniture:walnut": copy.styleFurnitureWalnut,
    "furniture:oak": copy.styleFurnitureOak,
    "furniture:ink": copy.styleFurnitureInk,
    "furniture:blush": copy.styleFurnitureBlush,
    "rug:rose": copy.styleRugRose,
    "rug:cream": copy.styleRugCream,
    "rug:ink": copy.styleRugInk,
    "rug:sage": copy.styleRugSage,
    "light:warm": copy.styleLightWarm,
    "light:day": copy.styleLightDay,
    "light:soft": copy.styleLightSoft,
    "light:night": copy.styleLightNight,
    "brightness:dim": copy.styleBrightDim,
    "brightness:normal": copy.styleBrightNormal,
    "brightness:bright": copy.styleBrightBright,
  };
  return labels[`${kind}:${id}`] ?? id;
}

function StyleRow<T extends string>({
  roomChrome,
  label,
  ids,
  selected,
  kind,
  nameFor,
  onPick,
}: {
  roomChrome: RoomChrome;
  label: string;
  ids: readonly T[];
  selected: T;
  kind: keyof NativeRoomStyle;
  nameFor: (id: T) => string;
  onPick: (id: T) => void;
}) {
  return <View style={[styles.row, roomChromeSurface(roomChrome)]}>
    <SeoullyText variant="caption" color={roomChrome.color} style={styles.label}>{label}</SeoullyText>
    <View style={styles.swatches}>
      {ids.map((id) => {
        const active = id === selected;
        return <Pressable
          key={id}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={() => onPick(id)}
          style={[styles.swatch, { backgroundColor: styleSwatch(kind, id), borderColor: active ? roomChrome.color : roomChrome.border }]}
        >
          <SeoullyText numberOfLines={1} variant="caption" color={relativeLuminance(styleSwatch(kind, id)) > 0.179 ? "#000000" : "#ffffff"} style={styles.swatchName}>{active ? "✓ " : ""}{nameFor(id)}</SeoullyText>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  close: { minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  frame: { flex: 1, justifyContent: "flex-end" },
  dismiss: { flex: 1, backgroundColor: "rgba(18, 14, 18, 0.28)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, maxHeight: "58%", paddingHorizontal: chrome.gutter, paddingTop: spacing.sm },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { flex: 1, fontWeight: "700" },
  row: { marginBottom: spacing.md },
  label: { fontWeight: "700", marginBottom: spacing.xs, textTransform: "uppercase" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  swatch: { borderRadius: 12, borderWidth: 2, minHeight: 44, minWidth: 72, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, justifyContent: "flex-end" },
  swatchName: { fontSize: 11, fontWeight: "700" },
});
