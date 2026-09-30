import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AccessibilityInfo, AppState, PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { loadCollectorRoom, loadNativeRoom, removeNativeRoomPlacement, saveNativeRoomPlacement, type NativeHolding, type NativeRoomPlacement, type NativeRoomSnapshot } from "../api";
import { binderSpreads, buildNativeBinderPages, spreadIndexForHolding } from "../binder/model";
import { collectibleKindLabel, type MobileCopy } from "../i18n";
import { CachedSignedImage } from "../media/cachedMedia";
import { colors, spacing } from "../theme";
import { chrome } from "../ui/shellLayout";
import { SeoullyText } from "../ui/SeoullyText";
import { cloneRenderables, holdingRemainsAfterStore, restoreEditBaseline, revertDrop, storeRenderable } from "./editSession";
import {
  buildRoomRenderables,
  buildPublicRoomRenderables,
  createInitialRoomRenderable,
  isSupportedRoomPlacement,
  moveRenderable,
  nativeHomeForHolding,
  nextNativeSlot,
  resizeRenderable,
  settleRoomRenderable,
  toPersistedTransform,
  turnRenderable,
  zoneIdForNativeSurface,
  type RoomRenderable,
} from "./model";
import { CANONICAL_ZONE_KINDS, inspectView, openBinderView, stepBack, zoneFromSurfaceId, type CanonicalZoneKind, type NativeWorldView } from "./worldView";

const NativeRoomRenderer = lazy(async () => {
  const mod = await import("./NativeRoomRenderer");
  return { default: mod.NativeRoomRenderer };
});

type RoomWorldMode = "own" | "public";

