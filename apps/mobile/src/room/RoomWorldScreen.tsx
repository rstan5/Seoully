import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { AccessibilityInfo, Animated, AppState, Easing, PanResponder, Pressable, ScrollView, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadCollectorRoom, loadNativeRoom, removeNativeRoomPlacement, saveNativeRoomPlacement, type NativeHolding, type NativeRoomPlacement, type NativeRoomSnapshot } from "../api";
import { binderSpreads, buildNativeBinderPages, spreadIndexForHolding } from "../binder/model";
import { collectibleKindLabel, type MobileCopy } from "../i18n";
import { CachedSignedImage } from "../media/cachedMedia";
import { colors, spacing } from "../theme";
import { chrome, immersiveRoomFill } from "../ui/shellLayout";
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
import {
  IDENTITY_EXPLORE,
  exploreAllowedForView,
  nudgeExploreFromDrag,
  nudgeExploreFromPinch,
  type ExploreOffset,
  type ExploreSpace,
} from "./camera";
import { entranceForeground, roomEntranceCopy } from "./entrance";
import { roomOverlayChrome, roomPalette } from "./theme";
import { inspectView, openBinderView, stepBack, zoneFromSurfaceId, type CanonicalZoneKind, type NativeWorldView } from "./worldView";

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
  const insets = useSafeAreaInsets();
  const editBaseline = useRef<RoomRenderable[]>([]);
  const dragOrigin = useRef<RoomRenderable | null>(null);
  const latestItems = useRef(items);
  const viewRef = useRef(view);
  const selectedRef = useRef(selectedId);
  const onOwnRoomRef = useRef(onOwnRoom);
  const exploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const homeExploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const frozenExploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const gestureRef = useRef({ lastDx: 0, lastDy: 0, pinching: false, pinchStart: 0, dollyStart: 1 });
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
          setOwnerName(demoRoom.demoCollectorDisplayName(userId));
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
    onMoveShouldSetPanResponder: (event, gesture) => {
      if (viewRef.current.kind === "inspect") return false;
      if (event.nativeEvent.touches.length >= 2 && exploreAllowedForView(viewRef.current)) return true;
      return Math.hypot(gesture.dx, gesture.dy) > 10;
    },
    onPanResponderGrant: (event) => {
      gestureRef.current.lastDx = 0;
      gestureRef.current.lastDy = 0;
      const span = touchSpan(event);
      if (span > 0 && exploreAllowedForView(viewRef.current)) {
        gestureRef.current.pinching = true;
        gestureRef.current.pinchStart = span;
        gestureRef.current.dollyStart = exploreRef.current.dolly;
      } else {
        gestureRef.current.pinching = false;
      }
      if (viewRef.current.kind === "edit" && selectedRef.current) {
        dragOrigin.current = latestItems.current.find((item) => item.holding.id === selectedRef.current) ?? null;
      }
    },
    onPanResponderMove: (event, gesture) => {
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
        return;
      }
      if (!exploreAllowedForView(viewRef.current)) return;
      const space: ExploreSpace = viewRef.current.kind === "zone" ? "zone" : "home";
      if (event.nativeEvent.touches.length >= 2) {
        const span = touchSpan(event);
        if (!gestureRef.current.pinching) {
          gestureRef.current.pinching = true;
          gestureRef.current.pinchStart = span;
          gestureRef.current.dollyStart = exploreRef.current.dolly;
        }
        exploreRef.current = nudgeExploreFromPinch(
          exploreRef.current,
          gestureRef.current.dollyStart,
          gestureRef.current.pinchStart,
          span,
          space,
        );
        return;
      }
      if (gestureRef.current.pinching) return;
      const ddx = gesture.dx - gestureRef.current.lastDx;
      const ddy = gesture.dy - gestureRef.current.lastDy;
      gestureRef.current.lastDx = gesture.dx;
      gestureRef.current.lastDy = gesture.dy;
      exploreRef.current = nudgeExploreFromDrag(exploreRef.current, ddx, ddy, space);
    },
    onPanResponderRelease: () => {
      gestureRef.current.pinching = false;
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
    onPanResponderTerminate: () => {
      gestureRef.current.pinching = false;
    },
  });

  const placedIds = new Set(items.map((item) => item.holding.id));
  const unplaced = holdings.filter((holding) => !placedIds.has(holding.id));
  const storedGroups = groupStoredHoldings(unplaced);
  const selectedItem = items.find((item) => item.holding.id === selectedId) ?? null;
  const editing = view.kind === "edit";
  const readOnly = mode === "public";
  const themeId = snapshot?.room.themeId ?? "hearth";
  const entranceLabel = roomEntranceCopy({
    mode,
    displayName: ownerName,
    fallbackName: copy.collectorFallback,
    ownLabel: copy.enteringYourRoom,
    visitorLabel: copy.enteringCollectorRoom,
  });
  const roomTheme = roomPalette(themeId);
  const entranceTone = entranceForeground(roomTheme.void);
  const overlayTheme = roomOverlayChrome(roomTheme);

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
    if (current.kind === "inspect") {
      exploreRef.current = { ...frozenExploreRef.current };
    } else if (current.kind === "zone" || current.kind === "edit" || (current.kind === "binder" && next.kind === "home")) {
      exploreRef.current = { ...homeExploreRef.current };
    } else if (next.kind === "home") {
      exploreRef.current = { ...homeExploreRef.current };
    }
    if (next.kind === "zone" && current.kind === "binder") {
      exploreRef.current = { ...IDENTITY_EXPLORE };
    }
    setSelectedId(null);
    setView(next);
  }

  function selectZone(zone: CanonicalZoneKind) {
    if (editing) return;
    if (viewRef.current.kind === "home") homeExploreRef.current = { ...exploreRef.current };
    exploreRef.current = { ...IDENTITY_EXPLORE };
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
    frozenExploreRef.current = { ...exploreRef.current };
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
    if (viewRef.current.kind === "home") homeExploreRef.current = { ...exploreRef.current };
    exploreRef.current = { ...IDENTITY_EXPLORE };
    editBaseline.current = cloneRenderables(items);
    setView({ kind: "edit" });
    setSelectedId(null);
  }

  function cancelEditing() {
    setItems(restoreEditBaseline(editBaseline.current));
    exploreRef.current = { ...homeExploreRef.current };
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
      exploreRef.current = { ...homeExploreRef.current };
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
      : null;
  const overlayPad = {
    paddingTop: insets.top + 8,
    paddingLeft: Math.max(insets.left, chrome.gutter),
    paddingRight: Math.max(insets.right, chrome.gutter),
  };
  const trayPad = {
    paddingBottom: insets.bottom + chrome.companionClearance,
    paddingRight: chrome.companionSize + chrome.gutter + chrome.companionClearance,
  };

  if (privateRoom && !loading) {
    return <View style={[styles.world, immersiveRoomFill(roomTheme.void)]}>
      <Stack.Screen options={{ contentStyle: immersiveRoomFill(roomTheme.void) }} />
      <OverlayChrome
        copy={copy}
        chrome={overlayTheme}
        onBack={onLeave}
        style={overlayPad}
      />
      <RoomEntranceTitle key={entranceLabel} label={entranceLabel} color={entranceTone.color} shadow={entranceTone.shadow} reducedMotion={reducedMotion} />
      <SeoullyText variant="secondary" style={styles.empty}>{copy.roomPrivate}</SeoullyText>
    </View>;
  }

  return <View style={[styles.world, immersiveRoomFill(roomTheme.void)]}>
    <Stack.Screen options={{ contentStyle: immersiveRoomFill(roomTheme.void) }} />
    {!loading && snapshot ? <View style={styles.stage} {...panResponder.panHandlers}>
      <Suspense fallback={null}>
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
          exploreRef={exploreRef}
          onSelectZone={selectZone}
          onSelect={selectObject}
          onClearSelection={() => {
            if (view.kind === "inspect") {
              exploreRef.current = { ...frozenExploreRef.current };
              setView({ kind: "zone", zone: view.zone });
            }
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
    </View> : null}
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <OverlayChrome
        copy={copy}
        chrome={overlayTheme}
        onBack={goBack}
        editing={editing}
        readOnly={readOnly}
        onEdit={beginEditing}
        onCancel={cancelEditing}
        onSave={() => void saveEditing()}
        style={overlayPad}
      />
      {!loading ? <RoomEntranceTitle key={entranceLabel} label={entranceLabel} color={entranceTone.color} shadow={entranceTone.shadow} reducedMotion={reducedMotion} /> : null}
      {error ? <Pressable onPress={() => void refresh()} style={styles.error}><SeoullyText variant="secondary" color={colors.plum}>{error} · {copy.retry}</SeoullyText></Pressable> : null}
      {hint ? <View pointerEvents="none" style={[styles.hint, { bottom: insets.bottom + chrome.companionSize + chrome.gutter }]}><SeoullyText variant="caption" color={colors.ink} style={styles.hintText}>{hint}</SeoullyText></View> : null}
      {selectedItem && !editing && view.kind !== "binder" ? <View style={[styles.inspection, trayPad]}>
        <View style={styles.inspectionCopy}>
          <SeoullyText numberOfLines={1} variant="handle" style={styles.inspectionTitle}>{selectedItem.holding.template.name}</SeoullyText>
          <SeoullyText numberOfLines={1} variant="caption" style={styles.inspectionMeta}>{[selectedItem.holding.template.groupName, selectedItem.holding.template.memberName, collectibleKindLabel(selectedItem.holding.template.kind, copy)].filter(Boolean).join(" · ")}</SeoullyText>
        </View>
        {onInspectCollectible && !readOnly ? <Pressable onPress={() => onInspectCollectible(selectedItem.holding.id)} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.viewCollectible}</SeoullyText></Pressable> : null}
        {selectedItem.holding.template.kind === "photocard" && !readOnly ? <Pressable onPress={() => openBinder(selectedItem.holding.id)} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.openBinder}</SeoullyText></Pressable> : null}
        <Pressable onPress={goBack} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.close}</SeoullyText></Pressable>
      </View> : null}
      {view.kind === "binder" && view.heldHoldingId ? <View style={[styles.inspection, trayPad]}>
        <SeoullyText variant="handle" style={styles.inspectionTitle}>{holdings.find((item) => item.id === view.heldHoldingId)?.template.name ?? copy.binder}</SeoullyText>
        <Pressable onPress={() => setView({ kind: "binder", spread: view.spread })} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.returnToBinder}</SeoullyText></Pressable>
      </View> : null}
      {editing ? <View style={[styles.editTray, trayPad]}>
        {selectedItem ? <>
          <View style={styles.selectionRow}><SeoullyText numberOfLines={1} variant="handle" color={colors.plum} style={styles.selection}>{selectedItem.holding.template.name}</SeoullyText><Pressable onPress={() => void storeSelected()}><SeoullyText variant="caption" color={colors.muted}>{copy.removeFromRoom}</SeoullyText></Pressable></View>
          <View style={styles.transformRow}>
            <Pressable onPress={() => applyLocal(turnRenderable(selectedItem, -Math.PI / 12))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.rotateLeft}</SeoullyText></Pressable>
            <Pressable onPress={() => applyLocal(turnRenderable(selectedItem, Math.PI / 12))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.rotateRight}</SeoullyText></Pressable>
            <Pressable onPress={() => applyLocal(resizeRenderable(selectedItem, 0.9))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.scaleDown}</SeoullyText></Pressable>
            <Pressable onPress={() => applyLocal(resizeRenderable(selectedItem, 1.1))} style={styles.transformButton}><SeoullyText variant="caption" color={colors.plum}>{copy.scaleUp}</SeoullyText></Pressable>
          </View>
        </> : null}
        {storedGroups.length ? <View style={styles.stored}><SeoullyText variant="handle" style={styles.storedTitle}>{copy.storedCollection}</SeoullyText>{storedGroups.map(([kind, group]) => <View key={kind} style={styles.storedGroup}><SeoullyText variant="caption" color={colors.muted} style={styles.storedKind}>{collectibleKindLabel(kind, copy)}</SeoullyText><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storedList}>{group.map((holding) => <Pressable key={holding.id} onPress={() => void placeHolding(holding)} style={styles.storedItem}>{holding.personalMediaUrl ? <CachedSignedImage cacheKey={holding.id} url={holding.personalMediaUrl} style={styles.storedImage} /> : null}<SeoullyText numberOfLines={2} variant="caption" color={colors.plum} style={styles.storedItemText}>+ {holding.template.name}</SeoullyText></Pressable>)}</ScrollView></View>)}</View> : null}
      </View> : null}
    </View>
  </View>;
}

