import { LanguageModal } from "../ui/GlobalLanguageControl";
import { roomMessageStyles } from "./RoomMessage";
import { roomChromeSurface, type RoomChrome } from "./theme";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { NativeHolding } from "../api";
import type { MobileCopy } from "../i18n";
import { CachedSignedImage } from "../media/cachedMedia";
import { SeoullyText } from "../ui/SeoullyText";
import { spacing } from "../theme";
import { chrome } from "../ui/shellLayout";
import { eligiblePhotocards, PHOTO_STRING_CAPACITY } from "./photoString";
import { representationForHolding } from "./representation";
import type { RoomObjectInstance } from "./roomObjects";

export function PhotoStringSheet({ roomChrome, object, holdings, copy, reducedMotion, bottomInset, onSave, onClose }: {
  roomChrome: RoomChrome;
  object: RoomObjectInstance; holdings: NativeHolding[]; copy: MobileCopy; reducedMotion: boolean; bottomInset: number;
  onSave: (slots: (string | null)[]) => Promise<boolean>; onClose: () => void;
}) {
  const eligible = eligiblePhotocards(holdings);
  const ids = new Set(eligible.map((h) => h.id));
  const [slots, setSlots] = useState<(string | null)[]>(object.photoString?.slots.map((id) => id && ids.has(id) ? id : null) ?? Array(PHOTO_STRING_CAPACITY).fill(null));
  const [saving, setSaving] = useState(false);
  const count = slots.filter(Boolean).length;
  function toggle(id: string) {
    setSlots((current) => {
      if (current.includes(id)) return current.map((value) => value === id ? null : value);
      const free = current.indexOf(null);
      return free < 0 ? current : current.map((value, i) => i === free ? id : value);
    });
  }
  return <LanguageModal transparent visible animationType={reducedMotion ? "none" : "slide"} onRequestClose={onClose}>
    <View style={styles.frame}>
      <Pressable style={styles.dismiss} onPress={onClose} accessibilityLabel={copy.close} />
      <View style={[styles.sheet, roomChromeSurface(roomChrome), { paddingBottom: bottomInset + chrome.companionSize + chrome.companionClearance }]}>
        <View style={[styles.header, roomMessageStyles.sheetHeader]}>
          <SeoullyText style={{ flex: 1, minWidth: 0 }} color={roomChrome.color} variant="handle">{copy.roomChoosePhotocards} · {count}/{PHOTO_STRING_CAPACITY}</SeoullyText>
          <Pressable onPress={onClose} style={styles.close}><SeoullyText color={roomChrome.color}>{copy.close}</SeoullyText></Pressable>
        </View>
        <SeoullyText variant="caption" color={roomChrome.color}>{copy.roomPhotoStringHint}</SeoullyText>
        <ScrollView>
          {eligible.length === 0 ? <SeoullyText color={roomChrome.color}>{copy.roomNoPhotocards}</SeoullyText> : eligible.map((holding) => {
            const look = representationForHolding(holding), selected = slots.includes(holding.id);
            return <Pressable key={holding.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: !selected && count === PHOTO_STRING_CAPACITY }} disabled={!selected && count === PHOTO_STRING_CAPACITY} style={[styles.row, roomChromeSurface(roomChrome), !selected && count === PHOTO_STRING_CAPACITY && styles.disabled]} onPress={() => toggle(holding.id)}>
              {look.imageUrl ? <CachedSignedImage cacheKey={holding.id} url={look.imageUrl} style={styles.card} /> : <View style={[styles.card, { backgroundColor: look.color }]} />}
              <View style={styles.identity}><SeoullyText color={roomChrome.color} numberOfLines={2}>{holding.template.name}</SeoullyText><SeoullyText variant="caption" color={roomChrome.color}>{holding.template.memberName ?? holding.template.groupName}</SeoullyText></View>
              <SeoullyText color={roomChrome.color}>{selected ? "✓" : "+"}</SeoullyText>
            </Pressable>;
          })}
        </ScrollView>
        <Pressable disabled={saving} onPress={async () => { setSaving(true); try { if (await onSave(slots)) onClose(); } finally { setSaving(false); } }} style={[styles.done, roomChromeSurface(roomChrome), saving && styles.disabled]}><SeoullyText color={roomChrome.color}>{copy.finishEditing}</SeoullyText></Pressable>
      </View>
    </View>
  </LanguageModal>;
}
const styles = StyleSheet.create({
  close: { flexShrink: 0, minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" },
  disabled: { opacity: 0.85 },
  frame: { flex: 1, justifyContent: "flex-end" }, dismiss: { flex: 1, backgroundColor: "rgba(18,14,18,0.28)" },
  sheet: { maxHeight: "65%", padding: spacing.md, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", minHeight: 70, paddingVertical: spacing.xs },
  card: { width: 34, height: 50, borderRadius: 3 }, identity: { flex: 1, paddingHorizontal: spacing.sm },
  done: { minHeight: 44, justifyContent: "center", alignItems: "center", borderWidth: 1, borderRadius: 8 },
});
