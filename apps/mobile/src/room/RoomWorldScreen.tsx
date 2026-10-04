import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { AccessibilityInfo, Animated, AppState, Easing, PanResponder, Pressable, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadCollectorRoom, loadNativeRoom, removeNativeRoomPlacement, saveNativeRoomLayout, saveNativeRoomPlacement, saveNativeRoomStyle, type NativeHolding, type NativeRoomSnapshot } from "../api";
import { binderSpreads, buildNativeBinderPages, spreadIndexForHolding } from "../binder/model";
import { collectibleKindLabel, type MobileCopy } from "../i18n";
import { colors, spacing } from "../theme";
import { chrome, immersiveRoomFill } from "../ui/shellLayout";
import { SeoullyText } from "../ui/SeoullyText";
import { cloneRenderables, holdingRemainsAfterStore, isObjectHistory, isStoredHistoryMarker, pushPlacementHistory, restoreEditBaseline, revertDrop, storeRenderable, type PlacementHistoryEntry } from "./editSession";
import {
  buildRoomRenderables,
  buildPublicRoomRenderables,
  createInitialRoomRenderable,
  isSupportedRoomPlacement,
  nativeRoomSurfaces,
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
import { RoomShopSheet } from "./RoomShopSheet";
import { RoomStyleSheet } from "./RoomStyleSheet";
import {
  canAddRoomObject,
  cloneRoomObjects,
  legacyRoomLayout,
  markFirstRoomEditComplete,
  objectHasKind,
  parseRoomLayout,
  removeRoomObject,
  replaceRoomObject,
  serializeRoomLayout,
  shouldAutoEnterFirstRoomEdit,
  spawnRoomObject,
  storageTakeoutFor,
  TURNABLE_ROOM_OBJECT_KINDS,
  turnRoomObject,
  type RoomLayoutState,
  type RoomObjectInstance,
  type RoomObjectKind,
} from "./roomObjects";
import { acquireRoomObject, liftRoomObject, objectsMatch, projectRoomObjectOntoWorld, type HeldRoomObject } from "./roomObjectEdit";
import { DEFAULT_ROOM_STYLE, defaultStyleForTheme, parseRoomStyle, resolveRoomLook, type NativeRoomStyle } from "./roomStyle";
import { entranceForeground, roomEntranceCopy } from "./entrance";
import { roomOverlayChrome } from "./theme";
import { asAuthoredRenderable, withResolvedWorld } from "./roomWorldTransform";
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
  onWishlistCollectible,
  onMessageCollectible,
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
  onWishlistCollectible?: (holding: NativeHolding) => void | Promise<void>;
  onMessageCollectible?: (holding: NativeHolding) => void;
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
  const [shopOpen, setShopOpen] = useState(false);
  const [roomLayout, setRoomLayout] = useState<RoomLayoutState>(legacyRoomLayout);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [heldObjectId, setHeldObjectId] = useState<string | null>(null);
  const [helperKind, setHelperKind] = useState<"first" | "edit" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [inspectNotice, setInspectNotice] = useState<string | null>(null);
  const [binderHintSeen, setBinderHintSeen] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const insets = useSafeAreaInsets();
  const editBaseline = useRef<RoomRenderable[]>([]);
  const objectBaseline = useRef<RoomObjectInstance[]>([]);
  const latestItems = useRef(items);
  const latestObjects = useRef<RoomObjectInstance[]>([]);
  const layoutStateRef = useRef(roomLayout);
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
  const heldObjectRef = useRef<HeldRoomObject | null>(null);
  const previewRef = useRef<RoomRenderable | null>(null);
  const objectPreviewRef = useRef<RoomObjectInstance | null>(null);
  const furnitureCarryRef = useRef<{ roomId: string; origin: RoomObjectInstance; current: RoomObjectInstance } | null>(null);
  const highlightSurfaceIdRef = useRef<string | null>(null);
  const pendingPressRef = useRef<{ holdingId: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const helperTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstEntryRef = useRef(false);
  const suppressTapRef = useRef(false);
  const undoStack = useRef<PlacementHistoryEntry<RoomRenderable, RoomObjectInstance>[]>([]);
  const redoStack = useRef<PlacementHistoryEntry<RoomRenderable, RoomObjectInstance>[]>([]);
  const styleBaseline = useRef<NativeRoomStyle>(DEFAULT_ROOM_STYLE);
  const binderReturnRef = useRef<{ view: NativeWorldView; explore: ExploreOffset } | null>(null);
  const layoutRef = useRef({ width: 1, height: 1, x: 0, y: 0 });
  const stageRef = useRef<View>(null);
  useEffect(() => { latestItems.current = items; }, [items]);
  useEffect(() => { latestObjects.current = roomLayout.objects; }, [roomLayout]);
  useEffect(() => { layoutStateRef.current = roomLayout; }, [roomLayout]);
  useEffect(() => { viewRef.current = view; }, [view]);
  useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);
  useEffect(() => { onOwnRoomRef.current = onOwnRoom; }, [onOwnRoom]);
  useEffect(() => { snapshotRef.current = snapshot; }, [snapshot]);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); }, []);

  function applyLoadedLayout(next: RoomLayoutState, readOnlyRoom: boolean, loadedItems: RoomRenderable[] = latestItems.current) {
    setRoomLayout(next);
    if (viewRef.current.kind === "edit") return;
    if (!shouldAutoEnterFirstRoomEdit(next, readOnlyRoom)) return;
    firstEntryRef.current = true;
    showHelper("first");
    editBaseline.current = cloneRenderables(loadedItems);
    objectBaseline.current = cloneRoomObjects(next.objects);
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setView({ kind: "edit" });
  }

  function showHelper(kind: "first" | "edit") {
    if (helperTimer.current) clearTimeout(helperTimer.current);
    setHelperKind(kind);
    helperTimer.current = setTimeout(() => setHelperKind(null), reducedMotionRef.current ? 1800 : 2600);
  }

  function showToast(message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }
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
          applyLoadedLayout(parseRoomLayout(next.room.layout), mode === "public", buildRoomRenderables(next.holdings, next.placements));
          setOwnerName(demoRoom.demoCollectorDisplayName(userId));
          setPrivateRoom(false);
        } else {
          const next = demoRoom.buildFixtureRoomSnapshot(undefined, { ownStarter: true });
          setSnapshot(next);
          setHoldings(next.holdings);
          setItems(buildRoomRenderables(next.holdings, next.placements));
          setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
          applyLoadedLayout(parseRoomLayout(next.room.layout), false, buildRoomRenderables(next.holdings, next.placements));
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
        applyLoadedLayout(parseRoomLayout(publicRoom.room?.layout), true, nextItems);
        setSnapshot(publicRoom.room ? {
          room: { id: publicRoom.room.id, ownerUserId: publicRoom.owner.userId, themeId: "hearth", style: parseRoomStyle(publicRoom.room.style), layout: publicRoom.room.layout },
          placements: [],
          holdings: nextItems.map((item) => item.holding),
        } : null);
      } else if (persistLive) {
        const next = await loadNativeRoom();
        setSnapshot(next);
        setHoldings(next.holdings);
        setItems(buildRoomRenderables(next.holdings, next.placements));
        setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
        applyLoadedLayout(parseRoomLayout(next.room.layout), false, buildRoomRenderables(next.holdings, next.placements));
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
    // applyLoadedLayout is a local helper over refs/setters; including it retriggers Room fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!initialHoldingId || !spreads.length || !objectHasKind(roomLayout.objects, "desk")) return;
    const index = spreadIndexForHolding(spreads, initialHoldingId);
    if (index < 0) return;
    const task = setTimeout(() => {
      binderReturnRef.current = { view: { kind: "home" }, explore: { ...exploreRef.current } };
      setView(openBinderView(index));
    }, 0);
    return () => clearTimeout(task);
  }, [initialHoldingId, spreads, roomLayout.objects]);

  function clearPendingPress() {
    if (pendingPressRef.current) clearTimeout(pendingPressRef.current.timer);
    pendingPressRef.current = null;
  }

  function clearHeldVisual() {
    heldRef.current = null;
    heldObjectRef.current = null;
    previewRef.current = null;
    objectPreviewRef.current = null;
    furnitureCarryRef.current = null;
    highlightSurfaceIdRef.current = null;
    gestureRef.current.objectDrag = false;
    setHeldId(null);
    setHeldObjectId(null);
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
      if (heldRef.current || heldObjectRef.current) return Math.hypot(gesture.dx, gesture.dy) > 2;
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
      gestureRef.current.objectDrag = Boolean(heldRef.current || heldObjectRef.current);
      const span = touchSpan(event);
      if (span > 0 && exploreAllowedForView(viewRef.current) && !heldRef.current && !heldObjectRef.current) {
        gestureRef.current.pinching = true;
        gestureRef.current.pinchStart = span;
        gestureRef.current.dollyStart = exploreRef.current.dolly;
      } else {
        gestureRef.current.pinching = false;
      }
    },
    onPanResponderMove: (event, gesture) => {
      if (heldObjectRef.current) {
        gestureRef.current.objectDrag = true;
        setHelperKind(null);
        const held = heldObjectRef.current;
        const pose = applyExploreOffset(poseForView(viewRef.current, null), exploreRef.current, "home");
        const candidate = projectRoomObjectOntoWorld(
          gesture.moveX - layoutRef.current.x,
          gesture.moveY - layoutRef.current.y,
          layoutRef.current.width,
          layoutRef.current.height,
          pose,
          held.origin,
        );
        if (!candidate) {
          held.valid = false;
          highlightSurfaceIdRef.current = null;
          return;
        }
        held.current = candidate.current;
        held.valid = candidate.valid;
        objectPreviewRef.current = liftRoomObject(candidate.current, reducedMotionRef.current);
        furnitureCarryRef.current = snapshotRef.current?.room
          ? { roomId: snapshotRef.current.room.id, origin: held.origin, current: candidate.current }
          : null;
        highlightSurfaceIdRef.current = candidate.valid
          ? (candidate.surfaceKind === "wall" ? `${snapshotRef.current?.room.id ?? ""}-wall` : `${snapshotRef.current?.room.id ?? ""}-floor`)
          : null;
        return;
      }
      if (heldRef.current) {
        gestureRef.current.objectDrag = true;
        setHelperKind(null);
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
          latestObjects.current,
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
      if (heldObjectRef.current) void releaseHeldObject();
      else if (heldRef.current) void releaseHeld();
    },
    onPanResponderTerminate: () => {
      gestureRef.current.pinching = false;
      if (heldObjectRef.current) void releaseHeldObject();
      else if (heldRef.current) void releaseHeld();
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
    if (placingItem || heldObjectRef.current?.placing) {
      if (heldObjectRef.current?.placing) {
        const objectId = heldObjectRef.current.objectId;
        setRoomLayout((current) => ({ ...current, objects: removeRoomObject(current.objects, objectId) }));
      }
      clearPendingPress();
      clearHeldVisual();
      return;
    }
    if (current.kind === "binder" && current.heldHoldingId) {
      setInspectNotice(null);
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
        const room = snapshotRef.current?.room;
        const world = withResolvedWorld(item, room?.id, latestObjects.current);
        const held = acquireHeld(world, reducedMotionRef.current);
        held.origin = cloneRenderable(item);
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
    if (!objectHasKind(latestObjects.current, "desk")) return;
    captureBinderReturn();
    const index = holdingId ? spreadIndexForHolding(spreads, holdingId) : 0;
    setSelectedId(null);
    setStorageOpen(false);
    setView(openBinderView(Math.max(0, index)));
  }

  async function wishlistHolding(holding: NativeHolding) {
    if (!onWishlistCollectible) return;
    try {
      await onWishlistCollectible(holding);
      setInspectNotice(copy.savedToWishlist);
    } catch {
      setInspectNotice(copy.wishlistUnavailable);
    }
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
    objectBaseline.current = cloneRoomObjects(layoutStateRef.current.objects);
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
    clearPendingPress();
    clearHeldVisual();
    styleBaseline.current = roomStyle;
    firstEntryRef.current = false;
    showHelper("edit");
    setView({ kind: "edit" });
    setSelectedId(null);
    setSelectedObjectId(null);
    setShopOpen(false);
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
    const objects = cloneRoomObjects(objectBaseline.current);
    setRoomLayout((current) => ({ ...current, objects }));
    await persistLayout({ ...layoutStateRef.current, objects, source: "authored" });
    setView({ kind: "home" });
    setSelectedId(null);
    setSelectedObjectId(null);
    setStyleOpen(false);
    setShopOpen(false);
    setHelperKind(null);
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
    const objects = latestObjects.current;
    const world = withResolvedWorld(next, room.id, objects);
    const settled = settleRoomRenderable(world, room.id, next.placement?.surfaceId ?? undefined, objects);
    const authored = asAuthoredRenderable({
      ...settled.renderable,
      placement: next.placement
        ? { ...next.placement, surfaceId: settled.surfaceId }
        : settled.renderable.placement,
    }, room.id, objects);
    const payload = {
      roomId: room.id,
      holdingId: next.holding.id,
      zoneId: zoneIdForNativeSurface(room.id, settled.surfaceId),
      slot: next.placement?.slot ?? latestItems.current.findIndex((item) => item.holding.id === next.holding.id),
      transform: toPersistedTransform(authored),
      surfaceId: settled.surfaceId,
    };
    try {
      const placement = demo ? loadDemoRoom().saveDemoPlacement(payload) : await saveNativeRoomPlacement(payload);
      const stored = { ...authored, placement };
      setItems((all) => {
        const mapped = all.map((item) => item.holding.id === next.holding.id ? stored : item);
        return mapped.some((item) => item.holding.id === next.holding.id) ? mapped : [...mapped, stored];
      });
      return stored;
    } catch {
      if (!options?.silent) setError(copy.roomSaveFailed);
      return undefined;
    }
  }

  async function releaseHeld() {
    const held = heldRef.current;
    const room = snapshotRef.current?.room;
    if (!held || gestureRef.current.releasing) return;
    gestureRef.current.releasing = true;
    suppressTapRef.current = true;
    try {
      if (!room || !held.valid || !held.surfaceId || !isSupportedRoomPlacement(held.rest, room.id, latestObjects.current)) {
        const origin = held.origin;
        if (origin) setItems((all) => revertDrop(all, origin));
        if (held.valid === false) showToast(copy.roomPlaceOnSurface);
        return;
      }
      const authoredRest = asAuthoredRenderable(held.rest, room.id, latestObjects.current);
      if (held.origin && placementsMatch(held.origin, authoredRest)) return;
      const stored = await persistPlacement(held.rest);
      rememberPlacement(held.origin ?? { storedHoldingId: held.holdingId }, stored ?? authoredRest);
    } finally {
      clearHeldVisual();
      gestureRef.current.releasing = false;
    }
  }

  async function persistLayout(next: RoomLayoutState, options?: { silent?: boolean }) {
    const room = snapshotRef.current?.room ?? snapshot?.room;
    if (!room || readOnly) return;
    const document = serializeRoomLayout(next);
    try {
      if (demo) loadDemoRoom().saveDemoRoomLayout(room.ownerUserId, next);
      else await saveNativeRoomLayout(room.id, document);
      setSnapshot((current) => current ? { ...current, room: { ...current.room, layout: document } } : current);
      setRoomLayout(next);
      layoutStateRef.current = next;
    } catch {
      if (!options?.silent) setError(copy.roomSaveFailed);
    }
  }

  async function applyRoomObjects(nextObjects: RoomObjectInstance[]) {
    const next = { ...layoutStateRef.current, source: "authored" as const, objects: cloneRoomObjects(nextObjects) };
    await persistLayout(next);
  }

  async function releaseHeldObject() {
    const held = heldObjectRef.current;
    if (!held || gestureRef.current.releasing) return;
    gestureRef.current.releasing = true;
    suppressTapRef.current = true;
    try {
      if (!held.valid) {
        objectPreviewRef.current = null;
        furnitureCarryRef.current = null;
        if (!held.placing) showToast(held.origin.kind === "wall-frame" ? copy.roomPlaceOnWall : copy.roomPlaceOnFloor);
        if (held.placing) {
          setRoomLayout((current) => ({ ...current, objects: removeRoomObject(current.objects, held.objectId) }));
        }
        return;
      }
      if (!held.placing && objectsMatch(held.origin, held.current)) return;
      const beforeObjects = cloneRoomObjects(latestObjects.current);
      const afterObjects = held.placing
        ? [...removeRoomObject(beforeObjects, held.objectId), held.current]
        : replaceRoomObject(beforeObjects, held.current);
      setRoomLayout((current) => ({ ...current, source: "authored", objects: afterObjects }));
      await persistLayout({ ...layoutStateRef.current, source: "authored", objects: afterObjects });
      pushPlacementHistory(undoStack.current, redoStack.current, {
        before: { storedHoldingId: held.objectId },
        after: { storedHoldingId: held.objectId },
        objectsBefore: beforeObjects,
        objectsAfter: cloneRoomObjects(afterObjects),
      });
      syncHistory();
      setSelectedObjectId(held.objectId);
      setSelectedId(null);
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
    if (isObjectHistory(entry) && entry.objectsBefore) {
      await applyRoomObjects(entry.objectsBefore);
      return;
    }
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
    if (isObjectHistory(entry) && entry.objectsAfter) {
      await applyRoomObjects(entry.objectsAfter);
      return;
    }
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
      const completed = markFirstRoomEditComplete(layoutStateRef.current);
      await persistLayout(completed);
      firstEntryRef.current = false;
      exploreRef.current = { ...homeExploreRef.current };
      setView({ kind: "home" });
      setSelectedId(null);
      setSelectedObjectId(null);
      setStyleOpen(false);
      setShopOpen(false);
      setHelperKind(null);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  function beginPlaceFromStorage(holding: NativeHolding) {
    if (!snapshot || readOnly || viewRef.current.kind !== "edit") return;
    const draft = createInitialRoomRenderable(holding, nextNativeSlot(items.map((item) => item.placement?.slot ?? 0)), snapshot.room.id);
    const held = acquirePlaceFromStorage(draft, reducedMotionRef.current, storageTakeoutFor(latestObjects.current));
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

  function beginPlaceFromShop(kind: RoomObjectKind) {
    if (readOnly || viewRef.current.kind !== "edit" || !canAddRoomObject(latestObjects.current, kind)) return;
    const draft = spawnRoomObject(latestObjects.current, kind);
    setRoomLayout((current) => ({ ...current, source: "authored", objects: [...current.objects, draft] }));
    const held = acquireRoomObject(draft, true);
    heldObjectRef.current = held;
    objectPreviewRef.current = liftRoomObject(draft, reducedMotionRef.current);
    furnitureCarryRef.current = snapshotRef.current?.room
      ? { roomId: snapshotRef.current.room.id, origin: draft, current: draft }
      : null;
    suppressTapRef.current = true;
    setSelectedObjectId(draft.id);
    setSelectedId(null);
    setHeldObjectId(draft.id);
    setShopOpen(false);
    setHelperKind(null);
  }

  async function removeSelectedObject() {
    if (!selectedObjectId || readOnly) return;
    const current = latestObjects.current;
    const target = current.find((item) => item.id === selectedObjectId);
    if (!target) return;
    const next = removeRoomObject(current, selectedObjectId);
    pushPlacementHistory(undoStack.current, redoStack.current, {
      before: { storedHoldingId: selectedObjectId },
      after: { storedHoldingId: selectedObjectId },
      objectsBefore: cloneRoomObjects(current),
      objectsAfter: cloneRoomObjects(next),
      childrenBefore: [],
      childrenAfter: [],
    });
    syncHistory();
    setSelectedObjectId(null);
    await persistLayout({ ...layoutStateRef.current, source: "authored", objects: next });
  }

  async function turnSelectedObject() {
    if (!selectedObjectId || readOnly) return;
    const current = latestObjects.current;
    const target = current.find((item) => item.id === selectedObjectId);
    if (!target || !TURNABLE_ROOM_OBJECT_KINDS.has(target.kind)) return;
    const nextObject = turnRoomObject(target);
    const next = replaceRoomObject(current, nextObject);
    pushPlacementHistory(undoStack.current, redoStack.current, {
      before: { storedHoldingId: selectedObjectId },
      after: { storedHoldingId: selectedObjectId },
      objectsBefore: cloneRoomObjects(current),
      objectsAfter: cloneRoomObjects(next),
      childrenBefore: [],
      childrenAfter: [],
    });
    syncHistory();
    await persistLayout({ ...layoutStateRef.current, source: "authored", objects: next });
  }

  function onObjectPressStart(objectId: string) {
    if (viewRef.current.kind !== "edit" || readOnly) return;
    clearPendingPress();
    pendingPressRef.current = {
      holdingId: `object:${objectId}`,
      timer: setTimeout(() => {
        pendingPressRef.current = null;
        const object = latestObjects.current.find((item) => item.id === objectId);
        if (!object || viewRef.current.kind !== "edit") return;
        const held = acquireRoomObject(object);
        heldObjectRef.current = held;
        objectPreviewRef.current = liftRoomObject(object, reducedMotionRef.current);
        furnitureCarryRef.current = snapshotRef.current?.room
          ? { roomId: snapshotRef.current.room.id, origin: object, current: object }
          : null;
        suppressTapRef.current = true;
        setHelperKind(null);
        setSelectedObjectId(objectId);
        setSelectedId(null);
        setHeldObjectId(objectId);
      }, LONG_PRESS_MS),
    };
  }

  function onObjectPressEnd(objectId: string) {
    const pending = pendingPressRef.current;
    clearPendingPress();
    if (pending && pending.holdingId === `object:${objectId}`) return;
    if (heldObjectRef.current?.objectId === objectId && !gestureRef.current.objectDrag) {
      void releaseHeldObject();
    }
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
  const landingSurfaces = editing && snapshot && heldId && heldItem
    ? compatibleSurfaces(snapshot.room.id, heldItem.geometry, roomLayout.objects)
    : editing && snapshot && heldObjectId
      ? nativeRoomSurfaces(snapshot.room.id, roomLayout.objects).filter((surface) => surface.id.endsWith("-floor") || surface.id.endsWith("-wall"))
      : [];
  const binderHeld = view.kind === "binder" && view.heldHoldingId
    ? holdings.find((item) => item.id === view.heldHoldingId) ?? null
    : null;
  const hint = toast
    ? toast
    : placingItem
      ? copy.roomPlaceHint
      : view.kind === "binder" && !view.heldHoldingId && !binderHintSeen
        ? copy.binderLead
        : null;
  const selectedRoomObject = roomLayout.objects.find((item) => item.id === selectedObjectId) ?? null;
  const archivePresent = objectHasKind(roomLayout.objects, "archive");
  const deskPresent = objectHasKind(roomLayout.objects, "desk");
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
          roomId={snapshot?.room.id}
          objects={roomLayout.objects}
          selectedObjectId={selectedObjectId}
          heldObjectId={heldObjectId}
          showLegacyBoxes={false}
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
          objectPreviewRef={objectPreviewRef}
          furnitureCarryRef={furnitureCarryRef}
          highlightSurfaceIdRef={highlightSurfaceIdRef}
          compatibleSurfaces={landingSurfaces}
          onPressStart={onCollectiblePressStart}
          onPressEnd={onCollectiblePressEnd}
          onObjectPressStart={onObjectPressStart}
          onObjectPressEnd={onObjectPressEnd}
          onSelectZone={selectZone}
          onSelect={selectObject}
          onSelectObject={(objectId) => {
            if (heldObjectRef.current || heldRef.current || suppressTapRef.current) {
              suppressTapRef.current = false;
              return;
            }
            setSelectedObjectId(objectId);
            setSelectedId(null);
          }}
          onClearSelection={() => {
            if (heldRef.current || heldObjectRef.current) return;
            setSelectedObjectId(null);
            if (view.kind === "inspect") {
              exploreRef.current = { ...frozenExploreRef.current };
              setView({ kind: "zone", zone: view.zone });
            }
            setSelectedId(null);
          }}
          onOpenBinder={deskPresent ? () => openBinderFromWorld() : undefined}
          onOpenStorage={readOnly ? undefined : () => setStorageOpen(true)}
          placingItem={placingItem}
          onHoldCard={(holding) => {
            if (view.kind !== "binder") return;
            setBinderHintSeen(true);
            setInspectNotice(null);
            setView({ kind: "binder", spread: view.spread, ...(holding ? { heldHoldingId: holding.id } : {}) });
          }}
          onTurnEdge={(dir) => {
            setBinderHintSeen(true);
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
        style={overlayPad}
        showStorage={!readOnly && !archivePresent}
        onStorage={() => setStorageOpen(true)}
      />
      {__DEV__ && demo && !readOnly && editing ? <Pressable
        accessibilityLabel="Reset Demo to Starter Room"
        style={{ position: "absolute", right: 16, top: insets.top + 100 }}
        onPress={() => {
          if (!__DEV__ || !demo || mode !== "own" || !snapshot) return;
          loadDemoRoom().resetDemoRoomToStarter(snapshot.room.ownerUserId);
          onLeave();
        }}
      ><SeoullyText variant="caption" color={overlayTheme.color}>Reset Demo to Starter Room</SeoullyText></Pressable> : null}
      {helperKind ? <View pointerEvents="none" style={[styles.helper, { top: insets.top + 52 }]}>
        <SeoullyText variant="handle" color={colors.ink} style={styles.helperTitle}>
          {helperKind === "first" ? copy.roomFirstTitle : copy.roomEditHoldHint}
        </SeoullyText>
        {helperKind === "first" ? <SeoullyText variant="caption" color={colors.muted} style={styles.helperLead}>{copy.roomFirstLead}</SeoullyText> : null}
        {helperKind === "edit" ? <SeoullyText variant="caption" color={colors.muted} style={styles.helperLead}>{copy.roomEditLookHint}</SeoullyText> : null}
      </View> : null}
      {!loading ? <RoomEntranceTitle key={entranceLabel} label={entranceLabel} color={entranceTone.color} shadow={entranceTone.shadow} reducedMotion={reducedMotion} /> : null}
      {error ? <Pressable onPress={() => void refresh()} style={styles.error}><SeoullyText variant="secondary" color={colors.plum}>{error} · {copy.retry}</SeoullyText></Pressable> : null}
      {hint ? <View pointerEvents="none" style={[styles.hint, { bottom: insets.bottom + chrome.companionSize + chrome.gutter }]}><SeoullyText variant="caption" color={colors.ink} style={styles.hintText}>{hint}</SeoullyText></View> : null}
      {selectedItem && !editing && view.kind !== "binder" ? <InspectionTray
        holding={selectedItem.holding}
        copy={copy}
        notice={inspectNotice}
        style={trayPad}
        onView={onInspectCollectible ? () => onInspectCollectible(selectedItem.holding.id) : undefined}
        onOpenBinder={deskPresent && selectedItem.holding.template.kind === "photocard" ? () => openBinderFromWorld(selectedItem.holding.id) : undefined}
        onWishlist={readOnly && onWishlistCollectible ? () => { void wishlistHolding(selectedItem.holding); } : undefined}
        onMessage={readOnly && onMessageCollectible ? () => onMessageCollectible(selectedItem.holding) : undefined}
        onClose={goBack}
        closeLabel={copy.close}
      /> : null}
      {binderHeld ? <InspectionTray
        holding={binderHeld}
        copy={copy}
        notice={inspectNotice}
        style={trayPad}
        onView={onInspectCollectible ? () => onInspectCollectible(binderHeld.id) : undefined}
        onWishlist={readOnly && onWishlistCollectible ? () => { void wishlistHolding(binderHeld); } : undefined}
        onMessage={readOnly && onMessageCollectible ? () => onMessageCollectible(binderHeld) : undefined}
        onClose={() => setView({ kind: "binder", spread: view.kind === "binder" ? view.spread : 0 })}
        closeLabel={copy.returnToBinder}
      /> : null}
      {editing ? <View pointerEvents="box-none" style={[styles.editBar, trayPad]}>
        {selectedItem && !heldId && !placingItem ? <View style={styles.contextRow}>
          <SeoullyText numberOfLines={1} variant="caption" color={colors.ink} style={styles.selection}>{selectedItem.holding.template.name}</SeoullyText>
          <Pressable onPress={() => void storeSelected()} style={styles.toolChip}><SeoullyText variant="caption" color={colors.plum}>{copy.removeFromRoom}</SeoullyText></Pressable>
        </View> : null}
        {selectedRoomObject && !heldObjectId && !placingItem ? <View style={styles.contextRow}>
          {TURNABLE_ROOM_OBJECT_KINDS.has(selectedRoomObject.kind) ? <Pressable onPress={() => void turnSelectedObject()} style={styles.toolChip}><SeoullyText variant="caption" color={colors.plum}>{copy.roomTurn}</SeoullyText></Pressable> : null}
          <Pressable onPress={() => void removeSelectedObject()} style={styles.toolChip}><SeoullyText variant="caption" color={colors.plum}>{copy.roomRemoveObject}</SeoullyText></Pressable>
        </View> : null}
        {placingItem ? <Pressable onPress={() => { clearPendingPress(); clearHeldVisual(); }} style={styles.toolChip}>
          <SeoullyText variant="caption" color={colors.plum}>{copy.cancelPlacement}</SeoullyText>
        </Pressable> : null}
        <View style={styles.toolRow}>
          <Pressable onPress={() => setShopOpen(true)} style={styles.toolButton}><SeoullyText variant="button" color={colors.plum}>{copy.roomShop}</SeoullyText></Pressable>
          <Pressable onPress={() => setStyleOpen(true)} style={styles.toolButton}><SeoullyText variant="button" color={colors.plum}>{copy.roomStyle}</SeoullyText></Pressable>
          {canUndo ? <Pressable onPress={() => void undoPlacement()} style={styles.toolButton}><SeoullyText variant="button" color={colors.plum}>{copy.roomUndo}</SeoullyText></Pressable> : null}
          {canRedo ? <Pressable onPress={() => void redoPlacement()} style={styles.toolButton}><SeoullyText variant="button" color={colors.plum}>{copy.roomRedo}</SeoullyText></Pressable> : null}
          <Pressable onPress={() => void saveEditing()} style={styles.toolButton}><SeoullyText variant="button" color={colors.plum}>{copy.finishEditing}</SeoullyText></Pressable>
        </View>
      </View> : null}
      {!readOnly && editing ? <RoomShopSheet
        visible={shopOpen}
        objects={roomLayout.objects}
        reducedMotion={reducedMotion}
        copy={copy}
        bottomInset={insets.bottom}
        onAdd={beginPlaceFromShop}
        onClose={() => setShopOpen(false)}
      /> : null}
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

function InspectionTray({
  holding,
  copy,
  notice,
  style,
  onView,
  onOpenBinder,
  onWishlist,
  onMessage,
  onClose,
  closeLabel,
}: {
  holding: NativeHolding;
  copy: MobileCopy;
  notice?: string | null;
  style?: object;
  onView?: () => void;
  onOpenBinder?: () => void;
  onWishlist?: () => void;
  onMessage?: () => void;
  onClose: () => void;
  closeLabel: string;
}) {
  return <View style={[styles.inspection, style]}>
    <View style={styles.inspectionCopy}>
      <SeoullyText numberOfLines={1} variant="handle" style={styles.inspectionTitle}>{holding.template.name}</SeoullyText>
      <SeoullyText numberOfLines={1} variant="caption" style={styles.inspectionMeta}>
        {[holding.template.groupName, holding.template.memberName, collectibleKindLabel(holding.template.kind, copy)].filter(Boolean).join(" · ")}
      </SeoullyText>
    </View>
    <View style={styles.inspectionActions}>
      {onView ? <Pressable onPress={onView} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.viewCollectible}</SeoullyText></Pressable> : null}
      {onOpenBinder ? <Pressable onPress={onOpenBinder} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.openBinder}</SeoullyText></Pressable> : null}
      {onWishlist ? <Pressable onPress={onWishlist} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.saveToWishlist}</SeoullyText></Pressable> : null}
      {onMessage ? <Pressable onPress={onMessage} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{copy.messageAboutCollectible}</SeoullyText></Pressable> : null}
      <Pressable onPress={onClose} style={styles.inspectAction}><SeoullyText variant="button" color={colors.plum} style={styles.inspectActionText}>{closeLabel}</SeoullyText></Pressable>
    </View>
    {notice ? <SeoullyText variant="caption" color={colors.plum} style={styles.inspectionNotice}>{notice}</SeoullyText> : null}
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
  style,
  showStorage,
  onStorage,
}: {
  copy: MobileCopy;
  chrome: ReturnType<typeof roomOverlayChrome>;
  onBack: () => void;
  editing?: boolean;
  readOnly?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  style?: object;
  showStorage?: boolean;
  onStorage?: () => void;
}) {
  const chip = [styles.overlayChip, { backgroundColor: chrome.background, borderColor: chrome.border }];
  return <View pointerEvents="box-none" style={[styles.overlayBar, style]}>
    <Pressable accessibilityRole="button" onPress={onBack} style={chip}>
      <SeoullyText variant="button" color={chrome.color}>{copy.back}</SeoullyText>
    </Pressable>
    <View style={styles.overlaySpacer} />
    {readOnly || !onEdit ? <View style={styles.overlaySpacer} /> : <View style={styles.overlayActions}>
      {showStorage ? <Pressable onPress={onStorage} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.storedAccess}</SeoullyText></Pressable> : null}
      {editing ? <Pressable onPress={onCancel} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.cancelEditing}</SeoullyText></Pressable> : <Pressable onPress={onEdit} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.editRoom}</SeoullyText></Pressable>}
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
  overlayChip: { alignItems: "center", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  overlaySpacer: { flex: 1 },
  entrance: { alignItems: "center", bottom: 0, justifyContent: "center", left: 0, paddingHorizontal: 28, position: "absolute", right: 0, top: 0 },
  entranceText: { fontSize: 22, lineHeight: 28, textAlign: "center", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  overlayActions: { flexDirection: "row", flexShrink: 0, gap: spacing.xs },
  error: { paddingHorizontal: chrome.gutter, paddingTop: spacing.xs },
  empty: { padding: chrome.gutter },
  stage: StyleSheet.absoluteFill,
  hint: { alignSelf: "center", backgroundColor: "rgba(247,241,244,0.82)", borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 5, position: "absolute" },
  hintText: { color: colors.ink, fontSize: 11, fontWeight: "600" },
  helper: { alignSelf: "center", backgroundColor: "rgba(247,241,244,0.9)", borderRadius: 16, left: 20, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: "absolute", right: 20 },
  helperTitle: { fontWeight: "700", textAlign: "center" },
  helperLead: { marginTop: 2, textAlign: "center" },
  editBar: { alignItems: "center", bottom: 0, gap: 8, left: 0, paddingHorizontal: spacing.sm, position: "absolute", right: 0 },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  toolButton: { alignItems: "center", backgroundColor: "rgba(247,241,244,0.92)", borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  toolChip: { alignItems: "center", backgroundColor: "rgba(247,241,244,0.92)", borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  contextRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  selectionColumn: { gap: spacing.xs },
  selectionRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  selection: { color: colors.plum, flexShrink: 1, fontWeight: "700" },
  transformRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center" },
  transformButton: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: spacing.sm },
  inspection: { backgroundColor: "rgba(247,241,244,0.94)", borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, gap: 6, left: 0, paddingHorizontal: spacing.sm, paddingTop: 8, position: "absolute", right: 0 },
  inspectionCopy: { minWidth: 0 },
  inspectionTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  inspectionMeta: { color: colors.muted, fontSize: 11, marginTop: 1 },
  inspectionActions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  inspectionNotice: { marginTop: 2 },
  inspectAction: { borderColor: colors.plum, borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 30, paddingHorizontal: 8 },
  inspectActionText: { color: colors.plum, fontSize: 11, fontWeight: "700" },
});