function OverlayChrome({
  copy,
  chrome,
  onBack,
  editing,
  readOnly,
  onEdit,
  onCancel,
  onSave,
  style,
}: {
  copy: MobileCopy;
  chrome: ReturnType<typeof roomOverlayChrome>;
  onBack: () => void;
  editing?: boolean;
  readOnly?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  style?: object;
}) {
  const chip = [styles.overlayChip, { backgroundColor: chrome.background, borderColor: chrome.border }];
  return <View pointerEvents="box-none" style={[styles.overlayBar, style]}>
    <Pressable accessibilityRole="button" onPress={onBack} style={chip}>
      <SeoullyText variant="button" color={chrome.color}>{copy.back}</SeoullyText>
    </Pressable>
    <View style={styles.overlaySpacer} />
    {readOnly || !onEdit ? <View style={styles.overlaySpacer} /> : <View style={styles.overlayActions}>
      {editing ? <Pressable onPress={onCancel} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.cancelEditing}</SeoullyText></Pressable> : null}
      <Pressable onPress={editing ? onSave : onEdit} style={chip}>
        <SeoullyText variant="button" color={chrome.color}>{editing ? copy.finishEditing : copy.editRoom}</SeoullyText>
      </Pressable>
    </View>}
  </View>;
}

function RoomEntranceTitle({
  label,
  color,
  shadow,
  reducedMotion,
}: {
  label: string;
  color: string;
  shadow: string;
  reducedMotion: boolean;
}) {
  const [opacity] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let cancelled = false;
    opacity.setValue(reducedMotion ? 1 : 0);
    if (reducedMotion) {
      const hide = setTimeout(() => { if (!cancelled) setVisible(false); }, 1800);
      return () => { cancelled = true; clearTimeout(hide); };
    }
    const fade = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(opacity, { toValue: 0, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    fade.start(({ finished }) => { if (finished && !cancelled) setVisible(false); });
    return () => { cancelled = true; fade.stop(); };
  }, [label, opacity, reducedMotion]);
  if (!visible) return null;
  return <Animated.View pointerEvents="none" style={[styles.entrance, { opacity }]}>
    <SeoullyText variant="title" color={color} style={[styles.entranceText, { textShadowColor: shadow }]}>{label}</SeoullyText>
  </Animated.View>;
}