export function RoomWorldScreen({
  mode,
  userId,
  demo,
  persistLive,
  copy,
  onLeave,
  onInspectCollectible,
  onOwnRoom,
  initialHoldingId,
}: {
  mode: RoomWorldMode;
  userId?: string;
  demo: boolean;
  persistLive: boolean;
  copy: MobileCopy;
  onLeave: () => void;
  onInspectCollectible?: (holdingId: string) => void;
  onOwnRoom?: () => void;
  initialHoldingId?: string;
}) {
  const [snapshot, setSnapshot] = useState<NativeRoomSnapshot | null>(null);
  const [items, setItems] = useState<RoomRenderable[]>([]);
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [view, setView] = useState<NativeWorldView>({ kind: "home" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [privateRoom, setPrivateRoom] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [turnDir, setTurnDir] = useState<1 | -1 | 0>(0);
  const [turningSpreadIndex, setTurningSpreadIndex] = useState<number | null>(null);
  const editBaseline = useRef<RoomRenderable[]>([]);
  const dragOrigin = useRef<RoomRenderable | null>(null);
  const latestItems = useRef(items);
  const viewRef = useRef(view);
  const selectedRef = useRef(selectedId);
  const onOwnRoomRef = useRef(onOwnRoom);
  useEffect(() => { latestItems.current = items; }, [items]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { onOwnRoomRef.current = onOwnRoom; }, [onOwnRoom]);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); }, []);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setPaused(state !== "active");
      if (state === "active") setCanvasEpoch((value) => value + 1);
    });
    return () => sub.remove();
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (demo) {
        if (!__DEV__) throw new Error("demo_world_forbidden");
        const demoRoom = loadDemoRoom();
        if (mode === "public" && userId) {
          const next = demoRoom.buildFixtureRoomSnapshot(userId);
          setSnapshot(next);
          setHoldings(next.holdings);
          setItems(buildRoomRenderables(next.holdings, next.placements));
          setOwnerName(userId);
          setPrivateRoom(false);
        } else {
          const next = demoRoom.buildFixtureRoomSnapshot();
          setSnapshot(next);
          setHoldings(next.holdings);
          setItems(buildRoomRenderables(next.holdings, next.placements));
          setPrivateRoom(false);
        }
      } else if (mode === "public" && userId) {
        const publicRoom = await loadCollectorRoom(userId);
        if (publicRoom.viewerUserId && publicRoom.viewerUserId === publicRoom.owner.userId) {
          onOwnRoomRef.current?.();
          return;
        }
        setOwnerName(publicRoom.owner.displayName);
        setPrivateRoom(publicRoom.private || !publicRoom.room);
        const nextItems = publicRoom.room ? buildPublicRoomRenderables(publicRoom.room.id, publicRoom.room.placements) : [];
        setItems(nextItems);
        setHoldings(nextItems.map((item) => item.holding));
        setSnapshot(publicRoom.room ? {
          room: { id: publicRoom.room.id, ownerUserId: publicRoom.owner.userId, themeId: "hearth" },
          placements: [],
          holdings: nextItems.map((item) => item.holding),
        } : null);
      } else if (persistLive) {
        const next = await loadNativeRoom();
        setSnapshot(next);
        setHoldings(next.holdings);
        setItems(buildRoomRenderables(next.holdings, next.placements));
        setPrivateRoom(false);
      } else {
        setError(copy.demoRoomUnavailable);
        setLoading(false);
        return;
      }
      setError(null);
    } catch {
      setError(copy.roomUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.demoRoomUnavailable, copy.roomUnavailable, demo, mode, persistLive, userId]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const binderPages = useMemo(() => buildNativeBinderPages(holdings, copy.binderGeneral ?? "Your Photocards"), [copy.binderGeneral, holdings]);
  const spreads = useMemo(() => binderSpreads(binderPages), [binderPages]);
  const binderSpreadIndex = view.kind === "binder" ? Math.min(view.spread, Math.max(0, spreads.length - 1)) : 0;
  const currentSpread = spreads[binderSpreadIndex];
  const turningSpread = turningSpreadIndex != null ? spreads[turningSpreadIndex] : undefined;

  useEffect(() => {
    if (!initialHoldingId || !spreads.length) return;
    const index = spreadIndexForHolding(spreads, initialHoldingId);
    if (index < 0) return;
    const task = setTimeout(() => setView(openBinderView(index)), 0);
    return () => clearTimeout(task);
  }, [initialHoldingId, spreads]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 8,
    onPanResponderGrant: () => {
      if (viewRef.current.kind === "edit" && selectedRef.current) {
        dragOrigin.current = latestItems.current.find((item) => item.holding.id === selectedRef.current) ?? null;
      }
    },
    onPanResponderMove: (_, gesture) => {
      if (viewRef.current.kind === "edit" && selectedRef.current) {
        const origin = dragOrigin.current;
        if (!origin) return;
        const moved = moveRenderable(origin, gesture.dx * 0.008, gesture.dy * 0.008);
        setItems((current) => current.map((item) => item.holding.id === moved.holding.id ? moved : item));
        return;
      }
      if (viewRef.current.kind === "binder" && !viewRef.current.heldHoldingId && Math.abs(gesture.dx) > 48 && turnDir === 0) {
        const dir = gesture.dx < 0 ? 1 : -1;
        const to = binderSpreadIndex + dir;
        if (to >= 0 && to < spreads.length) {
          setTurnDir(dir);
          setTurningSpreadIndex(to);
        }
      }
    },
    onPanResponderRelease: () => {
      if (viewRef.current.kind !== "edit") {
        dragOrigin.current = null;
        return;
      }
      const id = selectedRef.current;
      const room = snapshot?.room;
      const current = latestItems.current.find((item) => item.holding.id === id);
      const origin = dragOrigin.current;
      dragOrigin.current = null;
      if (!id || !room || !current) return;
      if (!isSupportedRoomPlacement(current, room.id)) {
        if (origin) setItems((all) => revertDrop(all, origin));
        setError(copy.roomInvalidPlacement);
      }
    },
  });

  const placedIds = new Set(items.map((item) => item.holding.id));
  const unplaced = holdings.filter((holding) => !placedIds.has(holding.id));
  const storedGroups = groupStoredHoldings(unplaced);
  const selectedItem = items.find((item) => item.holding.id === selectedId) ?? null;
  const editing = view.kind === "edit";
  const readOnly = mode === "public";
  const themeId = snapshot?.room.themeId ?? "hearth";

  function goBack() {
    const current = viewRef.current;
    if (current.kind === "binder" && current.heldHoldingId) {
      setView({ kind: "binder", spread: current.spread });
      return;
    }
    const next = stepBack(current);
    if (next === "leave") {
      onLeave();
      return;
    }
    setSelectedId(null);
    setView(next);
  }

  function selectZone(zone: CanonicalZoneKind) {
    if (editing) return;
    if (zone === "binder") {
      openBinder();
      return;
    }
    setSelectedId(null);
    setView({ kind: "zone", zone });
  }

  function selectObject(holdingId: string) {
    const item = latestItems.current.find((entry) => entry.holding.id === holdingId);
    if (!item) {
      setSelectedId(holdingId);
      return;
    }
    if (editing) {
      setSelectedId(holdingId);
      return;
    }
    const zone = zoneFromSurfaceId(item.placement?.surfaceId, snapshot?.room.id ?? "");
    const canonical = zone === "floor" ? "desk" : zone;
    setSelectedId(holdingId);
    if (item.holding.template.kind === "photocard") {
      const index = spreadIndexForHolding(spreads, holdingId);
      setView(openBinderView(Math.max(0, index)));
      return;
    }
    setView(inspectView(canonical, holdingId));
  }

  function openBinder(holdingId?: string) {
    const index = holdingId ? spreadIndexForHolding(spreads, holdingId) : 0;
    setSelectedId(null);
    setView(openBinderView(Math.max(0, index)));
  }

  function beginEditing() {
    if (readOnly) return;
    editBaseline.current = cloneRenderables(items);
    setView({ kind: "edit" });
    setSelectedId(null);
  }

  function cancelEditing() {
    setItems(restoreEditBaseline(editBaseline.current));
    setView({ kind: "home" });
    setSelectedId(null);
  }

  function applyLocal(next: RoomRenderable) {
    const room = snapshot?.room;
    if (!room) return;
    if (!isSupportedRoomPlacement(next, room.id)) {
      setError(copy.roomInvalidPlacement);
      return;
    }
    const settled = settleRoomRenderable(next, room.id, next.placement?.surfaceId ?? undefined);
    setItems((all) => all.map((item) => item.holding.id === next.holding.id ? { ...settled.renderable, placement: item.placement } : item));
  }

  async function persistPlacement(next: RoomRenderable) {
    const room = snapshot?.room;
    if (!room) return;
    const settled = settleRoomRenderable(next, room.id, next.placement?.surfaceId ?? undefined);
    const payload = {
      roomId: room.id,
      holdingId: next.holding.id,
      zoneId: zoneIdForNativeSurface(room.id, settled.surfaceId),
      slot: next.placement?.slot ?? items.findIndex((item) => item.holding.id === next.holding.id),
      transform: toPersistedTransform(settled.renderable),
      surfaceId: settled.surfaceId,
    };
    try {
      const placement = demo ? loadDemoRoom().saveDemoPlacement(payload) : await saveNativeRoomPlacement(payload);
      setItems((all) => all.map((item) => item.holding.id === next.holding.id ? { ...settled.renderable, placement } : item));
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  async function saveEditing() {
    const room = snapshot?.room;
    if (!room) {
      setView({ kind: "home" });
      return;
    }
    const baselineIds = new Set(editBaseline.current.map((item) => item.holding.id));
    const currentIds = new Set(items.map((item) => item.holding.id));
    try {
      await Promise.all([
        ...items.map((item) => persistPlacement(item)),
        ...[...baselineIds].filter((id) => !currentIds.has(id)).map((id) => demo
          ? Promise.resolve(loadDemoRoom().removeDemoPlacement(room.id, id))
          : removeNativeRoomPlacement(room.id, id)),
      ]);
      setView({ kind: "home" });
      setSelectedId(null);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  async function placeHolding(holding: NativeHolding) {
    if (!snapshot || readOnly) return;
    const homeZone = nativeHomeForHolding(holding, snapshot.room.id, 0).zoneId;
    const slot = nextNativeSlot(items.filter((item) => item.placement?.zoneId === homeZone).map((item) => item.placement?.slot ?? 0));
    const home = nativeHomeForHolding(holding, snapshot.room.id, slot);
    const initial = createInitialRoomRenderable(holding, slot, snapshot.room.id);
    const settled = settleRoomRenderable(initial, snapshot.room.id, home.surfaceId);
    try {
      const payload = {
        roomId: snapshot.room.id,
        holdingId: holding.id,
        zoneId: home.zoneId,
        slot,
        transform: toPersistedTransform(settled.renderable),
        surfaceId: settled.surfaceId,
      };
      const placement: NativeRoomPlacement = demo ? loadDemoRoom().saveDemoPlacement(payload) : await saveNativeRoomPlacement(payload);
      setItems((current) => [...current, { ...settled.renderable, placement }]);
      setSelectedId(holding.id);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  async function storeSelected() {
    if (!snapshot || !selectedId || readOnly) return;
    const kept = holdings;
    void holdingRemainsAfterStore(kept, selectedId);
    try {
      if (demo) loadDemoRoom().removeDemoPlacement(snapshot.room.id, selectedId);
      else await removeNativeRoomPlacement(snapshot.room.id, selectedId);
      setItems((current) => storeRenderable(current, selectedId));
      setSelectedId(null);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  const hint = editing
    ? copy.roomDragHint
    : view.kind === "binder"
      ? copy.binderLead
      : view.kind === "home"
        ? copy.roomWalkHint
        : copy.roomBackHint;

  if (privateRoom && !loading) {
    return <View style={styles.container}>
      <Header copy={copy} title={ownerName || copy.room} lead={copy.collectorRoomLead} onBack={onLeave} />
      <SeoullyText variant="secondary" style={styles.empty}>{copy.roomPrivate}</SeoullyText>
    </View>;
  }

  return <View style={styles.container}>
    <Header
      copy={copy}
      title={mode === "public" ? (ownerName || copy.room) : copy.room}
      lead={mode === "public" ? copy.collectorRoomLead : copy.roomLead}
      onBack={goBack}
      editing={editing}
      readOnly={readOnly}
      onEdit={beginEditing}
      onCancel={cancelEditing}
      onSave={() => void saveEditing()}
    />
    {error ? <Pressable onPress={() => void refresh()}><SeoullyText variant="secondary" color={colors.plum} style={styles.error}>{error} · {copy.retry}</SeoullyText></Pressable> : null}
    {!loading && snapshot ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lookRow}>
      <LookChip label={copy.roomLookHome} selected={view.kind === "home"} onPress={() => { setSelectedId(null); setView({ kind: "home" }); }} />
      {CANONICAL_ZONE_KINDS.map((zone) => (
        <LookChip
          key={zone}
          label={zoneLabel(zone, copy)}
          selected={(view.kind === "zone" && view.zone === zone) || (view.kind === "binder" && zone === "binder")}
          onPress={() => selectZone(zone)}
        />
      ))}
    </ScrollView> : null}
    {!loading && snapshot ? <View style={styles.stage} {...panResponder.panHandlers}>
      <Suspense fallback={<SeoullyText variant="secondary" style={styles.empty}>{copy.room}</SeoullyText>}>
        <NativeRoomRenderer
          key={canvasEpoch}
          items={items}
          selectedId={selectedId}
          focusedId={editing ? null : selectedId}
          themeId={themeId}
          view={view}
          binderSpread={currentSpread}
          turningSpread={turningSpread}
          turnDir={turnDir}
          reducedMotion={reducedMotion}
          paused={paused}
          readOnly={readOnly}
          onSelectZone={selectZone}
          onSelect={selectObject}
          onClearSelection={() => {
            if (view.kind === "inspect") setView({ kind: "zone", zone: view.zone });
            setSelectedId(null);
          }}
          onOpenBinder={readOnly || editing ? undefined : () => openBinder()}
          onHoldCard={(holding) => {
            if (view.kind !== "binder") return;
            setView({ kind: "binder", spread: view.spread, ...(holding ? { heldHoldingId: holding.id } : {}) });
          }}
          onTurnEdge={(dir) => {
            const to = binderSpreadIndex + dir;
            if (to < 0 || to >= spreads.length || turnDir !== 0) return;
            if (reducedMotion) {
              setView({ kind: "binder", spread: to });
              return;
            }
            setTurnDir(dir);
            setTurningSpreadIndex(to);
          }}
          onTurnComplete={() => {
            if (turningSpreadIndex == null) return;
            setView({ kind: "binder", spread: turningSpreadIndex });
            setTurnDir(0);
            setTurningSpreadIndex(null);
          }}
        />
      </Suspense>
      <View pointerEvents="none" style={styles.hint}><SeoullyText variant="caption" color={colors.ink} style={styles.hintText}>{hint}</SeoullyText></View>
    </View> : null}
    {selectedItem && !editing && view.kind !== "binder" ? <View style={styles.inspection}>
      <View style={styles.inspectionCopy}>
        <SeoullyText numberOfLines={1} variant="handle" style={styles.inspectionTitle}>{selectedItem.holding.template.name}</SeoullyText>
        <SeoullyText numberOfLines={1} variant="caption" style={styles.inspectionMeta}>{[selectedItem.holding.template.groupName, selectedItem.holding.template.memberName, collectibleKindLabel(selectedItem.holding.template.kind, copy)].filter(Boolean).join(" · ")}</SeoullyText>
      </View>
      {onInspectCollectible && !readOnly ? <Pressable onPress={() => onInspectCollectible(selectedItem.holding.id)} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.viewCollectible}</SeoullyText></Pressable> : null}
      {selectedItem.holding.template.kind === "photocard" && !readOnly ? <Pressable onPress={() => openBinder(selectedItem.holding.id)} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.openBinder}</SeoullyText></Pressable> : null}
      <Pressable onPress={goBack} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.close}</SeoullyText></Pressable>
    </View> : null}
    {view.kind === "binder" && view.heldHoldingId ? <View style={styles.inspection}>
      <SeoullyText variant="handle" style={styles.inspectionTitle}>{holdings.find((item) => item.id === view.heldHoldingId)?.template.name ?? copy.binder}</SeoullyText>
      <Pressable onPress={() => setView({ kind: "binder", spread: view.spread })} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.returnToBinder}</SeoullyText></Pressable>
    </View> : null}
    {selectedItem && editing ? <View style={styles.selectionColumn}>
      <View style={styles.selectionRow}><SeoullyText numberOfLines={1} variant="handle" color={colors.plum} style={styles.selection}>{selectedItem.holding.template.name}</SeoullyText><Pressable onPress={() => void storeSelected()}><SeoullyText variant="caption" color={colors.muted}>{copy.removeFromRoom}</SeoullyText></Pressable></View>
      <View style={styles.transformRow}>
        <Pressable onPress={() => applyLocal(turnRenderable(selectedItem, -Math.PI / 12))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.rotateLeft}</SeoullyText></Pressable>
        <Pressable onPress={() => applyLocal(turnRenderable(selectedItem, Math.PI / 12))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.rotateRight}</SeoullyText></Pressable>
        <Pressable onPress={() => applyLocal(resizeRenderable(selectedItem, 0.9))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.scaleDown}</SeoullyText></Pressable>
        <Pressable onPress={() => applyLocal(resizeRenderable(selectedItem, 1.1))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.scaleUp}</SeoullyText></Pressable>
      </View>
    </View> : null}
    {editing && storedGroups.length ? <View style={styles.stored}><SeoullyText variant="handle" style={styles.storedTitle}>{copy.storedCollection}</SeoullyText>{storedGroups.map(([kind, group]) => <View key={kind} style={styles.storedGroup}><SeoullyText variant="caption" color={colors.muted} style={styles.storedKind}>{collectibleKindLabel(kind, copy)}</SeoullyText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storedList}>{group.map((holding) => <Pressable key={holding.id} onPress={() => void placeHolding(holding)} style={styles.storedItem}>{holding.personalMediaUrl ? <CachedSignedImage cacheKey={holding.id} url={holding.personalMediaUrl} style={styles.storedImage} /> : null}<SeoullyText numberOfLines={2} variant="caption" color={colors.plum} style={styles.storedItemText}>+ {holding.template.name}</SeoullyText></Pressable>)}</ScrollView></View>)}</View> : null}
  </View>;
}

function Header({
  copy,
  title,
  lead,
  onBack,
  editing,
  readOnly,
  onEdit,
  onCancel,
  onSave,
}: {
  copy: MobileCopy;
  title: string;
  lead: string;
  onBack: () => void;
  editing?: boolean;
  readOnly?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
}) {
  return <View style={styles.header}>
    <View style={styles.heading}>
      <Pressable accessibilityRole="button" onPress={onBack}><SeoullyText variant="button" color={colors.plum}>{copy.back}</SeoullyText></Pressable>
      <SeoullyText variant="title" style={styles.title}>{title}</SeoullyText>
      <SeoullyText variant="secondary" style={styles.lead}>{lead}</SeoullyText>
    </View>
    {readOnly || !onEdit ? null : <View style={styles.headerActions}>
      {editing ? <Pressable onPress={onCancel} style={styles.editButton}><SeoullyText variant="button" color={colors.surface}>{copy.cancelEditing}</SeoullyText></Pressable> : null}
      <Pressable onPress={editing ? onSave : onEdit} style={styles.editButton}><SeoullyText variant="button" color={colors.surface}>{editing ? copy.finishEditing : copy.editRoom}</SeoullyText></Pressable>
    </View>}
  </View>;
}

function LookChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.lookChip, selected && styles.lookChipSelected]}>
    <SeoullyText variant="caption" color={selected ? colors.surface : colors.plum} style={styles.lookChipText}>{label}</SeoullyText>
  </Pressable>;
}

