/* eslint-disable react-hooks/refs -- PanResponder reads refs only inside gesture callbacks. */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, PanResponder, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { loadNativeRoom, removeNativeRoomPlacement, saveNativeRoomPlacement, type NativeHolding, type NativeRoomSnapshot } from "../src/api";
import { useSocialRepository } from "../src/data";
import { useReportAskSurface } from "../src/ask-surface";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy } from "../src/locale";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { CachedSignedImage } from "../src/media/cachedMedia";
import { buildRoomRenderables, createInitialRoomRenderable, isSupportedRoomPlacement, moveRenderable, nativeHomeForHolding, nextNativeSlot, resizeRenderable, settleRoomRenderable, toPersistedTransform, turnRenderable, zoneIdForNativeSurface, type NativeRoomVector, type RoomRenderable } from "../src/room/model";
import { colors, spacing } from "../src/theme";

const NativeRoomRenderer = lazy(async () => {
  const mod = await import("../src/room/NativeRoomRenderer");
  return { default: mod.NativeRoomRenderer };
});

const ROOM_CAMERA_KEY = "seoully.mobile.room-camera.v1";
const ROOM_FOCUS_KEY = "seoully.mobile.room-focus.v1";

export default function RoomScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  useReportAskSurface({ surface: "room" });
  const [snapshot, setSnapshot] = useState<NativeRoomSnapshot | null>(null);
  const [items, setItems] = useState<RoomRenderable[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cameraYaw, setCameraYaw] = useState(0);
  const [cameraPitch, setCameraPitch] = useState(0);
  const [lookTarget, setLookTarget] = useState<NativeRoomVector | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dragOrigin = useRef<RoomRenderable | null>(null);
  const editBaseline = useRef<RoomRenderable[]>([]);
  const cameraOrigin = useRef({ yaw: 0, pitch: 0 });
  const latestItems = useRef(items);
  const editingRef = useRef(editing);
  const focusReady = useRef(false);
  useEffect(() => { latestItems.current = items; }, [items]);
  useEffect(() => { editingRef.current = editing; }, [editing]);
  useEffect(() => {
    const task = setTimeout(() => {
      void AsyncStorage.getItem(ROOM_FOCUS_KEY).then((stored) => {
        if (stored) setSelectedId(stored);
        focusReady.current = true;
      });
      void AsyncStorage.getItem(ROOM_CAMERA_KEY).then((stored) => {
        if (!stored) return;
        try {
          const parsed = JSON.parse(stored) as { yaw?: number; pitch?: number };
          if (Number.isFinite(parsed.yaw)) setCameraYaw(clampCamera(parsed.yaw!, -0.38, 0.38));
          if (Number.isFinite(parsed.pitch)) setCameraPitch(clampCamera(parsed.pitch!, -0.22, 0.28));
        } catch {
          const yaw = Number(stored);
          if (Number.isFinite(yaw)) setCameraYaw(clampCamera(yaw, -0.38, 0.38));
        }
      });
    }, 0);
    return () => clearTimeout(task);
  }, []);
  useEffect(() => {
    if (focusReady.current) void AsyncStorage.setItem(ROOM_FOCUS_KEY, selectedId ?? "");
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId || !items.length || items.some((item) => item.holding.id === selectedId)) return;
    const task = setTimeout(() => setSelectedId(null), 0);
    return () => clearTimeout(task);
  }, [items, selectedId]);

  const refresh = useCallback(async () => {
    if (!social.capabilities.persistRoom) {
      setSnapshot(null);
      setItems([]);
      setError(copy.demoRoomUnavailable);
      setLoading(false);
      return;
    }
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
  }, [copy.demoRoomUnavailable, copy.roomUnavailable, social.capabilities.persistRoom]);
  useFocusEffect(useCallback(() => {
    if (!editingRef.current) void refresh();
  }, [refresh]));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 4,
    onPanResponderGrant: () => {
      if (editing && selectedId) dragOrigin.current = latestItems.current.find((item) => item.holding.id === selectedId) ?? null;
      else cameraOrigin.current = { yaw: cameraYaw, pitch: cameraPitch };
    },
    onPanResponderMove: (_, gesture) => {
      if (!editing || !selectedId) {
        setLookTarget(null);
        setCameraYaw(clampCamera(cameraOrigin.current.yaw + gesture.dx * 0.003, -0.38, 0.38));
        setCameraPitch(clampCamera(cameraOrigin.current.pitch - gesture.dy * 0.003, -0.22, 0.28));
        return;
      }
      const origin = dragOrigin.current;
      if (!origin) return;
      const moved = moveRenderable(origin, gesture.dx * 0.008, gesture.dy * 0.008);
      setItems((current) => current.map((item) => item.holding.id === moved.holding.id ? moved : item));
    },
    onPanResponderRelease: () => {
      if (!editing) {
        persistRoomCamera(cameraYaw, cameraPitch);
        return;
      }
      const id = selectedId;
      const room = snapshot?.room;
      const current = latestItems.current.find((item) => item.holding.id === id);
      dragOrigin.current = null;
      if (!id || !room || !current) return;
      if (!isSupportedRoomPlacement(current, room.id)) {
        const origin = editBaseline.current.find((item) => item.holding.id === id);
        if (origin) setItems((all) => all.map((item) => item.holding.id === id ? origin : item));
        setError(copy.roomInvalidPlacement);
        return;
      }
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
    onPanResponderTerminate: () => {
      dragOrigin.current = null;
      if (!editing) persistRoomCamera(cameraYaw, cameraPitch);
    },
  });
  const roomLooks = [
    ["home", null, copy.roomLookHome],
    ["shelf", { x: -3.15, y: 0, z: -3.48 }, copy.roomLookShelf],
    ["wall", { x: 1.1, y: 0.75, z: -4.2 }, copy.roomLookWall],
    ["desk", { x: 1.45, y: -0.4, z: -2.85 }, copy.roomLookDesk],
    ["case", { x: 3.65, y: 0, z: -3.52 }, copy.roomLookCase],
    ["binder", { x: 0.45, y: -0.3, z: -2.7 }, copy.roomLookBinder],
  ] as const;
  const placedIds = new Set(items.map((item) => item.holding.id));
  const unplaced = snapshot?.holdings.filter((holding) => !placedIds.has(holding.id)) ?? [];
  const storedGroups = groupStoredHoldings(unplaced);
  const selectedItem = items.find((item) => item.holding.id === selectedId) ?? null;

  function persistSelected(next: RoomRenderable) {
    const room = snapshot?.room;
    if (!room) return;
    if (!isSupportedRoomPlacement(next, room.id)) {
      setError(copy.roomInvalidPlacement);
      return;
    }
    const settled = settleRoomRenderable(next, room.id, next.placement?.surfaceId ?? undefined);
    setItems((all) => all.map((item) => item.holding.id === next.holding.id ? settled.renderable : item));
    const slot = next.placement?.slot ?? items.findIndex((item) => item.holding.id === next.holding.id);
    void saveNativeRoomPlacement({
      roomId: room.id,
      holdingId: next.holding.id,
      zoneId: zoneIdForNativeSurface(room.id, settled.surfaceId),
      slot: Math.max(0, slot),
      transform: toPersistedTransform(settled.renderable),
      surfaceId: settled.surfaceId,
    }).catch(() => setError(copy.roomSaveFailed));
  }

  async function placeHolding(holding: NativeHolding) {
    if (!snapshot) return;
    const homeZone = nativeHomeForHolding(holding, snapshot.room.id, 0).zoneId;
    const slot = nextNativeSlot(items.filter((item) => item.placement?.zoneId === homeZone).map((item) => item.placement?.slot ?? 0));
    const home = nativeHomeForHolding(holding, snapshot.room.id, slot);
    const initial = createInitialRoomRenderable(holding, slot, snapshot.room.id);
    const settled = settleRoomRenderable(initial, snapshot.room.id, home.surfaceId);
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

  function beginEditing() {
    editBaseline.current = items.map((item) => ({ ...item, position: { ...item.position }, rotation: { ...item.rotation } }));
    setEditing(true);
    setLookTarget(null);
  }

  async function cancelEditing() {
    const room = snapshot?.room;
    const baseline = editBaseline.current;
    setItems(baseline);
    setEditing(false);
    setSelectedId(null);
    if (!room) return;
    try {
      await Promise.all(baseline.map((item) => saveNativeRoomPlacement({
        roomId: room.id,
        holdingId: item.holding.id,
        zoneId: item.placement?.zoneId ?? zoneIdForNativeSurface(room.id, item.placement?.surfaceId ?? `${room.id}-floor`),
        slot: item.placement?.slot ?? 0,
        transform: toPersistedTransform(item),
        surfaceId: item.placement?.surfaceId ?? undefined,
      })));
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  function openBinder() {
    const holding = items.find((item) => item.holding.id === selectedId)?.holding;
    if (holding?.template.kind === "photocard") {
      router.push({ pathname: "/binder", params: { holdingId: holding.id } });
      return;
    }
    router.push("/binder");
  }

  function lookAtZone(target: NativeRoomVector | null) {
    setSelectedId(null);
    setLookTarget(target);
    if (!target) {
      setCameraYaw(0);
      setCameraPitch(0);
      persistRoomCamera(0, 0);
    }
  }

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <View style={styles.header}>
      <View style={styles.heading}>{router.canGoBack() ? <ScreenBack label={copy.back} onPress={() => router.back()} /> : null}<Text style={styles.title}>{copy.room}</Text><Text style={styles.lead}>{copy.roomLead}</Text></View>
      <View style={styles.headerActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.openBinder} onPress={openBinder} style={styles.editButton}><Text style={styles.editButtonText}>{copy.binder}</Text></Pressable>
        {editing ? <Pressable accessibilityRole="button" onPress={() => void cancelEditing()} style={styles.editButton}><Text style={styles.editButtonText}>{copy.cancelEditing}</Text></Pressable> : null}
        <Pressable accessibilityRole="button" disabled={!snapshot} onPress={() => editing ? setEditing(false) : beginEditing()} style={styles.editButton}><Text style={styles.editButtonText}>{editing ? copy.finishEditing : copy.editRoom}</Text></Pressable>
      </View>
    </View>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {!loading && !snapshot?.holdings.length ? <Text style={styles.empty}>{copy.roomEmpty}</Text> : null}
    {!loading && snapshot ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lookRow}>{roomLooks.map(([id, target, label]) => {
      const selected = id === "home" ? !lookTarget && cameraYaw === 0 && cameraPitch === 0 : Boolean(lookTarget && target && lookTarget.x === target.x && lookTarget.z === target.z);
      return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => lookAtZone(target)} style={[styles.lookChip, selected && styles.lookChipSelected]}><Text style={[styles.lookChipText, selected && styles.lookChipTextSelected]}>{label}</Text></Pressable>;
    })}</ScrollView> : null}
    {!loading && snapshot ? <View style={styles.stage} {...panResponder.panHandlers}>
      <Suspense fallback={<ActivityIndicator color={colors.plum} style={styles.loading} />}><NativeRoomRenderer items={items} selectedId={selectedId} focusedId={editing ? null : selectedId} themeId={snapshot.room.themeId} cameraYaw={cameraYaw} cameraPitch={cameraPitch} lookTarget={lookTarget} onSelect={setSelectedId} onClearSelection={() => setSelectedId(null)} onOpenBinder={editing ? undefined : openBinder} /></Suspense>
      {editing && selectedId ? <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{copy.roomDragHint}</Text></View> : null}
      {!editing ? <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{copy.roomOrbitHint}</Text></View> : null}
    </View> : null}
    {selectedItem && !editing ? <View style={styles.inspection}>
      <View style={styles.inspectionCopy}><Text numberOfLines={1} style={styles.inspectionTitle}>{selectedItem.holding.template.name}</Text><Text numberOfLines={1} style={styles.inspectionMeta}>{[selectedItem.holding.template.groupName, selectedItem.holding.template.memberName, selectedItem.holding.template.releaseName, collectibleKindLabel(selectedItem.holding.template.kind, copy)].filter(Boolean).join(" · ")}</Text><Text style={styles.inspectionMeta}>{selectedItem.holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/collectible", params: { holdingId: selectedItem.holding.id } })} style={styles.inspectAction}><Text style={styles.inspectActionText}>{copy.viewCollectible}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={() => setSelectedId(null)} style={styles.inspectAction}><Text style={styles.inspectActionText}>{copy.close}</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={removeSelected} style={styles.inspectAction}><Text style={styles.inspectActionText}>{copy.removeFromRoom}</Text></Pressable>
    </View> : null}
    {selectedItem && editing ? <View style={styles.selectionColumn}>
      <View style={styles.selectionRow}><Text numberOfLines={1} style={styles.selection}>{selectedItem.holding.template.name}</Text><Pressable accessibilityRole="button" onPress={removeSelected}><Text style={styles.removeText}>{copy.removeFromRoom}</Text></Pressable></View>
      <View style={styles.transformRow}>
        <Pressable accessibilityRole="button" onPress={() => persistSelected(turnRenderable(selectedItem, -Math.PI / 12))} style={styles.transformButton}><Text style={styles.transformText}>{copy.rotateLeft}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => persistSelected(turnRenderable(selectedItem, Math.PI / 12))} style={styles.transformButton}><Text style={styles.transformText}>{copy.rotateRight}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => persistSelected(resizeRenderable(selectedItem, 0.9))} style={styles.transformButton}><Text style={styles.transformText}>{copy.scaleDown}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => persistSelected(resizeRenderable(selectedItem, 1.1))} style={styles.transformButton}><Text style={styles.transformText}>{copy.scaleUp}</Text></Pressable>
      </View>
    </View> : null}
    {storedGroups.length ? <View style={styles.stored}><Text style={styles.storedTitle}>{copy.storedCollection}</Text>{storedGroups.map(([kind, holdings]) => <View key={kind} style={styles.storedGroup}><Text style={styles.storedKind}>{collectibleKindLabel(kind, copy)}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storedList}>{holdings.map((holding) => <Pressable key={holding.id} accessibilityRole="button" onPress={() => placeHolding(holding)} style={styles.storedItem}>{holding.personalMediaUrl ? <CachedSignedImage cacheKey={holding.id} url={holding.personalMediaUrl} style={styles.storedImage} /> : null}<Text numberOfLines={2} style={styles.storedItemText}>+ {holding.template.name}</Text></Pressable>)}</ScrollView></View>)}</View> : null}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, padding: spacing.lg },
  heading: { flex: 1 },
  headerActions: { flexDirection: "row", flexShrink: 0, flexWrap: "wrap", gap: spacing.xs, justifyContent: "flex-end", maxWidth: 220 },
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
  lookRow: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  lookChip: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 32, paddingHorizontal: spacing.sm },
  lookChipSelected: { backgroundColor: colors.plum, borderColor: colors.plum },
  lookChipText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
  lookChipTextSelected: { color: colors.surface },
  stage: { flex: 1, minHeight: 360, overflow: "hidden" },
  hint: { alignSelf: "center", backgroundColor: colors.surface, borderRadius: 999, bottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: "absolute" },
  hintText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  selectionColumn: { gap: spacing.xs, paddingBottom: spacing.sm },
  selectionRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center", paddingHorizontal: spacing.sm },
  selection: { color: colors.plum, flexShrink: 1, fontWeight: "700" },
  removeText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  transformRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center", paddingHorizontal: spacing.sm },
  transformButton: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, minHeight: 34, paddingHorizontal: spacing.sm, justifyContent: "center" },
  transformText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
  stored: { borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.sm },
  storedTitle: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: spacing.xs },
  storedGroup: { marginBottom: spacing.xs },
  storedKind: { color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 4, textTransform: "uppercase" },
  storedList: { gap: spacing.xs },
  storedItem: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, overflow: "hidden", width: 92 },
  storedImage: { aspectRatio: 55 / 85, width: "100%" },
  storedItemText: { color: colors.plum, fontSize: 11, fontWeight: "600", padding: spacing.xs },
  inspection: { alignItems: "center", backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  inspectionCopy: { flex: 1 },
  inspectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  inspectionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  inspectAction: { borderColor: colors.plum, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: spacing.sm },
  inspectActionText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
});

function clampCamera(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function persistRoomCamera(yaw: number, pitch: number) {
  void AsyncStorage.setItem(ROOM_CAMERA_KEY, JSON.stringify({ yaw, pitch }));
}

function groupStoredHoldings(holdings: NativeHolding[]) {
  const groups = new Map<string, NativeHolding[]>();
  for (const holding of holdings) {
    const list = groups.get(holding.template.kind) ?? [];
    list.push(holding);
    groups.set(holding.template.kind, list);
  }
  return [...groups.entries()];
}