function touchSpan(event: GestureResponderEvent) {
  const touches = event.nativeEvent.touches;
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
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
  world: { flex: 1 },
  overlayBar: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  overlayChip: { alignItems: "center", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: spacing.sm },
  overlaySpacer: { flex: 1 },
  entrance: { alignItems: "center", bottom: 0, justifyContent: "center", left: 0, paddingHorizontal: 28, position: "absolute", right: 0, top: 0 },
  entranceText: { fontSize: 22, lineHeight: 28, textAlign: "center", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  overlayActions: { flexDirection: "row", flexShrink: 0, gap: spacing.xs },
  error: { paddingHorizontal: chrome.gutter, paddingTop: spacing.xs },
  empty: { padding: chrome.gutter },
  stage: StyleSheet.absoluteFill,
  hint: { alignSelf: "center", backgroundColor: "rgba(247,241,244,0.88)", borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: "absolute" },
  hintText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  editTray: { backgroundColor: "rgba(247,241,244,0.94)", borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, gap: spacing.xs, left: 0, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, position: "absolute", right: 0 },
  selectionColumn: { gap: spacing.xs },
  selectionRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  selection: { color: colors.plum, flexShrink: 1, fontWeight: "700" },
  transformRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center" },
  transformButton: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: spacing.sm },
  stored: { paddingTop: spacing.xs },
  storedTitle: { color: colors.ink, fontSize: 13, fontWeight: "700", marginBottom: spacing.xs },
  storedGroup: { marginBottom: spacing.xs },
  storedKind: { color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 4, textTransform: "uppercase" },
  storedList: { gap: spacing.xs },
  storedItem: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, overflow: "hidden", width: 92 },
  storedImage: { aspectRatio: 55 / 85, width: "100%" },
  storedItemText: { color: colors.plum, fontSize: 11, fontWeight: "600", padding: spacing.xs },
  inspection: { alignItems: "center", backgroundColor: "rgba(247,241,244,0.94)", borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, flexDirection: "row", gap: spacing.sm, left: 0, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, position: "absolute", right: 0 },
  inspectionCopy: { flex: 1 },
  inspectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  inspectionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  inspectAction: { borderColor: colors.plum, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: spacing.sm },
  inspectActionText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
});
