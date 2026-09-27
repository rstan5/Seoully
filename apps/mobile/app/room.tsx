/* eslint-disable react-hooks/refs -- PanResponder reads refs only inside gesture callbacks. */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { loadNativeRoom, saveNativeRoomPlacement, type NativeRoomSnapshot } from "../src/api";
import { useCopy } from "../src/locale";
import { NativeRoomRenderer } from "../src/room/NativeRoomRenderer";
import { buildRoomRenderables, moveRenderable, toPersistedTransform, type RoomRenderable } from "../src/room/model";
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

  useEffect(() => {
    let active = true;
    void loadNativeRoom()
      .then((next) => {
        if (!active) return;
        setSnapshot(next);
        setItems(buildRoomRenderables(next.holdings, next.placements));
      })
      .catch(() => { if (active) setError(copy.roomUnavailable); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.roomUnavailable]);

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
      const slot = current.placement?.slot ?? latestItems.current.findIndex((item) => item.holding.id === id);
      void saveNativeRoomPlacement({
        roomId: room.id,
        holdingId: id,
        zoneId: current.placement?.zoneId ?? `${room.id}-floor`,
        slot: Math.max(0, slot),
        transform: toPersistedTransform(current),
        surfaceId: `${room.id}-floor`,
      }).catch(() => setError(copy.roomSaveFailed));
    },
    onPanResponderTerminate: () => { dragOrigin.current = null; },
  });

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.heading}><Text style={styles.title}>{copy.room}</Text><Text style={styles.lead}>{copy.roomLead}</Text></View>
      <Pressable accessibilityRole="button" disabled={!items.length} onPress={() => setEditing((value) => !value)} style={styles.editButton}><Text style={styles.editButtonText}>{editing ? copy.finishEditing : copy.editRoom}</Text></Pressable>
    </View>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!loading && items.length === 0 ? <Text style={styles.empty}>{copy.roomEmpty}</Text> : null}
    {items.length ? <View style={styles.stage} {...panResponder.panHandlers}>
      <NativeRoomRenderer items={items} selectedId={selectedId} cameraYaw={cameraYaw} onSelect={setSelectedId} />
      {editing && selectedId ? <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{copy.roomDragHint}</Text></View> : null}
      {!editing ? <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{copy.roomOrbitHint}</Text></View> : null}
    </View> : null}
    {selectedId ? <Text numberOfLines={1} style={styles.selection}>{items.find((item) => item.holding.id === selectedId)?.holding.template.name}</Text> : null}
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
  loading: { marginTop: spacing.xl },
  error: { color: colors.plum, paddingHorizontal: spacing.lg },
  empty: { color: colors.muted, padding: spacing.lg },
  stage: { flex: 1, minHeight: 360, overflow: "hidden" },
  hint: { alignSelf: "center", backgroundColor: colors.surface, borderRadius: 999, bottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: "absolute" },
  hintText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  selection: { color: colors.plum, fontWeight: "700", padding: spacing.md, textAlign: "center" },
});