function zoneLabel(zone: CanonicalZoneKind, copy: MobileCopy) {
  if (zone === "shelf") return copy.roomLookShelf;
  if (zone === "wall") return copy.roomLookWall;
  if (zone === "case") return copy.roomLookCase;
  if (zone === "desk") return copy.roomLookDesk;
  if (zone === "binder") return copy.roomLookBinder;
  return copy.roomLookArchive;
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

function loadDemoRoom(): typeof import("./demoRoom") {
  if (__DEV__) {
    // Dev-only fixture world. Production Metro never evaluates this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./demoRoom") as typeof import("./demoRoom");
  }
  throw new Error("demo_world_forbidden");
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.canvas, flex: 1 },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, paddingHorizontal: chrome.gutter, paddingVertical: spacing.sm },
  heading: { flex: 1, minWidth: 0 },
  back: { color: colors.plum, fontSize: 14, fontWeight: "700", marginBottom: 4 },
  headerActions: { flexDirection: "row", flexShrink: 0, flexWrap: "wrap", gap: spacing.xs, justifyContent: "flex-end", maxWidth: 220 },
  title: { fontSize: 30, lineHeight: 36 },
  lead: { marginTop: spacing.xs },
  editButton: { backgroundColor: colors.plum, borderRadius: 12, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  editButtonText: { color: colors.surface, fontWeight: "700" },
  error: { paddingHorizontal: chrome.gutter },
  empty: { padding: chrome.gutter },
  lookRow: { gap: spacing.xs, paddingBottom: spacing.xs, paddingHorizontal: spacing.md },
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
  transformButton: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: spacing.sm },
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
