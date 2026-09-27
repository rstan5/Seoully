/* eslint-disable react-hooks/refs -- PanResponder reads refs only inside gesture callbacks. */
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadNativeRoom, removeNativeRoomPlacement, saveNativeRoomPlacement, saveNativeRoomTheme, type NativeHolding, type NativeRoomSnapshot, type NativeRoomThemeId } from "../src/api";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy } from "../src/locale";
import { RetryNotice } from "../src/components/RetryNotice";
import { NativeRoomRenderer } from "../src/room/NativeRoomRenderer";
import { buildRoomRenderables, createInitialRoomRenderable, moveRenderable, nativeHomeForHolding, settleRoomRenderable, toPersistedTransform, zoneIdForNativeSurface, type RoomRenderable } from "../src/room/model";
import { colors, spacing } from "../src/theme";

export default function RoomScreen() {
  const copy = useCopy();
  const [snapshot, setSnapshot] = useState<NativeRoomSnapshot | null>(null);
  const [items, setItems] = useState<RoomRenderable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cameraYaw, setCameraYaw] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dragOrigin = useRef<RoomRenderable | null>(null);
  const cameraOrigin = useRef(0);
  const latestItems = useRef(items);
  useEffect(() => { latestItems.current = items; }, [items]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadNativeRoom();
      setSnapshot(next);
      setItems(buildRoomRenderables(next.holdings, next.placements));
      setError(null);
    } catch {
      setError(copy.roomUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.roomUnavailable]);
  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 4,
    onPanResponderGrant: () => {
      if (editing && selectedId) dragOrigin.current = latestItems.current.find((item) => item.holding.id === selectedId) ?? null;
      else cameraOrigin.current = cameraYaw;
    },
    onPanResponderMove: (_, gesture) => {
      if (!editing || !selectedId) {
        setCameraYaw(Math.max(-0.38, Math.min(0.38, cameraOrigin.current + gesture.dx * 0.003)));
        return;
      }
      const origin = dragOrigin.current;
      if (!origin) return;
      const moved = moveRenderable(origin, gesture.dx * 0.008, gesture.dy * 0.008);
      setItems((current) => current.map((item) => item.holding.id === moved.holding.id ? moved : item));
    },
    onPanResponderRelease: () => {
      if (!editing) return;
      const id = selectedId;
      const room = snapshot?.room;
      const current = latestItems.current.find((item) => item.holding.id === id);
      dragOrigin.current = null;
      if (!id || !room || !current) return;
      const settled = settleRoomRenderable(current, room.id);
      setItems((all) => all.map((item) => item.holding.id === id ? settled.renderable : item));
      const slot = current.placement?.slot ?? latestItems.current.findIndex((item) => item.holding.id === id);
      void saveNativeRoomPlacement({
        roomId: room.id,
        holdingId: id,
        zoneId: zoneIdForNativeSurface(room.id, settled.surfaceId),
        slot: Math.max(0, slot),
        transform: toPersistedTransform(settled.renderable),
        surfaceId: settled.surfaceId,
      }).catch(() => setError(copy.roomSaveFailed));
    },
    onPanResponderTerminate: () => { dragOrigin.current = null; },
  });
  const placedIds = new Set(items.map((item) => item.holding.id));
  const unplaced = snapshot?.holdings.filter((holding) => !placedIds.has(holding.id)) ?? [];
  const selectedItem = items.find((item) => item.holding.id === selectedId) ?? null;

  async function placeHolding(holding: NativeHolding) {
    if (!snapshot || items.length >= 24) return;
    const home = nativeHomeForHolding(holding, snapshot.room.id, items.length);
    const initial = createInitialRoomRenderable(holding, items.length, snapshot.room.id);
    const settled = settleRoomRenderable(initial, snapshot.room.id, home.surfaceId);
    const slot = items.filter((item) => item.placement?.zoneId === home.zoneId).length;
    try {
      const placement = await saveNativeRoomPlacement({
        roomId: snapshot.room.id,
        holdingId: holding.id,
        zoneId: home.zoneId,
        slot,
        transform: toPersistedTransform(settled.renderable),
        surfaceId: settled.surfaceId,
      });
      setItems((current) => [...current, { ...settled.renderable, placement }]);
      setSelectedId(holding.id);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  async function removeSelected() {
    if (!snapshot || !selectedId) return;
    try {
      await removeNativeRoomPlacement(snapshot.room.id, selectedId);
      setItems((current) => current.filter((item) => item.holding.id !== selectedId));
      setSelectedId(null);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  async function changeTheme(themeId: NativeRoomThemeId) {
    if (!snapshot || snapshot.room.themeId === themeId) return;
    const previous = snapshot.room;
    setSnapshot((current) => current ? { ...current, room: { ...current.room, themeId } } : current);
    try {
      const room = await saveNativeRoomTheme(snapshot.room.id, themeId);
      setSnapshot((current) => current ? { ...current, room } : current);
    } catch {
      setSnapshot((current) => current ? { ...current, room: previous } : current);
      setError(copy.roomSaveFailed);
    }
  }

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.heading}><Text style={styles.title}>{copy.room}</Text><Text style={styles.lead}>{copy.roomLead}</Text></View>
      <Pressable accessibilityRole="button" disabled={!snapshot} onPress={() => setEditing((value) => !value)} style={styles.editButton}><Text style={styles.editButtonText}>{editing ? copy.finishEditing : copy.editRoom}</Text></Pressable>
    </View>
    {editing && snapshot ? <View><Text style={styles.themeLabel}>{copy.roomStyle}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeRow}>{([
      ["hearth", copy.roomThemeHearth],
      ["blossom", copy.roomThemeBlossom],
      ["midnight", copy.roomThemeMidnight],
    ] as const).map(([id, label]) => <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: snapshot.room.themeId === id }} onPress={() => changeTheme(id)} style={[styles.themeChoice, snapshot.room.themeId === id && styles.themeChoiceSelected]}><Text style={[styles.themeChoiceText, snapshot.room.themeId === id && styles.themeChoiceTextSelected]}>{label}</Text></Pressable>)}</ScrollView></View> : null}
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {!loading && !snapshot?.holdings.length ? <Text style={styles.empty}>{copy.roomEmpty}</Text> : null}
    {!loading && snapshot ? <View style={styles.stage} {...panResponder.panHandlers}>
      <NativeRoomRenderer items={items} selectedId={selectedId} focusedId={editing ? null : selectedId} themeId={snapshot.room.themeId} cameraYaw={cameraYaw} onSelect={setSelectedId} onClearSelection={() => setSelectedId(null)} />
      {editing && selectedId ? <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{copy.roomDragHint}</Text></View> : null}
      {!editing ? <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{copy.roomOrbitHint}</Text></View> : null}
    </View> : null}
    {selectedItem && !editing ? <View style={styles.inspection}>
      <View style={styles.inspectionCopy}><Text numberOfLines={1} style={styles.inspectionTitle}>{selectedItem.holding.template.name}</Text><Text numberOfLines={1} style={styles.inspectionMeta}>{[selectedItem.holding.template.groupName, selectedItem.holding.template.memberName, selectedItem.holding.template.releaseName, collectibleKindLabel(selectedItem.holding.template.kind, copy)].filter(Boolean).join(" · ")}</Text><Text style={styles.inspectionMeta}>{selectedItem.holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => setSelectedId(null)} style={styles.inspectAction}><Text style={styles.inspectActionText}>{copy.close}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={removeSelected} style={styles.inspectAction}><Text style={styles.inspectActionText}>{copy.removeFromRoom}</Text></Pressable>
    </View> : null}
    {selectedItem && editing ? <View style={styles.selectionRow}><Text numberOfLines={1} style={styles.selection}>{selectedItem.holding.template.name}</Text><Pressable accessibilityRole="button" onPress={removeSelected}><Text style={styles.removeText}>{copy.removeFromRoom}</Text></Pressable></View> : null}
    {unplaced.length ? <View style={styles.stored}><Text style={styles.storedTitle}>{copy.storedCollection}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storedList}>{unplaced.map((holding) => <Pressable key={holding.id} accessibilityRole="button" onPress={() => placeHolding(holding)} style={styles.storedItem}><Text numberOfLines={2} style={styles.storedItemText}>+ {holding.template.name}</Text></Pressable>)}</ScrollView></View> : null}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  heading: { flex: 1 },
  title: { color: colors.ink, fontSize: 30, fontWeight: "700" },
  lead: { color: colors.muted, fontSize: 14, marginTop: spacing.xs },
  editButton: { backgroundColor: colors.plum, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  editButtonText: { color: colors.surface, fontWeight: "700" },
  themeLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", paddingHorizontal: spacing.md, textTransform: "uppercase" },
  themeRow: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  themeChoice: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: spacing.md },
  themeChoiceSelected: { backgroundColor: colors.plum, borderColor: colors.plum },
  themeChoiceText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
  themeChoiceTextSelected: { color: colors.surface },
  loading: { marginTop: spacing.xl },
  error: { color: colors.plum, paddingHorizontal: spacing.lg },
  empty: { color: colors.muted, padding: spacing.lg },
  stage: { flex: 1, minHeight: 360, overflow: "hidden" },
  hint: { alignSelf: "center", backgroundColor: colors.surface, borderRadius: 999, bottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: "absolute" },
  hintText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  selectionRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center", padding: spacing.sm },
  selection: { color: colors.plum, flexShrink: 1, fontWeight: "700" },
  removeText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  stored: { borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.sm },
  storedTitle: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: spacing.xs },
  storedList: { gap: spacing.xs },
  storedItem: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, justifyContent: "center", maxWidth: 150, minHeight: 42, paddingHorizontal: spacing.sm },
  storedItemText: { color: colors.plum, fontSize: 12, fontWeight: "600" },
  inspection: { alignItems: "center", backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  inspectionCopy: { flex: 1 },
  inspectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  inspectionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  inspectAction: { borderColor: colors.plum, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: spacing.sm },
  inspectActionText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
});
