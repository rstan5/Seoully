import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { AccessibilityInfo, Animated, AppState, Easing, PanResponder, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadCollectorRoom, loadNativeRoom, removeNativeRoomPlacement, saveNativeRoomPlacement, saveNativeRoomStyle, type NativeHolding, type NativeRoomSnapshot } from "../api";
import { binderSpreads, buildNativeBinderPages, spreadIndexForHolding } from "../binder/model";
import { collectibleKindLabel, type MobileCopy } from "../i18n";
import { colors, spacing } from "../theme";
import { chrome, immersiveRoomFill } from "../ui/shellLayout";
import { SeoullyText } from "../ui/SeoullyText";
import { cloneRenderables, holdingRemainsAfterStore, isStoredHistoryMarker, pushPlacementHistory, restoreEditBaseline, revertDrop, storeRenderable, type PlacementHistoryEntry } from "./editSession";
import {
  buildRoomRenderables,
  buildPublicRoomRenderables,
  createInitialRoomRenderable,
  isSupportedRoomPlacement,
  nextNativeSlot,
  settleRoomRenderable,
  toPersistedTransform,
  zoneIdForNativeSurface,
  type RoomRenderable,
} from "./model";
import {
  IDENTITY_EXPLORE,
  applyExploreOffset,
  exploreAllowedForView,
  nudgeExploreFromDrag,
  nudgeExploreFromPinch,
  poseForView,
  type ExploreOffset,
  type ExploreSpace,
} from "./camera";
import {
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
  acquireHeld,
  acquirePlaceFromStorage,
  cloneRenderable,
  compatibleSurfaces,
  placementsMatch,
  projectTouchOntoSurfaces,
  type HeldEdit,
} from "./touchEdit";
import { StoredCollectionSheet } from "./StoredCollectionSheet";
import { RoomStyleSheet } from "./RoomStyleSheet";
import { DEFAULT_ROOM_STYLE, defaultStyleForTheme, parseRoomStyle, resolveRoomLook, type NativeRoomStyle } from "./roomStyle";
import { entranceForeground, roomEntranceCopy } from "./entrance";
import { roomOverlayChrome } from "./theme";
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
  const [heldId, setHeldId] = useState<string | null>(null);
  const [placingItem, setPlacingItem] = useState<RoomRenderable | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);
  const [storageQuery, setStorageQuery] = useState("");
  const [roomStyle, setRoomStyle] = useState<NativeRoomStyle>(DEFAULT_ROOM_STYLE);
  const [styleOpen, setStyleOpen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const insets = useSafeAreaInsets();
  const editBaseline = useRef<RoomRenderable[]>([]);
  const latestItems = useRef(items);
  const viewRef = useRef(view);
  const selectedRef = useRef(selectedId);
  const onOwnRoomRef = useRef(onOwnRoom);
  const snapshotRef = useRef(snapshot);
  const reducedMotionRef = useRef(reducedMotion);
  const exploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const homeExploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const frozenExploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const gestureRef = useRef({ lastDx: 0, lastDy: 0, pinching: false, pinchStart: 0, dollyStart: 1, objectDrag: false, releasing: false });
  const heldRef = useRef<HeldEdit | null>(null);
  const previewRef = useRef<RoomRenderable | null>(null);
  const highlightSurfaceIdRef = useRef<string | null>(null);
  const pendingPressRef = useRef<{ holdingId: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressTapRef = useRef(false);
  const undoStack = useRef<PlacementHistoryEntry<RoomRenderable>[]>([]);
  const redoStack = useRef<PlacementHistoryEntry<RoomRenderable>[]>([]);
  const styleBaseline = useRef<NativeRoomStyle>(DEFAULT_ROOM_STYLE);
  const binderReturnRef = useRef<{ view: NativeWorldView; explore: ExploreOffset } | null>(null);
  const layoutRef = useRef({ width: 1, height: 1, x: 0, y: 0 });
  const stageRef = useRef<View>(null);
  useEffect(() => { latestItems.current = items; }, [items]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { onOwnRoomRef.current = onOwnRoom; }, [onOwnRoom]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
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
          setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
          setOwnerName(demoRoom.demoCollectorDisplayName(userId));
          setPrivateRoom(false);
        } else {
          const next = demoRoom.buildFixtureRoomSnapshot();
          setSnapshot(next);
          setHoldings(next.holdings);
          setItems(buildRoomRenderables(next.holdings, next.placements));
          setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
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
        setRoomStyle(parseRoomStyle(publicRoom.room?.style, DEFAULT_ROOM_STYLE));
        setSnapshot(publicRoom.room ? {
          room: { id: publicRoom.room.id, ownerUserId: publicRoom.owner.userId, themeId: "hearth", style: parseRoomStyle(publicRoom.room.style) },
          placements: [],
          holdings: nextItems.map((item) => item.holding),
        } : null);
      } else if (persistLive) {
        const next = await loadNativeRoom();
        setSnapshot(next);
        setHoldings(next.holdings);
        setItems(buildRoomRenderables(next.holdings, next.placements));
        setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
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
    const task = setTimeout(() => {
      binderReturnRef.current = { view: { kind: "home" }, explore: { ...exploreRef.current } };
      setView(openBinderView(index));
    }, 0);
    return () => clearTimeout(task);
  }, [initialHoldingId, spreads]);

  function clearPendingPress() {
    if (pendingPressRef.current) clearTimeout(pendingPressRef.current.timer);
    pendingPressRef.current = null;
  }

  function clearHeldVisual() {
    heldRef.current = null;
    previewRef.current = null;
    highlightSurfaceIdRef.current = null;
    gestureRef.current.objectDrag = false;
    setHeldId(null);
    setPlacingItem(null);
  }

  function syncHistory() {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }

  function rememberPlacement(before: RoomRenderable | { storedHoldingId: string }, after: RoomRenderable | { storedHoldingId: string }) {
    if (!isStoredHistoryMarker(before) && !isStoredHistoryMarker(after) && placementsMatch(before, after)) return;
    pushPlacementHistory(undoStack.current, redoStack.current, {
      before: isStoredHistoryMarker(before) ? before : cloneRenderable(before),
      after: isStoredHistoryMarker(after) ? after : cloneRenderable(after),
    });
    syncHistory();
  }

  /* PanResponder callbacks fire on gestures and read live refs, not render values. */
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (event, gesture) => {
      if (viewRef.current.kind === "inspect") return false;
      if (heldRef.current) return Math.hypot(gesture.dx, gesture.dy) > 2;
      if (pendingPressRef.current && Math.hypot(gesture.dx, gesture.dy) > LONG_PRESS_SLOP_PX) {
        if (pendingPressRef.current) clearTimeout(pendingPressRef.current.timer);
        pendingPressRef.current = null;
      }
      if (event.nativeEvent.touches.length >= 2 && exploreAllowedForView(viewRef.current)) return true;
      return Math.hypot(gesture.dx, gesture.dy) > 10;
    },
    onPanResponderGrant: (event) => {
      gestureRef.current.lastDx = 0;
      gestureRef.current.lastDy = 0;
      gestureRef.current.objectDrag = Boolean(heldRef.current);
      const span = touchSpan(event);
      if (span > 0 && exploreAllowedForView(viewRef.current) && !heldRef.current) {
        gestureRef.current.pinching = true;
        gestureRef.current.pinchStart = span;
        gestureRef.current.dollyStart = exploreRef.current.dolly;
      } else {
        gestureRef.current.pinching = false;
      }
    },
    onPanResponderMove: (event, gesture) => {
      if (heldRef.current) {
        gestureRef.current.objectDrag = true;
        const held = heldRef.current;
        const room = snapshotRef.current?.room;
        if (!held || !room) return;
        const pose = applyExploreOffset(poseForView(viewRef.current, null), exploreRef.current, "home");
        const candidate = projectTouchOntoSurfaces(
          gesture.moveX - layoutRef.current.x,
          gesture.moveY - layoutRef.current.y,
          layoutRef.current.width,
          layoutRef.current.height,
          pose,
          room.id,
          held.origin ?? held.rest,
          reducedMotionRef.current,
        );
        if (!candidate) {
          held.valid = false;
          held.surfaceId = null;
          highlightSurfaceIdRef.current = null;
          return;
        }
        held.preview = candidate.preview;
        held.rest = candidate.rest;
        held.valid = candidate.valid;
        held.surfaceId = candidate.valid ? candidate.surface.id : null;
        previewRef.current = candidate.preview;
        highlightSurfaceIdRef.current = held.surfaceId;
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
      if (heldRef.current) void releaseHeld();
    },
    onPanResponderTerminate: () => {
      gestureRef.current.pinching = false;
      if (heldRef.current) void releaseHeld();
    },
  });

  const placedIds = new Set(items.map((item) => item.holding.id));
  const unplaced = holdings.filter((holding) => !placedIds.has(holding.id));
  const selectedItem = items.find((item) => item.holding.id === selectedId) ?? null;
  const editing = view.kind === "edit";
  const readOnly = mode === "public";
  const themeId = snapshot?.room.themeId ?? "hearth";
  const roomTheme = resolveRoomLook(roomStyle);
  const entranceLabel = roomEntranceCopy({
    mode,
    displayName: ownerName,
    fallbackName: copy.collectorFallback,
    ownLabel: copy.enteringYourRoom,
    visitorLabel: copy.enteringCollectorRoom,
  });
  const entranceTone = entranceForeground(roomTheme.void);
  const overlayTheme = roomOverlayChrome(roomTheme);

  function goBack() {
    const current = viewRef.current;
    if (placingItem) {
      clearPendingPress();
      clearHeldVisual();
      return;
    }
    if (current.kind === "binder" && current.heldHoldingId) {
      setView({ kind: "binder", spread: current.spread });
      return;
    }
    if (current.kind === "binder") {
      closeBinder();
      return;
    }
    const next = stepBack(current);
    if (next === "leave") {
      onLeave();
      return;
    }
    if (current.kind === "inspect") {
      exploreRef.current = { ...frozenExploreRef.current };
    } else if (current.kind === "zone" || current.kind === "edit") {
      exploreRef.current = { ...homeExploreRef.current };
    } else if (next.kind === "home") {
      exploreRef.current = { ...homeExploreRef.current };
    }
    if (current.kind === "edit") {
      clearPendingPress();
      clearHeldVisual();
    }
    setSelectedId(null);
    setView(next);
  }

  function selectZone(zone: CanonicalZoneKind) {
    if (editing) return;
    if (viewRef.current.kind === "home") homeExploreRef.current = { ...exploreRef.current };
    exploreRef.current = { ...IDENTITY_EXPLORE };
    if (zone === "binder") {
      openBinderFromWorld();
      return;
    }
    setSelectedId(null);
    setView({ kind: "zone", zone });
  }

  function selectObject(holdingId: string) {
    if (heldRef.current || suppressTapRef.current) {
      suppressTapRef.current = false;
      return;
    }
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
      openBinderFromWorld(holdingId);
      return;
    }
    setView(inspectView(canonical, holdingId));
  }

  function onCollectiblePressStart(holdingId: string) {
    if (viewRef.current.kind !== "edit" || readOnly) return;
    clearPendingPress();
    pendingPressRef.current = {
      holdingId,
      timer: setTimeout(() => {
        pendingPressRef.current = null;
        const item = latestItems.current.find((entry) => entry.holding.id === holdingId);
        if (!item || viewRef.current.kind !== "edit") return;
        const held = acquireHeld(item, reducedMotionRef.current);
        heldRef.current = held;
        previewRef.current = held.preview;
        highlightSurfaceIdRef.current = held.surfaceId;
        suppressTapRef.current = true;
        setSelectedId(holdingId);
        setHeldId(holdingId);
      }, LONG_PRESS_MS),
    };
  }

  function onCollectiblePressEnd(holdingId: string) {
    const pending = pendingPressRef.current;
    clearPendingPress();
    if (pending && pending.holdingId === holdingId) return;
    if (heldRef.current?.holdingId === holdingId && !gestureRef.current.objectDrag) {
      void releaseHeld();
    }
  }

  function captureBinderReturn() {
    const current = viewRef.current;
    if (current.kind === "binder") return;
    binderReturnRef.current = { view: current, explore: { ...exploreRef.current } };
  }

  function openBinderFromWorld(holdingId?: string) {
    captureBinderReturn();
    const index = holdingId ? spreadIndexForHolding(spreads, holdingId) : 0;
    setSelectedId(null);
    setStorageOpen(false);
    setView(openBinderView(Math.max(0, index)));
  }

  function closeBinder() {
    const ret = binderReturnRef.current;
    binderReturnRef.current = null;
    setSelectedId(null);
    if (ret) {
      exploreRef.current = { ...ret.explore };
      setView(ret.view);
      return;
    }
    exploreRef.current = { ...homeExploreRef.current };
    setView({ kind: "home" });
  }

  function beginEditing() {
    if (readOnly) return;
    if (viewRef.current.kind === "home") homeExploreRef.current = { ...exploreRef.current };
    exploreRef.current = { ...IDENTITY_EXPLORE };
    editBaseline.current = cloneRenderables(items);
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    clearPendingPress();
    clearHeldVisual();
    styleBaseline.current = roomStyle;
    setView({ kind: "edit" });
    setSelectedId(null);
  }

  async function cancelEditing() {
    clearPendingPress();
    clearHeldVisual();
    const room = snapshotRef.current?.room;
    const baseline = restoreEditBaseline(editBaseline.current);
    const currentIds = new Set(latestItems.current.map((item) => item.holding.id));
    const baselineIds = new Set(baseline.map((item) => item.holding.id));
    setItems(baseline);
    if (room) {
      try {
        await Promise.all([
          ...baseline.map((item) => persistPlacement(item, { silent: true })),
          ...[...currentIds].filter((id) => !baselineIds.has(id)).map((id) => demo
            ? Promise.resolve(loadDemoRoom().removeDemoPlacement(room.id, id))
            : removeNativeRoomPlacement(room.id, id)),
        ]);
      } catch {
        setError(copy.roomSaveFailed);
      }
    }
    exploreRef.current = { ...homeExploreRef.current };
    setRoomStyle(styleBaseline.current);
    await persistRoomStyle(styleBaseline.current);
    setView({ kind: "home" });
    setSelectedId(null);
    setStyleOpen(false);
  }

  async function persistRoomStyle(next: NativeRoomStyle) {
    const room = snapshotRef.current?.room;
    if (!room || readOnly) return;
    try {
      if (demo) loadDemoRoom().saveDemoRoomStyle(room.ownerUserId, next);
      else await saveNativeRoomStyle(room.id, next);
      setSnapshot((current) => current ? { ...current, room: { ...current.room, style: next } } : current);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  async function applyRoomStyle(next: NativeRoomStyle) {
    setRoomStyle(next);
    await persistRoomStyle(next);
  }

  async function persistPlacement(next: RoomRenderable, options?: { silent?: boolean }) {
    const room = snapshotRef.current?.room ?? snapshot?.room;
    if (!room) return;
    const settled = settleRoomRenderable(next, room.id, next.placement?.surfaceId ?? undefined);
    const payload = {
      roomId: room.id,
      holdingId: next.holding.id,
      zoneId: zoneIdForNativeSurface(room.id, settled.surfaceId),
      slot: next.placement?.slot ?? latestItems.current.findIndex((item) => item.holding.id === next.holding.id),
      transform: toPersistedTransform(settled.renderable),
      surfaceId: settled.surfaceId,
    };
    try {
      const placement = demo ? loadDemoRoom().saveDemoPlacement(payload) : await saveNativeRoomPlacement(payload);
      setItems((all) => {
        const mapped = all.map((item) => item.holding.id === next.holding.id ? { ...settled.renderable, placement } : item);
        return mapped.some((item) => item.holding.id === next.holding.id) ? mapped : [...mapped, { ...settled.renderable, placement }];
      });
    } catch {
      if (!options?.silent) setError(copy.roomSaveFailed);
    }
  }

  async function releaseHeld() {
    const held = heldRef.current;
    const room = snapshotRef.current?.room;
    if (!held || gestureRef.current.releasing) return;
    gestureRef.current.releasing = true;
    suppressTapRef.current = true;
    try {
      if (!room || !held.valid || !held.surfaceId || !isSupportedRoomPlacement(held.rest, room.id)) {
        const origin = held.origin;
        if (origin) setItems((all) => revertDrop(all, origin));
        if (held.valid === false) setError(copy.roomInvalidPlacement);
        return;
      }
      if (held.origin && placementsMatch(held.origin, held.rest)) return;
      await persistPlacement(held.rest);
      rememberPlacement(held.origin ?? { storedHoldingId: held.holdingId }, held.rest);
    } finally {
      clearHeldVisual();
      gestureRef.current.releasing = false;
    }
  }

  async function undoPlacement() {
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push(entry);
    syncHistory();
    const before = entry.before;
    if (isStoredHistoryMarker(before)) {
      const room = snapshotRef.current?.room;
      if (!room) return;
      if (demo) loadDemoRoom().removeDemoPlacement(room.id, before.storedHoldingId);
      else await removeNativeRoomPlacement(room.id, before.storedHoldingId);
      setItems((current) => storeRenderable(current, before.storedHoldingId));
      return;
    }
    await persistPlacement(before);
  }

  async function redoPlacement() {
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push(entry);
    syncHistory();
    const after = entry.after;
    if (isStoredHistoryMarker(after)) {
      const room = snapshotRef.current?.room;
      if (!room) return;
      if (demo) loadDemoRoom().removeDemoPlacement(room.id, after.storedHoldingId);
      else await removeNativeRoomPlacement(room.id, after.storedHoldingId);
      setItems((current) => storeRenderable(current, after.storedHoldingId));
      return;
    }
    await persistPlacement(after);
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
      clearPendingPress();
      clearHeldVisual();
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

  function beginPlaceFromStorage(holding: NativeHolding) {
    if (!snapshot || readOnly || viewRef.current.kind !== "edit") return;
    const draft = createInitialRoomRenderable(holding, nextNativeSlot(items.map((item) => item.placement?.slot ?? 0)), snapshot.room.id);
    const held = acquirePlaceFromStorage(draft, reducedMotionRef.current);
    heldRef.current = held;
    previewRef.current = held.preview;
    highlightSurfaceIdRef.current = null;
    suppressTapRef.current = true;
    setSelectedId(holding.id);
    setHeldId(holding.id);
    setPlacingItem(held.preview);
    setStorageOpen(false);
    setStorageQuery("");
  }

  async function storeSelected() {
    if (!snapshot || !selectedId || readOnly) return;
    const kept = holdings;
    void holdingRemainsAfterStore(kept, selectedId);
    const stored = latestItems.current.find((item) => item.holding.id === selectedId);
    clearPendingPress();
    clearHeldVisual();
    try {
      if (demo) loadDemoRoom().removeDemoPlacement(snapshot.room.id, selectedId);
      else await removeNativeRoomPlacement(snapshot.room.id, selectedId);
      setItems((current) => storeRenderable(current, selectedId));
      if (stored) rememberPlacement(stored, { storedHoldingId: selectedId });
      setSelectedId(null);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  const heldItem = placingItem ?? items.find((item) => item.holding.id === heldId) ?? selectedItem;
  const landingSurfaces = editing && heldId && snapshot && heldItem
    ? compatibleSurfaces(snapshot.room.id, heldItem.geometry)
    : [];
  const hint = placingItem
    ? copy.roomPlaceHint
    : editing
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
    {!privateRoom ? <View
      ref={stageRef}
      style={styles.stage}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        layoutRef.current.width = width;
        layoutRef.current.height = height;
        stageRef.current?.measureInWindow((x, y) => {
          layoutRef.current.x = x;
          layoutRef.current.y = y;
        });
      }}
      {...panResponder.panHandlers}
    >
      <Suspense fallback={null}>
        <NativeRoomRenderer
          key={canvasEpoch}
          items={items}
          selectedId={selectedId}
          focusedId={editing ? null : selectedId}
          heldId={heldId}
          themeId={themeId}
          style={roomStyle}
          view={view}
          binderSpread={currentSpread}
          turningSpread={turningSpread}
          turnDir={turnDir}
          reducedMotion={reducedMotion}
          paused={paused}
          readOnly={readOnly}
          exploreRef={exploreRef}
          previewRef={previewRef}
          highlightSurfaceIdRef={highlightSurfaceIdRef}
          compatibleSurfaces={landingSurfaces}
          onPressStart={onCollectiblePressStart}
          onPressEnd={onCollectiblePressEnd}
          onSelectZone={selectZone}
          onSelect={selectObject}
          onClearSelection={() => {
            if (heldRef.current) return;
            if (view.kind === "inspect") {
              exploreRef.current = { ...frozenExploreRef.current };
              setView({ kind: "zone", zone: view.zone });
            }
            setSelectedId(null);
          }}
          onOpenBinder={() => openBinderFromWorld()}
          onOpenStorage={readOnly ? undefined : () => setStorageOpen(true)}
          placingItem={placingItem}
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
        onCancel={() => void cancelEditing()}
        onSave={() => void saveEditing()}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={() => void undoPlacement()}
        onRedo={() => void redoPlacement()}
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
        {selectedItem.holding.template.kind === "photocard" ? <Pressable onPress={() => openBinderFromWorld(selectedItem.holding.id)} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.openBinder}</SeoullyText></Pressable> : null}
        <Pressable onPress={goBack} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.close}</SeoullyText></Pressable>
      </View> : null}
      {view.kind === "binder" && view.heldHoldingId ? <View style={[styles.inspection, trayPad]}>
        <SeoullyText variant="handle" style={styles.inspectionTitle}>{holdings.find((item) => item.id === view.heldHoldingId)?.template.name ?? copy.binder}</SeoullyText>
        <Pressable onPress={() => setView({ kind: "binder", spread: view.spread })} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.returnToBinder}</SeoullyText></Pressable>
      </View> : null}
      {editing && !heldId && !placingItem ? <View style={[styles.editTray, trayPad]}>
        {selectedItem ? <View style={styles.selectionRow}><SeoullyText numberOfLines={1} variant="handle" color={colors.plum} style={styles.selection}>{selectedItem.holding.template.name}</SeoullyText><Pressable onPress={() => void storeSelected()}><SeoullyText variant="caption" color={colors.muted}>{copy.removeFromRoom}</SeoullyText></Pressable></View> : null}
        <Pressable onPress={() => setStyleOpen(true)} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.roomStyle}</SeoullyText></Pressable>
      </View> : null}
      {placingItem ? <View style={[styles.editTray, trayPad]}>
        <Pressable onPress={() => { clearPendingPress(); clearHeldVisual(); }} style={styles.inspectAction}>
          <SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.cancelPlacement}</SeoullyText>
        </Pressable>
      </View> : null}
      {!readOnly && editing ? <RoomStyleSheet
        visible={styleOpen}
        style={roomStyle}
        reducedMotion={reducedMotion}
        copy={copy}
        bottomInset={insets.bottom}
        onChange={(next) => void applyRoomStyle(next)}
        onClose={() => setStyleOpen(false)}
      /> : null}
      {!readOnly ? <StoredCollectionSheet
        visible={storageOpen}
        holdings={unplaced}
        query={storageQuery}
        editing={editing}
        reducedMotion={reducedMotion}
        copy={copy}
        bottomInset={insets.bottom}
        onChangeQuery={setStorageQuery}
        onClose={() => { setStorageOpen(false); setStorageQuery(""); }}
        onInspect={onInspectCollectible}
        onPlace={beginPlaceFromStorage}
        onEditToPlace={() => { beginEditing(); }}
      /> : null}
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
  canUndo,
  canRedo,
  onUndo,
  onRedo,
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
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  style?: object;
}) {
  const chip = [styles.overlayChip, { backgroundColor: chrome.background, borderColor: chrome.border }];
  return <View pointerEvents="box-none" style={[styles.overlayBar, style]}>
    <Pressable accessibilityRole="button" onPress={onBack} style={chip}>
      <SeoullyText variant="button" color={chrome.color}>{copy.back}</SeoullyText>
    </Pressable>
    <View style={styles.overlaySpacer} />
    {readOnly || !onEdit ? <View style={styles.overlaySpacer} /> : <View style={styles.overlayActions}>
      {editing && canUndo ? <Pressable onPress={onUndo} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.roomUndo}</SeoullyText></Pressable> : null}
      {editing && canRedo ? <Pressable onPress={onRedo} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.roomRedo}</SeoullyText></Pressable> : null}
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
  inspection: { alignItems: "center", backgroundColor: "rgba(247,241,244,0.94)", borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, flexDirection: "row", gap: spacing.sm, left: 0, paddingHorizontal: spacing.sm, paddingTop: spacing.sm, position: "absolute", right: 0 },
  inspectionCopy: { flex: 1 },
  inspectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  inspectionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  inspectAction: { borderColor: colors.plum, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: spacing.sm },
  inspectActionText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
});
