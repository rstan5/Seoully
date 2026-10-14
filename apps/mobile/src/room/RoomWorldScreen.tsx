import { IconHome } from "../ui/icons";
import { onboardingTrace } from "../startup/onboardingTrace";
import { useLanguageControlWidth, useLanguageControlTone } from "../ui/GlobalLanguageControl";
import { startupTrace } from "../startup/trace";
import { PhotocardCollectorCount } from "../ui/PhotocardCollectorCount";
import { roomOverlayLayout } from "./overlayLayout";
import { RoomMessage, roomMessageStyles } from "./RoomMessage";
import { SeoullyLoadingState } from "../ui/SeoullyLoadingState";
import { LiveRoomSync, liveRoomNeedsHydration } from "./liveRoomSync";
import { PhotoStringSheet } from "./PhotoStringSheet";
import { configuredPhotoString, type PublicPhotoStringCard } from "./photoString";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Stack, useFocusEffect } from "expo-router";
import { AccessibilityInfo, Animated, AppState, Easing, PanResponder, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent, type GestureResponderEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { loadCollectorProfile, loadCollectorRoom, loadNativeRoom, removeNativeRoomPlacement, saveNativeRoomLayout, saveNativeRoomPlacement, saveNativeRoomStyle, type NativeHolding, type NativeRoomSnapshot } from "../api";
import { binderSpreads, buildNativeBinderPages, spreadIndexForHolding } from "../binder/model";
import { collectibleKindLabel, type MobileCopy } from "../i18n";
import { spacing } from "../theme";
import { chrome, topHeaderMetrics, immersiveRoomFill } from "../ui/shellLayout";
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
  isWallObject,
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
  surfaceOwner,
  childrenOnInstance, surfacesOwnedBy, authoredSurfaceIdFor, normalizeBinderDesk, primaryBinderDeskId, resolveRoomObjectTransform, removeFurnitureSafely,
  TURNABLE_ROOM_OBJECT_KINDS,
  turnRoomObject,
  type RoomLayoutState,
  type RoomObjectInstance,
  type RoomObjectKind,
} from "./roomObjects";
import { acquireRoomObject, liftRoomObject, objectsMatch, projectRoomObjectOntoWorld, type HeldRoomObject } from "./roomObjectEdit";
import { DEFAULT_ROOM_STYLE, defaultStyleForTheme, parseRoomStyle, resolveRoomLook, type NativeRoomStyle } from "./roomStyle";
import { entranceForeground, roomEntranceCopy } from "./entrance";
import { roomChromeSurface, roomOverlayChrome } from "./theme";
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
  onLiveSnapshotReady,
  onLivePlacementConfirmed,
  onLiveBinderConfirmed,
  onLiveSnapshotFailed,
  onWorldReady,
  onBinderArrivalReady,
  onRoomAppearance,
  roomGuidance,
  loadingCovered = false,
  suppressAmbientGuidance = false,
  // First-time guidance belongs exclusively to OnboardingWorldIntro.
  deferFirstRoomEdit = true,
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
  onLiveSnapshotReady?: (snapshot: NativeRoomSnapshot) => void;
  onLivePlacementConfirmed?: (holdingId: string) => void;
  onLiveBinderConfirmed?: (holdingIds: string[]) => void;
  onLiveSnapshotFailed?: () => void;
  onWorldReady?: () => void;
  onBinderArrivalReady?: () => void;
  onRoomAppearance?: (style: NativeRoomStyle) => void;
  roomGuidance?: ReactNode;
  loadingCovered?: boolean;
  suppressAmbientGuidance?: boolean;
  deferFirstRoomEdit?: boolean;
}) {
  const loadCopy = useRef(copy);
  loadCopy.current = copy;
  const onboardingEvents = useRef({ onLiveSnapshotReady, onLivePlacementConfirmed, onLiveBinderConfirmed, onLiveSnapshotFailed });
  onboardingEvents.current = { onLiveSnapshotReady, onLivePlacementConfirmed, onLiveBinderConfirmed, onLiveSnapshotFailed };
  const [snapshot, setSnapshot] = useState<NativeRoomSnapshot | null>(null);
  const [items, setItems] = useState<RoomRenderable[]>([]);
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [view, setView] = useState<NativeWorldView>({ kind: "home" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { width: overlayWidth, height: overlayHeight, fontScale } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [footerHeight, setFooterHeight] = useState(0);
  const [privateRoom, setPrivateRoom] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paused, setPaused] = useState(false);
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [turnDir, setTurnDir] = useState<1 | -1 | 0>(0);
  const binderTurnLock = useRef(false);
  useEffect(() => { if (turnDir === 0) binderTurnLock.current = false; }, [turnDir]);
  const [turningSpreadIndex, setTurningSpreadIndex] = useState<number | null>(null);
  const [heldId, setHeldId] = useState<string | null>(null);
  const [placingItem, setPlacingItem] = useState<RoomRenderable | null>(null);

  const [storageArchiveId, setStorageArchiveId] = useState<string | null>(null);
  const [storageOpen, setStorageOpen] = useState(false);
  const [storageQuery, setStorageQuery] = useState("");
  const [roomStyle, setRoomStyle] = useState<NativeRoomStyle>(DEFAULT_ROOM_STYLE);
  const [styleOpen, setStyleOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [photoStringId, setPhotoStringId] = useState<string | null>(null);
  const [publicStringCards, setPublicStringCards] = useState<PublicPhotoStringCard[]>([]);
  const helperOpacity = useRef(new Animated.Value(1)).current;
  const shopSaving = useRef(false);
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
  const liveSync = useRef(new LiveRoomSync()).current;
  const leaving = useRef(false);
  const [homeSaving, setHomeSaving] = useState(false);
  const reducedMotionRef = useRef(reducedMotion);
  const exploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const homeExploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const frozenExploreRef = useRef<ExploreOffset>({ ...IDENTITY_EXPLORE });
  const gestureRef = useRef({ lastDx: 0, lastDy: 0, pinching: false, pinchStart: 0, dollyStart: 1, binderTurned: false, objectDrag: false, releasing: false });
  // Selection never owns touches. Only an object-origin long press grants drag ownership.
  const activeTouchesRef = useRef(0);
  const touchOwnerRef = useRef<string | null>(null);
  const dragOwnerRef = useRef<string | null>(null);
  const heldRef = useRef<HeldEdit | null>(null);
  const queuedStorageRef = useRef<HeldEdit | null>(null);
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
  useEffect(() => () => {
    if (helperTimer.current) clearTimeout(helperTimer.current);
    helperOpacity.stopAnimation();
  }, [helperOpacity]);

  function applyLoadedLayout(next: RoomLayoutState, readOnlyRoom: boolean, loadedItems: RoomRenderable[] = latestItems.current) {
    clearPendingPress();
    clearHeldVisual();
    touchOwnerRef.current = null;
    activeTouchesRef.current = 0;
    gestureRef.current.pinching = false;
    gestureRef.current.lastDx = gestureRef.current.lastDy = 0;
    setSelectedObjectId(null);
    setSelectedId(null);
    if (!demo) {
      layoutStateRef.current = next;
      latestObjects.current = next.objects;
    }
    setRoomLayout(next);
    if (viewRef.current.kind === "edit") return;
    if (deferFirstRoomEdit || !shouldAutoEnterFirstRoomEdit(next, readOnlyRoom)) return;
    firstEntryRef.current = true;
    onboardingTrace("room_intro_selection", { stage: "first-room-edit" });
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
    helperOpacity.stopAnimation();
    helperOpacity.setValue(1);
    setHelperKind(kind);
    const lifetime = reducedMotionRef.current ? 1800 : 2600;
    const duration = reducedMotionRef.current ? 100 : 350;
    helperTimer.current = setTimeout(() => {
      Animated.timing(helperOpacity, { toValue: 0, duration, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setHelperKind(null);
      });
    }, lifetime - duration);
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
    const ticket = liveSync.beginLoad();
    if (!demo) {
      await liveSync.idle();
      if (!liveSync.acceptsLoad(ticket)) return;
    }
    try {
      if (demo) {
        if (!__DEV__) throw new Error("demo_world_forbidden");
        const demoRoom = loadDemoRoom();
        if (mode === "public" && userId) {
          const next = demoRoom.buildFixtureRoomSnapshot(userId);
          setSnapshot(next);
          const publicLayout = parseRoomLayout(next.room.layout);
          setPublicStringCards(publicLayout.objects.flatMap((object) => (object.photoString?.slots ?? []).flatMap((id, slot) => {
            const h = next.holdings.find((holding) => holding.id === id && holding.template.kind === "photocard" && holding.template.status !== "restricted");
            return h ? [{ objectId: object.id, slot, templateId: h.templateId, template: { id: h.template.id, name: h.template.name, kind: h.template.kind, groupName: h.template.groupName, memberName: h.template.memberName } }] : [];
          })));
          setHoldings(next.holdings);
          setItems(buildRoomRenderables(next.holdings, next.placements));
          setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
          applyLoadedLayout(parseRoomLayout(next.room.layout), mode === "public", buildRoomRenderables(next.holdings, next.placements));
          setOwnerName(demoRoom.demoCollectorDisplayName(userId));
          setPrivateRoom(false);
        } else {
          const next = demoRoom.buildFixtureRoomSnapshot(undefined, { ownStarter: true });
          setOwnerName(demoRoom.demoCollectorDisplayName(next.room.ownerUserId));
          setSnapshot(next);
          setHoldings(next.holdings);
          setItems(buildRoomRenderables(next.holdings, next.placements));
          setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
          applyLoadedLayout(parseRoomLayout(next.room.layout), false, buildRoomRenderables(next.holdings, next.placements));
          setPrivateRoom(false);
        }
      } else if (mode === "public" && userId) {
        const publicRoom = await loadCollectorRoom(userId);
        if (!liveSync.acceptsLoad(ticket)) return;
        if (publicRoom.viewerUserId && publicRoom.viewerUserId === publicRoom.owner.userId) {
          onOwnRoomRef.current?.();
          return;
        }
        setOwnerName(publicRoom.owner.displayName);
        setPrivateRoom(publicRoom.private || !publicRoom.room);
        const nextItems = publicRoom.room ? buildPublicRoomRenderables(publicRoom.room.id, publicRoom.room.placements) : [];
        const worldItems = nextItems.filter(item => item.holding.template.kind !== "photocard");
        setItems(worldItems);
        setHoldings(nextItems.map((item) => item.holding));
        setPublicStringCards(publicRoom.room?.photoStringCards ?? []);
        setRoomStyle(parseRoomStyle(publicRoom.room?.style, DEFAULT_ROOM_STYLE));
        applyLoadedLayout(parseRoomLayout(publicRoom.room?.layout), true, worldItems);
        setSnapshot(publicRoom.room ? {
          room: { id: publicRoom.room.id, ownerUserId: publicRoom.owner.userId, themeId: "hearth", style: parseRoomStyle(publicRoom.room.style), layout: publicRoom.room.layout },
          placements: [],
          holdings: nextItems.map((item) => item.holding),
        } : null);
      } else if (persistLive) {
        const next = await loadNativeRoom();
        const identity = await loadCollectorProfile(next.room.ownerUserId).catch(() => null);
        if (!liveSync.acceptsLoad(ticket)) return;
        liveSync.resetConfirmed();
        setOwnerName(identity?.profile.user.displayName ?? "");
        setSnapshot(next);
        setHoldings(next.holdings);
        setItems(buildRoomRenderables(next.holdings.filter(h => h.template.kind !== "photocard"), next.placements));
        setRoomStyle(parseRoomStyle(next.room.style, defaultStyleForTheme(next.room.themeId)));
        applyLoadedLayout(parseRoomLayout(next.room.layout), false, buildRoomRenderables(next.holdings.filter(h => h.template.kind !== "photocard"), next.placements));
        setPrivateRoom(false);
        onboardingEvents.current.onLiveSnapshotReady?.(next);
      } else {
        setError(loadCopy.current.demoRoomUnavailable);
        setLoading(false);
        return;
      }
      setError(null);
    } catch {
      if (demo || liveSync.acceptsLoad(ticket)) {
        setError(loadCopy.current.roomUnavailable);
        if (!demo) onboardingEvents.current.onLiveSnapshotFailed?.();
      }
    } finally {
      if (demo || liveSync.acceptsLoad(ticket)) setLoading(false);
    }
    // applyLoadedLayout is a local helper over refs/setters; including it retriggers Room fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, mode, persistLive, userId, liveSync, deferFirstRoomEdit]);

  useFocusEffect(useCallback(() => {
    clearPendingPress();
    clearHeldVisual();
    setSelectedObjectId(null);
    setSelectedId(null);
    selectedRef.current = null;
    binderReturnRef.current = null;
    setOwnerName("");
    viewRef.current = { kind: "home" };
    setView({ kind: "home" });
    touchOwnerRef.current = null;
    activeTouchesRef.current = 0;
    gestureRef.current.pinching = false;
    void refresh();
    return () => { if (!demo) liveSync.cancelLoad(); clearPendingPress(); clearHeldVisual(); touchOwnerRef.current = null; };
  }, [refresh, demo, liveSync]));

  const binderPages = useMemo(() => buildNativeBinderPages(holdings, copy.binderGeneral ?? "Your Photocards"), [copy.binderGeneral, holdings]);
  const spreads = useMemo(() => binderSpreads(binderPages), [binderPages]);
  const binderSpreadIndex = view.kind === "binder" ? Math.min(view.spread, Math.max(0, spreads.length - 1)) : 0;
  const currentSpread = spreads[binderSpreadIndex];
  const turningSpread = turningSpreadIndex != null ? spreads[turningSpreadIndex] : undefined;

  const initialBinderOpened = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!initialHoldingId || initialBinderOpened.current === initialHoldingId || !spreads.length || !objectHasKind(roomLayout.objects, "desk")) return;
    if (spreadIndexForHolding(spreads, initialHoldingId) < 0) return;
    // A competing user view is not acknowledgement of a Binder entrance.
    // Keep the request pending until that interaction returns home.
    if (viewRef.current.kind === "binder") {
      initialBinderOpened.current = initialHoldingId;
      // Confirm newly hydrated membership without restarting a manual entrance.
      if (!demo && mode === "own") onboardingEvents.current.onLiveBinderConfirmed?.([initialHoldingId]);
      return;
    }
    if (viewRef.current.kind !== "home") { startupTrace("binder arrival", "waiting_for_home"); return; }
    if (openBinderFromWorld(initialHoldingId)) {
      initialBinderOpened.current = initialHoldingId;
      startupTrace("binder arrival", "request_accepted");
    } else startupTrace("binder arrival", "awaiting_layout");
    // Changes to page data must not restart the entrance or overwrite user gestures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialHoldingId, spreads, roomLayout.objects, view.kind]);

  function clearPendingPress() {
    if (pendingPressRef.current) clearTimeout(pendingPressRef.current.timer);
    pendingPressRef.current = null;
  }

  function clearHeldVisual() {
    heldRef.current = null;
    queuedStorageRef.current = null;
    heldObjectRef.current = null;
    previewRef.current = null;
    objectPreviewRef.current = null;
    furnitureCarryRef.current = null;
    highlightSurfaceIdRef.current = null;
    gestureRef.current.objectDrag = false;
    dragOwnerRef.current = null;
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
    onMoveShouldSetPanResponderCapture: (event, gesture) => {
      if (viewRef.current.kind === "inspect") return false;
      if (heldRef.current || heldObjectRef.current) return Math.hypot(gesture.dx, gesture.dy) > 2;
      if (pendingPressRef.current && Math.hypot(gesture.dx, gesture.dy) > LONG_PRESS_SLOP_PX) {
        if (pendingPressRef.current) clearTimeout(pendingPressRef.current.timer);
        pendingPressRef.current = null;
      }
      if (event.nativeEvent.touches.length >= 2 && exploreAllowedForView(viewRef.current)) return true;
      return Math.hypot(gesture.dx, gesture.dy) > 10;
    },
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
      clearPendingPress();
      gestureRef.current.binderTurned = false;
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
      const ownsDrag = dragOwnerRef.current !== null && event.nativeEvent.touches.length === 1 && String(event.nativeEvent.touches[0].identifier) === dragOwnerRef.current;
      if ((heldRef.current || heldObjectRef.current) && !ownsDrag) clearHeldVisual();
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
          held.origin, latestObjects.current, snapshotRef.current?.room.id ?? "",
        );
        if (!candidate) {
          held.valid = false;
          highlightSurfaceIdRef.current = null;
          return;
        }
        held.current = candidate.current;
        held.valid = candidate.valid;
        objectPreviewRef.current = liftRoomObject(resolveRoomObjectTransform(candidate.current, latestObjects.current), reducedMotionRef.current);
        furnitureCarryRef.current = snapshotRef.current?.room
          ? { roomId: snapshotRef.current.room.id, origin: held.origin, current: candidate.current }
          : null;
        highlightSurfaceIdRef.current = candidate.valid
          ? (candidate.current.parent ? surfacesOwnedBy(snapshotRef.current?.room.id ?? "", latestObjects.current.find(o => o.id === candidate.current.parent?.objectId)!).find(id => authoredSurfaceIdFor(snapshotRef.current?.room.id ?? "", latestObjects.current.find(o => o.id === candidate.current.parent?.objectId)!, id) === candidate.current.parent?.surfaceId) ?? null : candidate.surfaceKind === "wall" ? `${snapshotRef.current?.room.id ?? ""}-wall` : `${snapshotRef.current?.room.id ?? ""}-floor`)
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
      if (viewRef.current.kind === "binder" && !viewRef.current.heldHoldingId && Math.abs(gesture.dx) > 48 && turnDir === 0 && !gestureRef.current.binderTurned) {
        const dir = gesture.dx < 0 ? 1 : -1;
        const to = binderSpreadIndex + dir;
        if (to >= 0 && to < spreads.length && !binderTurnLock.current) {
          gestureRef.current.binderTurned = true;
          binderTurnLock.current = true;
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
      clearPendingPress();
      dragOwnerRef.current = null;
      touchOwnerRef.current = null;
      gestureRef.current.pinching = false;
      if (heldObjectRef.current) void releaseHeldObject();
      else if (heldRef.current) void releaseHeld();
    },
    onPanResponderTerminate: () => {
      clearPendingPress();
      clearHeldVisual();
      touchOwnerRef.current = null;
      gestureRef.current.pinching = false;
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
  useEffect(() => { onRoomAppearance?.(roomStyle); }, [onRoomAppearance, roomStyle]);
  const controlSurface = roomChromeSurface(overlayTheme);

  async function leaveHome() {
    if (leaving.current) return;
    leaving.current = true; setHomeSaving(true);
    onboardingTrace("room_home_intent", { intent: "profile" });
    try {
      if (viewRef.current.kind === "edit" && !await saveEditing()) return;
      if (!demo) await liveSync.idle();
      onLeave();
    } finally { leaving.current = false; setHomeSaving(false); }
  }

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

  function selectZone(zone: CanonicalZoneKind, objectId?: string) {
    if (editing) return;
    if (viewRef.current.kind === "home") homeExploreRef.current = { ...exploreRef.current };
    exploreRef.current = { ...IDENTITY_EXPLORE };
    if (zone === "binder") {
      openBinderFromWorld();
      return;
    }
    setSelectedId(null);
    setView({ kind: "zone", zone, ...(objectId ? { objectId } : {}) });
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
    const parent = surfaceOwner(snapshot?.room.id ?? "", latestObjects.current, item.placement?.surfaceId);
    setSelectedId(holdingId);
    if (item.holding.template.kind === "photocard") {
      openBinderFromWorld(holdingId, parent?.kind === "desk" ? parent.id : undefined);
      return;
    }
    setView(inspectView(canonical, holdingId, parent?.id));
  }

  function onCollectiblePressStart(holdingId: string, pointerId?: number) {
    if (viewRef.current.kind !== "edit" || readOnly || gestureRef.current.releasing) return;
    const owner = pointerId === undefined ? touchOwnerRef.current : String(pointerId);
    if (owner === null || owner === undefined || activeTouchesRef.current > 1) return;
    touchOwnerRef.current = owner;
    clearPendingPress();
    pendingPressRef.current = {
      holdingId,
      timer: setTimeout(() => {
        pendingPressRef.current = null;
        const queued = queuedStorageRef.current?.holdingId === holdingId ? queuedStorageRef.current : null;
        const item = latestItems.current.find((entry) => entry.holding.id === holdingId) ?? queued?.preview;
        if (!item || (!demo && item.holding.template.kind === "photocard") || viewRef.current.kind !== "edit" || touchOwnerRef.current !== owner || activeTouchesRef.current !== 1) return;
        dragOwnerRef.current = owner;
        const room = snapshotRef.current?.room;
        const world = withResolvedWorld(item, room?.id, latestObjects.current);
        const held = queued ?? acquireHeld(world, reducedMotionRef.current);
        queuedStorageRef.current = null;
        if (!queued) held.origin = cloneRenderable(item);
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

  function openBinderFromWorld(holdingId?: string, deskId?: string) {
    const originId = primaryBinderDeskId(latestObjects.current);
    const desk = latestObjects.current.find((object) => object.id === originId && object.kind === "desk");
    if (!desk) return false;
    if (holdingId && spreadIndexForHolding(spreads, holdingId) < 0) return false;

    captureBinderReturn();
    setSelectedObjectId(null);
    const index = holdingId ? spreadIndexForHolding(spreads, holdingId) : 0;
    setSelectedId(null);
    setStorageOpen(false);
    setView(openBinderView(Math.max(0, index)));
    if (!demo && mode === "own") onboardingEvents.current.onLiveBinderConfirmed?.(binderPages.flatMap(page => page.pockets.flatMap(pocket => pocket.holding ? [pocket.holding.id] : [])));
    return true;
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
    clearPendingPress();
    clearHeldVisual();
    touchOwnerRef.current = null;
    activeTouchesRef.current = 0;
    gestureRef.current.pinching = false;
    setSelectedObjectId(null);
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
    touchOwnerRef.current = null;
    activeTouchesRef.current = 0;
    gestureRef.current.pinching = false;
    styleBaseline.current = roomStyle;
    firstEntryRef.current = false;
    showHelper("edit");
    setView({ kind: "edit" });
    setSelectedId(null);
    setSelectedObjectId(null);
    setShopOpen(false);
  }

  async function cancelEditing() {
    if (shopSaving.current) return;
    clearPendingPress();
    clearHeldVisual();
    const room = snapshotRef.current?.room;
    const baseline = restoreEditBaseline(editBaseline.current);
    const currentIds = new Set(latestItems.current.map((item) => item.holding.id));
    const baselineIds = new Set(baseline.map((item) => item.holding.id));
    setItems(baseline);
    // Restore parent instances before replaying their authored child placements.
    const objects = cloneRoomObjects(objectBaseline.current);
    if (!await persistLayout({ ...layoutStateRef.current, objects, source: "authored" })) return;
    if (room) {
      try {
        await Promise.all([
          ...baseline.map((item) => persistPlacement(item, { silent: true })),
          ...[...currentIds].filter((id) => !baselineIds.has(id)).map((id) => demo
            ? Promise.resolve(loadDemoRoom().removeDemoPlacement(room.id, id))
            : removeLivePlacement(room.id, id)),
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
      else await liveSync.save("style", next, parseRoomStyle(room.style), setRoomStyle,
        () => saveNativeRoomStyle(room.id, next));
      setSnapshot((current) => current ? { ...current, room: { ...current.room, style: next } } : current);
    } catch {
      setError(copy.roomSaveFailed);
    }
  }

  async function applyRoomStyle(next: NativeRoomStyle) {
    setRoomStyle(next);
    await persistRoomStyle(next);
  }

  async function removeLivePlacement(roomId: string, holdingId: string) {
    const before = latestItems.current.find((item) => item.holding.id === holdingId);
    try {
      await liveSync.save(`placement:${holdingId}`, undefined as RoomRenderable | undefined, before, (value) => {
        const all = latestItems.current.filter((item) => item.holding.id !== holdingId);
        latestItems.current = value ? [...all, value] : all;
        setItems(latestItems.current);
      }, () => removeNativeRoomPlacement(roomId, holdingId));
    } catch (err) { setError(copy.roomSaveFailed); throw err; }
  }

  async function persistPlacement(next: RoomRenderable, options?: { silent?: boolean; world?: boolean }) {
    const room = snapshotRef.current?.room ?? snapshot?.room;
    if (!room || (!demo && next.holding.template.kind === "photocard")) return;
    const objects = latestObjects.current;
    const world = options?.world ? next : withResolvedWorld(next, room.id, objects);
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
      slot: next.placement?.slot ?? nextNativeSlot(latestItems.current.map(item => item.placement?.slot ?? 0)),
      transform: toPersistedTransform(authored),
      surfaceId: settled.surfaceId,
    };
    try {
      if (!demo) {
        const before = latestItems.current.find((item) => item.holding.id === next.holding.id);
        const stored = { ...authored, placement: { ...next.placement, ...payload, id: next.placement?.id ?? `pending-${next.holding.id}`, offset: null } };
        await liveSync.save(`placement:${next.holding.id}`, stored as RoomRenderable | undefined, before, (value) => {
          const all = latestItems.current.filter((item) => item.holding.id !== next.holding.id);
          latestItems.current = value ? [...all, value] : all;
          setItems(latestItems.current);
        }, () => saveNativeRoomPlacement(payload));
        onboardingEvents.current.onLivePlacementConfirmed?.(next.holding.id);
        return stored;
      }
      const placement = loadDemoRoom().saveDemoPlacement(payload);
      const stored = { ...authored, placement };
      setItems((all) => {
        const mapped = all.map((item) => item.holding.id === next.holding.id ? stored : item);
        return mapped.some((item) => item.holding.id === next.holding.id) ? mapped : [...mapped, stored];
      });
      return stored;
    } catch (error) {
      const diagnostic = error instanceof Error && /^room_placement:[0-9]{3}:[a-z_]+$/.test(error.message) ? error.message : null;
      if (!options?.silent || !demo) setError(__DEV__ && diagnostic ? `${copy.roomSaveFailed} (${diagnostic})` : copy.roomSaveFailed);
      return undefined;
    }
  }

  async function releaseHeld() {
    const held = heldRef.current;
    const room = snapshotRef.current?.room;
    if (!held || gestureRef.current.releasing) return;
    gestureRef.current.releasing = true;
    clearHeldVisual();
    if (!demo) gestureRef.current.releasing = false;
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
      const pending = persistPlacement(held.rest, { world: true });
      if (!demo) gestureRef.current.releasing = false;
      const stored = await pending;
      if (stored) rememberPlacement(held.origin ?? { storedHoldingId: held.holdingId }, stored);
    } finally {
      if (demo) clearHeldVisual();
      if (demo) gestureRef.current.releasing = false;
    }
  }

  async function persistLayout(next: RoomLayoutState, options?: { silent?: boolean }) {
    const room = snapshotRef.current?.room ?? snapshot?.room;
    if (!room || readOnly) return false;
    next = { ...next, objects: normalizeBinderDesk(next.objects) };
    const document = serializeRoomLayout(next);
    try {
      if (demo) loadDemoRoom().saveDemoRoomLayout(room.ownerUserId, next);
      else {
        const baseline = parseRoomLayout(room.layout);
        await liveSync.save("layout", next, baseline, (value) => {
          layoutStateRef.current = value;
          latestObjects.current = value.objects;
          setRoomLayout(value);
        }, () => saveNativeRoomLayout(room.id, document));
        setSnapshot((current) => current ? { ...current, room: { ...current.room, layout: document } } : current);
        return true;
      }
      setSnapshot((current) => current ? { ...current, room: { ...current.room, layout: document } } : current);
      setRoomLayout(next);
      layoutStateRef.current = next;
      latestObjects.current = next.objects;
      return true;
    } catch (err) {
      if (!options?.silent || !demo) setError(err instanceof Error && err.message === "room_layout_unavailable" ? copy.roomLayoutUnavailable : copy.roomSaveFailed);
      return false;
    }
  }

  async function applyRoomObjects(nextObjects: RoomObjectInstance[]) {
    const next = { ...layoutStateRef.current, source: "authored" as const, objects: cloneRoomObjects(nextObjects) };
    return persistLayout(next);
  }

  async function releaseHeldObject() {
    const held = heldObjectRef.current;
    if (!held || gestureRef.current.releasing) return;
    gestureRef.current.releasing = true;
    clearHeldVisual();
    if (!demo) gestureRef.current.releasing = false;
    suppressTapRef.current = true;
    try {
      if (!held.valid) {
        objectPreviewRef.current = null;
        furnitureCarryRef.current = null;
        if (!held.placing) showToast(isWallObject(held.origin.kind) ? copy.roomPlaceOnWall : copy.roomPlaceOnFloor);
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
      const pending = persistLayout({ ...layoutStateRef.current, source: "authored", objects: afterObjects });
      if (!demo) gestureRef.current.releasing = false;
      if (!await pending) return;
      pushPlacementHistory(undoStack.current, redoStack.current, {
        before: { storedHoldingId: held.objectId },
        after: { storedHoldingId: held.objectId },
        objectsBefore: beforeObjects,
        objectsAfter: cloneRoomObjects(afterObjects),
      });
      syncHistory();
      if (demo) {
        setSelectedObjectId(held.objectId);
        setSelectedId(null);
      }
    } finally {
      if (demo) clearHeldVisual();
      if (demo) gestureRef.current.releasing = false;
    }
  }

  async function undoPlacement() {
    if (shopSaving.current) return;
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push(entry);
    syncHistory();
    if (isObjectHistory(entry) && entry.objectsBefore) {
      if (!await applyFurnitureHistory(entry, true)) {
        redoStack.current.pop(); undoStack.current.push(entry); syncHistory();
      }
      return;
    }
    const before = entry.before;
    if (isStoredHistoryMarker(before)) {
      const room = snapshotRef.current?.room;
      if (!room) return;
      if (demo) loadDemoRoom().removeDemoPlacement(room.id, before.storedHoldingId);
      else await removeLivePlacement(room.id, before.storedHoldingId);
      if (demo) setItems((current) => storeRenderable(current, before.storedHoldingId));
      return;
    }
    await persistPlacement(before);
  }

  async function redoPlacement() {
    if (shopSaving.current) return;
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push(entry);
    syncHistory();
    if (isObjectHistory(entry) && entry.objectsAfter) {
      if (!await applyFurnitureHistory(entry, false)) {
        undoStack.current.pop(); redoStack.current.push(entry); syncHistory();
      }
      return;
    }
    const after = entry.after;
    if (isStoredHistoryMarker(after)) {
      const room = snapshotRef.current?.room;
      if (!room) return;
      if (demo) loadDemoRoom().removeDemoPlacement(room.id, after.storedHoldingId);
      else await removeLivePlacement(room.id, after.storedHoldingId);
      if (demo) setItems((current) => storeRenderable(current, after.storedHoldingId));
      return;
    }
    await persistPlacement(after);
  }

  async function saveEditing() {
    if (shopSaving.current) return false;
    const room = snapshot?.room;
    if (!room) {
      setView({ kind: "home" });
      return true;
    }
    const baselineIds = new Set(editBaseline.current.map((item) => item.holding.id));
    const currentIds = new Set(items.map((item) => item.holding.id));
    try {
      clearPendingPress();
      clearHeldVisual();
      await Promise.all([
        ...items.map(async (item) => {
          const saved = await persistPlacement(item);
          if (!saved) throw new Error("room_placement_write_failed");
        }),
        ...[...baselineIds].filter((id) => !currentIds.has(id)).map((id) => demo
          ? Promise.resolve(loadDemoRoom().removeDemoPlacement(room.id, id))
          : removeLivePlacement(room.id, id)),
      ]);
      const completed = markFirstRoomEditComplete(layoutStateRef.current);
      if (!await persistLayout(completed)) return false;
      firstEntryRef.current = false;
      exploreRef.current = { ...homeExploreRef.current };
      setView({ kind: "home" });
      setSelectedId(null);
      setSelectedObjectId(null);
      setStyleOpen(false);
      setShopOpen(false);
      setHelperKind(null);
      return true;
    } catch {
      setError(copy.roomSaveFailed);
      return false;
    }
  }

  function beginPlaceFromStorage(holding: NativeHolding) {
    if (!snapshot || readOnly) return;
    if (!demo && holding.template.kind === "photocard") { openBinderFromWorld(holding.id); return; }
    if (viewRef.current.kind !== "edit") return;
    const draft = createInitialRoomRenderable(holding, nextNativeSlot(items.map((item) => item.placement?.slot ?? 0)), snapshot.room.id);
    const held = acquirePlaceFromStorage(draft, reducedMotionRef.current, storageTakeoutFor(latestObjects.current, storageArchiveId));
    clearPendingPress();
    clearHeldVisual();
    queuedStorageRef.current = held;
    previewRef.current = held.preview;
    highlightSurfaceIdRef.current = null;
    suppressTapRef.current = true;
    setSelectedId(holding.id);
    setHeldId(null);
    setPlacingItem(held.preview);
    setStorageOpen(false);
    setStorageQuery("");
  }

  async function beginPlaceFromShop(kind: RoomObjectKind) {
    if (readOnly || shopSaving.current || viewRef.current.kind !== "edit" || !canAddRoomObject(latestObjects.current, kind)) return;
    shopSaving.current = true;
    const beforeLayout = layoutStateRef.current;
    const beforeObjects = cloneRoomObjects(latestObjects.current);
    const draft = spawnRoomObject(beforeObjects, kind);
    const next = { ...layoutStateRef.current, source: "authored" as const, objects: normalizeBinderDesk([...beforeObjects, draft]) };
    // Render the grounded starter immediately; pointer movement is a separate Move action.
    latestObjects.current = next.objects;
    setRoomLayout(next);
    setSelectedObjectId(draft.id);
    setSelectedId(null);
    setShopOpen(false);
    setHelperKind(null);
    try {
      if (await persistLayout(next)) {
        pushPlacementHistory(undoStack.current, redoStack.current, {
          before: { storedHoldingId: draft.id }, after: { storedHoldingId: draft.id },
          objectsBefore: beforeObjects, objectsAfter: cloneRoomObjects(next.objects),
        });
        syncHistory();
      } else {
        latestObjects.current = beforeObjects;
        layoutStateRef.current = beforeLayout;
        setRoomLayout(beforeLayout);
        setSelectedObjectId(null);
      }
    } finally { shopSaving.current = false; }
  }

  async function savePhotoString(slots: (string | null)[]) {
    if (readOnly || !photoStringId || shopSaving.current) return false;
    const before = cloneRoomObjects(latestObjects.current);
    const object = before.find((o) => o.id === photoStringId);
    if (!object) return false;
    const nextObject = configuredPhotoString(object, slots, holdings);
    const after = replaceRoomObject(before, nextObject);
    if (!await persistLayout({ ...layoutStateRef.current, source: "authored", objects: after })) return false;
    if (viewRef.current.kind === "edit") {
      pushPlacementHistory(undoStack.current, redoStack.current, {
        before: { storedHoldingId: object.id }, after: { storedHoldingId: object.id }, objectsBefore: before, objectsAfter: cloneRoomObjects(after),
      });
      syncHistory();
    }
    return true;
  }

  async function replayFurnitureChildren(source: RoomRenderable[], target: RoomRenderable[]) {
    const room = snapshotRef.current?.room;
    if (!room) return;
    const targetIds = new Set(target.map((item) => item.holding.id));
    for (const item of source) {
      if (targetIds.has(item.holding.id)) continue;
      if (demo) loadDemoRoom().removeDemoPlacement(room.id, item.holding.id);
      else await removeLivePlacement(room.id, item.holding.id);
      if (demo) setItems((items) => storeRenderable(items, item.holding.id));
    }
    for (const item of target) {
      if (!await persistPlacement(item, { silent: true })) throw new Error("room_child_restore_failed");
    }
  }

  async function applyFurnitureHistory(entry: PlacementHistoryEntry<RoomRenderable, RoomObjectInstance>, undo: boolean) {
    const source = undo ? entry.objectsAfter! : entry.objectsBefore!;
    const target = undo ? entry.objectsBefore! : entry.objectsAfter!;
    const sourceChildren = undo ? entry.childrenAfter ?? [] : entry.childrenBefore ?? [];
    const targetChildren = undo ? entry.childrenBefore ?? [] : entry.childrenAfter ?? [];
    shopSaving.current = true;
    try {
      if (!await applyRoomObjects(target)) return false;
      await replayFurnitureChildren(sourceChildren, targetChildren);
      return true;
    } catch {
      await applyRoomObjects(source);
      try { await replayFurnitureChildren(targetChildren, sourceChildren); } catch { /* Save error remains visible. */ }
      setError(copy.roomSaveFailed);
      return false;
    } finally { shopSaving.current = false; }
  }

  async function removeSelectedObject() {
    if (!selectedObjectId || readOnly || shopSaving.current) return;
    const current = latestObjects.current;
    const target = current.find((item) => item.id === selectedObjectId);
    const room = snapshotRef.current?.room;
    if (!target || !room) return;
    let next: RoomObjectInstance[];
    try { next = removeFurnitureSafely(current, selectedObjectId); } catch { showToast(copy.roomBinderNeedsDesk); return; }
    const children = cloneRenderables(childrenOnInstance(latestItems.current, room.id, current, selectedObjectId));
    const entry: PlacementHistoryEntry<RoomRenderable, RoomObjectInstance> = {
      before: { storedHoldingId: selectedObjectId }, after: { storedHoldingId: selectedObjectId },
      objectsBefore: cloneRoomObjects(current), objectsAfter: cloneRoomObjects(next),
      childrenBefore: children, childrenAfter: [],
    };
    // Store only this instance's placements. Holdings and Binder eligibility stay untouched.
    if (!await applyFurnitureHistory(entry, false)) return;
    pushPlacementHistory(undoStack.current, redoStack.current, entry);
    syncHistory();
    setSelectedObjectId(null);
    if (children.some((item) => item.holding.id === selectedId)) setSelectedId(null);
  }

  async function turnSelectedObject() {
    if (!selectedObjectId || readOnly || shopSaving.current) return;
    const current = latestObjects.current;
    const target = current.find((item) => item.id === selectedObjectId);
    if (!target || !TURNABLE_ROOM_OBJECT_KINDS.has(target.kind)) return;
    const beforeLayout = layoutStateRef.current;
    const nextObject = turnRoomObject(target, current);
    const next = replaceRoomObject(current, nextObject);
    const nextLayout = { ...beforeLayout, source: "authored" as const, objects: next };
    // Show the turn and coherent clamp immediately; failed Live saves restore the prior state.
    if (demo) shopSaving.current = true;
    if (demo) {
      latestObjects.current = next;
      layoutStateRef.current = nextLayout;
      setRoomLayout(nextLayout);
    }
    const saved = await persistLayout(nextLayout);
    if (demo) shopSaving.current = false;
    if (!saved) {
      if (!demo) return;
      latestObjects.current = current;
      layoutStateRef.current = beforeLayout;
      setRoomLayout(beforeLayout);
      return;
    }
    pushPlacementHistory(undoStack.current, redoStack.current, {
      before: { storedHoldingId: selectedObjectId },
      after: { storedHoldingId: selectedObjectId },
      objectsBefore: cloneRoomObjects(current),
      objectsAfter: cloneRoomObjects(next),
      childrenBefore: [],
      childrenAfter: [],
    });
    syncHistory();
  }

  function onObjectPressStart(objectId: string, pointerId?: number) {
    if (viewRef.current.kind !== "edit" || readOnly || shopSaving.current || gestureRef.current.releasing) return;
    const owner = pointerId === undefined ? touchOwnerRef.current : String(pointerId);
    if (owner === null || owner === undefined || activeTouchesRef.current > 1) return;
    touchOwnerRef.current = owner;
    clearPendingPress();
    pendingPressRef.current = {
      holdingId: `object:${objectId}`,
      timer: setTimeout(() => {
        pendingPressRef.current = null;
        const object = latestObjects.current.find((item) => item.id === objectId);
        if (!object || viewRef.current.kind !== "edit" || touchOwnerRef.current !== owner || activeTouchesRef.current !== 1) return;
        dragOwnerRef.current = owner;
        const held = acquireRoomObject(object);
        heldObjectRef.current = held;
        objectPreviewRef.current = liftRoomObject(resolveRoomObjectTransform(object, latestObjects.current), reducedMotionRef.current);
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
      else await removeLivePlacement(snapshot.room.id, selectedId);
      if (demo) setItems((current) => storeRenderable(current, selectedId));
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
      ? nativeRoomSurfaces(snapshot.room.id, roomLayout.objects).filter((surface) => heldObjectRef.current?.origin.kind === "plant" || heldObjectRef.current?.origin.kind === "table-lamp"
        ? surface.kind === "horizontal" && !surface.id.endsWith("-binder")
        : isWallObject(heldObjectRef.current?.origin.kind ?? "lamp") ? surface.kind === "wall" : surface.id.endsWith("-floor"))
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
  const overlayLayout = roomOverlayLayout({ width: overlayWidth, height: overlayHeight, fontScale, insets, headerHeight, footerHeight,
    hasFooter: Boolean(editing || binderHeld || (selectedItem && view.kind !== "binder")),
  });
  const overlayPad = overlayLayout.navigation;
  const trayPad = overlayLayout.footer;
  const measureHeader = (event: LayoutChangeEvent) => setHeaderHeight(event.nativeEvent.layout.height);
  const measureFooter = (event: LayoutChangeEvent) => setFooterHeight(event.nativeEvent.layout.height);

  if (liveRoomNeedsHydration(demo, loading, snapshot !== null || privateRoom)) {
    if (!error) return loadingCovered ? <View style={{ flex: 1 }} /> : <SeoullyLoadingState fullScreen label={copy.enteringYourRoom} />;
    return <View style={[styles.world, immersiveRoomFill(roomTheme.void)]}>
      <Stack.Screen options={{ contentStyle: immersiveRoomFill(roomTheme.void) }} />
      <OverlayChrome copy={copy} chrome={overlayTheme} onBack={mode === "own" ? () => void leaveHome() : onLeave} home={mode === "own"} busy={homeSaving} style={overlayPad} onLayout={measureHeader} />
      <View style={styles.empty}><RoomMessage chrome={overlayTheme}>
        <SeoullyText accessibilityRole="alert" style={roomMessageStyles.text} color={overlayTheme.color}>{error}</SeoullyText>
        {error ? <Pressable onPress={() => void refresh()}><SeoullyText variant="button" color={overlayTheme.color}>{copy.retry}</SeoullyText></Pressable> : null}
      </RoomMessage></View>
    </View>;
  }

  if (privateRoom && !loading) {
    return <View style={[styles.world, immersiveRoomFill(roomTheme.void)]}>
      <Stack.Screen options={{ contentStyle: immersiveRoomFill(roomTheme.void) }} />
      <OverlayChrome
        copy={copy}
        chrome={overlayTheme}
        onBack={mode === "own" ? () => void leaveHome() : onLeave} home={mode === "own"} busy={homeSaving}
        style={overlayPad} onLayout={measureHeader}
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
      onTouchStart={(event) => {
        const touches = event.nativeEvent.touches;
        activeTouchesRef.current = touches.length;
        if (touches.length !== 1) {
          clearPendingPress(); clearHeldVisual(); touchOwnerRef.current = null;
        } else {
          touchOwnerRef.current = String(touches[0].identifier);
        }
      }}
      onTouchEnd={(event) => {
        // Mesh pointer-up is not guaranteed when the finger leaves its hit target.
        activeTouchesRef.current = event.nativeEvent.touches.length;
        gestureRef.current.pinching = false;
        clearPendingPress();
        touchOwnerRef.current = null;
        dragOwnerRef.current = null;
        if (heldObjectRef.current) void releaseHeldObject();
        else if (heldRef.current) void releaseHeld();
      }}
      onTouchCancel={() => {
        activeTouchesRef.current = 0;
        gestureRef.current.pinching = false;
        clearPendingPress(); clearHeldVisual(); touchOwnerRef.current = null;
      }}
    >
      <Suspense fallback={demo || loadingCovered ? null : <SeoullyLoadingState fullScreen label={copy.enteringYourRoom} />}>
        <NativeRoomRenderer
          key={canvasEpoch}
          onWorldReady={onWorldReady}
          onBinderArrivalReady={onBinderArrivalReady}
          ownerName={ownerName}
          items={items}
          photoStringHoldings={holdings}
          publicStringCards={publicStringCards}
          onConfigurePhotoString={readOnly ? undefined : (id) => setPhotoStringId(id)}
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
          binderDeskId={primaryBinderDeskId(roomLayout.objects)}
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
              setView({ kind: "zone", zone: view.zone, ...(view.objectId ? { objectId: view.objectId } : {}) });
            }
            setSelectedId(null);
          }}
          onOpenBinder={deskPresent ? () => openBinderFromWorld() : undefined}
          onOpenStorage={readOnly ? undefined : (objectId) => { setStorageArchiveId(objectId ?? null); setStorageOpen(true); }}
          placingItem={placingItem}
          onCardMediaError={() => setError(copy.roomMediaLoadFailed)}
          onHoldCard={(holding) => {
            if (view.kind !== "binder") return;
            setBinderHintSeen(true);
            setInspectNotice(null);
            setView({ kind: "binder", spread: view.spread, ...(holding ? { heldHoldingId: holding.id } : {}) });
          }}
          onTurnEdge={(dir) => {
            if (view.kind === "binder" && view.heldHoldingId) return;
            setBinderHintSeen(true);
            const to = binderSpreadIndex + dir;
            if (to < 0 || to >= spreads.length || turnDir !== 0 || binderTurnLock.current) return;
            binderTurnLock.current = true;
            setTurnDir(dir);
            setTurningSpreadIndex(to);
          }}
          onTurnCancel={() => { setTurnDir(0); setTurningSpreadIndex(null); }}
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
        onBack={mode === "own" ? () => void leaveHome() : goBack} home={mode === "own"} busy={homeSaving}
        editing={editing}
        readOnly={readOnly}
        onEdit={beginEditing}
        onCancel={() => void cancelEditing()}
        style={overlayPad} onLayout={measureHeader}
        showStorage={!readOnly && !archivePresent}
        onStorage={() => setStorageOpen(true)}
      />
      <View pointerEvents="box-none" style={[styles.messageStack, overlayLayout.messages]}>
        <ScrollView pointerEvents="box-none" style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={styles.messageContent} keyboardShouldPersistTaps="handled">
          {error ? <Pressable accessibilityRole="button" onPress={() => void refresh()}><RoomMessage chrome={overlayTheme}><SeoullyText accessibilityRole="alert" style={roomMessageStyles.text} color={overlayTheme.color}>{error} · {copy.retry}</SeoullyText></RoomMessage></Pressable> : null}
          {roomGuidance}
          {helperKind && !roomGuidance && !suppressAmbientGuidance ? <Animated.View pointerEvents="none" style={{ opacity: helperOpacity }}><RoomMessage chrome={overlayTheme} pointerEvents="none">
            <SeoullyText variant="handle" color={overlayTheme.color} style={[roomMessageStyles.text, styles.helperTitle]}>{helperKind === "first" ? copy.roomFirstTitle : copy.roomEditHoldHint}</SeoullyText>
            {helperKind === "first" ? <SeoullyText color={overlayTheme.color} style={roomMessageStyles.text}>{copy.roomFirstLead}</SeoullyText> : null}
            {helperKind === "edit" ? <SeoullyText color={overlayTheme.color} style={roomMessageStyles.text}>{copy.roomEditLookHint}</SeoullyText> : null}
          </RoomMessage></Animated.View> : null}
          {hint && ((!roomGuidance && !suppressAmbientGuidance) || toast || placingItem) ? <RoomMessage chrome={overlayTheme} pointerEvents="none"><SeoullyText color={overlayTheme.color} style={roomMessageStyles.text}>{hint}</SeoullyText></RoomMessage> : null}
          {deskPresent && view.kind === "zone" && view.zone === "desk" && !selectedItem ? <RoomMessage chrome={overlayTheme}>
            <Pressable accessibilityRole="button" onPress={() => openBinderFromWorld()} style={[styles.toolChip, controlSurface]}><SeoullyText variant="caption" color={overlayTheme.color}>{copy.openBinder}</SeoullyText></Pressable>
          </RoomMessage> : null}
          {__DEV__ && demo && !readOnly && editing ? <Pressable accessibilityLabel="Reset Demo to Starter Room" onPress={() => {
            if (!__DEV__ || !demo || mode !== "own" || !snapshot) return;
            loadDemoRoom().resetDemoRoomToStarter(snapshot.room.ownerUserId); onLeave();
          }}><RoomMessage chrome={overlayTheme}><SeoullyText variant="caption" color={overlayTheme.color}>Reset Demo to Starter Room</SeoullyText></RoomMessage></Pressable> : null}
        </ScrollView>
      </View>
      {!loading ? <RoomEntranceTitle key={entranceLabel} label={entranceLabel} color={entranceTone.color} shadow={entranceTone.shadow} reducedMotion={reducedMotion} /> : null}
      {selectedItem && !editing && view.kind !== "binder" ? <InspectionTray
        roomChrome={overlayTheme}
        holding={selectedItem.holding}
        copy={copy}
        notice={inspectNotice}
        style={trayPad} onLayout={measureFooter}
        onView={onInspectCollectible ? () => onInspectCollectible(selectedItem.holding.id) : undefined}
        onOpenBinder={deskPresent && selectedItem.holding.template.kind === "photocard" ? () => openBinderFromWorld(selectedItem.holding.id) : undefined}
        onWishlist={readOnly && onWishlistCollectible ? () => { void wishlistHolding(selectedItem.holding); } : undefined}
        onMessage={readOnly && onMessageCollectible ? () => onMessageCollectible(selectedItem.holding) : undefined}
        onClose={goBack}
        closeLabel={copy.close}
      /> : null}
      {binderHeld ? <InspectionTray
        roomChrome={overlayTheme}
        holding={binderHeld}
        copy={copy}
        notice={inspectNotice}
        style={trayPad} onLayout={measureFooter}
        onView={onInspectCollectible ? () => onInspectCollectible(binderHeld.id) : undefined}
        onWishlist={readOnly && onWishlistCollectible ? () => { void wishlistHolding(binderHeld); } : undefined}
        onMessage={readOnly && onMessageCollectible ? () => onMessageCollectible(binderHeld) : undefined}
        onClose={() => setView({ kind: "binder", spread: view.kind === "binder" ? view.spread : 0 })}
        closeLabel={copy.returnToBinder}
      /> : null}
      {editing ? <View pointerEvents="box-none" onLayout={measureFooter} style={[styles.editBar, trayPad]}>
        {selectedItem && !heldId && !placingItem ? <View style={[styles.contextRow, controlSurface]}>
          <SeoullyText numberOfLines={1} variant="caption" color={overlayTheme.color} style={styles.selection}>{selectedItem.holding.template.name}</SeoullyText>
          <Pressable onPress={() => void storeSelected()} style={[styles.toolChip, controlSurface]}><SeoullyText variant="caption" color={overlayTheme.color}>{copy.removeFromRoom}</SeoullyText></Pressable>
        </View> : null}
        {selectedRoomObject && !heldObjectId && !placingItem ? <View style={[styles.contextRow, controlSurface]}>
          {selectedRoomObject.kind === "desk" ? <Pressable onPress={() => openBinderFromWorld(undefined, selectedRoomObject.id)} style={[styles.toolChip, controlSurface]}><SeoullyText variant="caption" color={overlayTheme.color}>{copy.openBinder}</SeoullyText></Pressable> : null}
          {selectedRoomObject.kind === "photo-string" ? <Pressable onPress={() => setPhotoStringId(selectedRoomObject.id)} style={[styles.toolChip, controlSurface]}><SeoullyText variant="caption" color={overlayTheme.color}>{copy.roomChoosePhotocards}</SeoullyText></Pressable> : null}
          {TURNABLE_ROOM_OBJECT_KINDS.has(selectedRoomObject.kind) ? <Pressable onPress={() => void turnSelectedObject()} style={[styles.toolChip, controlSurface]}><SeoullyText variant="caption" color={overlayTheme.color}>{copy.roomTurn}</SeoullyText></Pressable> : null}
          <Pressable onPress={() => void removeSelectedObject()} style={[styles.toolChip, controlSurface]}><SeoullyText variant="caption" color={overlayTheme.color}>{copy.roomRemoveObject}</SeoullyText></Pressable>
        </View> : null}
        {placingItem ? <Pressable onPress={() => { clearPendingPress(); clearHeldVisual(); }} style={[styles.toolChip, controlSurface]}>
          <SeoullyText variant="caption" color={overlayTheme.color}>{copy.cancelPlacement}</SeoullyText>
        </Pressable> : null}
        <View style={styles.toolRow}>
          <Pressable onPress={() => setShopOpen(true)} style={[styles.toolButton, controlSurface]}><SeoullyText variant="button" color={overlayTheme.color}>{copy.roomShop}</SeoullyText></Pressable>
          <Pressable onPress={() => setStyleOpen(true)} style={[styles.toolButton, controlSurface]}><SeoullyText variant="button" color={overlayTheme.color}>{copy.roomStyle}</SeoullyText></Pressable>
          {canUndo ? <Pressable onPress={() => void undoPlacement()} style={[styles.toolButton, controlSurface]}><SeoullyText variant="button" color={overlayTheme.color}>{copy.roomUndo}</SeoullyText></Pressable> : null}
          {canRedo ? <Pressable onPress={() => void redoPlacement()} style={[styles.toolButton, controlSurface]}><SeoullyText variant="button" color={overlayTheme.color}>{copy.roomRedo}</SeoullyText></Pressable> : null}
          <Pressable onPress={() => void saveEditing()} style={[styles.toolButton, controlSurface]}><SeoullyText variant="button" color={overlayTheme.color}>{copy.finishEditing}</SeoullyText></Pressable>
        </View>
      </View> : null}
      {!readOnly && photoStringId && roomLayout.objects.find((o) => o.id === photoStringId) ? <PhotoStringSheet
        roomChrome={overlayTheme}
        key={photoStringId} object={roomLayout.objects.find((o) => o.id === photoStringId)!} holdings={holdings}
        copy={copy} reducedMotion={reducedMotion} bottomInset={insets.bottom}
        onSave={savePhotoString} onClose={() => setPhotoStringId(null)}
      /> : null}
      {!readOnly && editing ? <RoomShopSheet
        roomChrome={overlayTheme}
        visible={shopOpen}
        objects={roomLayout.objects}
        reducedMotion={reducedMotion}
        copy={copy}
        bottomInset={insets.bottom}
        onAdd={beginPlaceFromShop}
        onClose={() => setShopOpen(false)}
      /> : null}
      {!readOnly && editing ? <RoomStyleSheet
        roomChrome={overlayTheme}
        visible={styleOpen}
        style={roomStyle}
        reducedMotion={reducedMotion}
        copy={copy}
        bottomInset={insets.bottom}
        onChange={(next) => void applyRoomStyle(next)}
        onClose={() => setStyleOpen(false)}
      /> : null}
      {!readOnly ? <StoredCollectionSheet
        roomChrome={overlayTheme}
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
        onBinder={demo ? undefined : (holding) => openBinderFromWorld(holding.id)}
        onEditToPlace={() => { beginEditing(); }}
      /> : null}
    </View>
  </View>;
}

function InspectionTray({
  roomChrome,
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
  onLayout,
}: {
  roomChrome: ReturnType<typeof roomOverlayChrome>;
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
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return <View onLayout={onLayout} style={[roomMessageStyles.surface, styles.inspection, roomChromeSurface(roomChrome), style]}>
    <View style={styles.inspectionCopy}>
      <SeoullyText numberOfLines={1} variant="handle" color={roomChrome.color} style={styles.inspectionTitle}>{holding.template.name}</SeoullyText>
      <PhotocardCollectorCount templateId={holding.templateId} kind={holding.template.kind} color={roomChrome.color} />
      <SeoullyText numberOfLines={1} variant="caption" color={roomChrome.color} style={styles.inspectionMeta}>
        {[holding.template.groupName, holding.template.memberName, collectibleKindLabel(holding.template.kind, copy)].filter(Boolean).join(" · ")}
      </SeoullyText>
    </View>
    <View style={styles.inspectionActions}>
      {onView ? <Pressable onPress={onView} style={[styles.inspectAction, roomChromeSurface(roomChrome)]}><SeoullyText variant="button" color={roomChrome.color} style={styles.inspectActionText}>{copy.viewCollectible}</SeoullyText></Pressable> : null}
      {onOpenBinder ? <Pressable onPress={onOpenBinder} style={[styles.inspectAction, roomChromeSurface(roomChrome)]}><SeoullyText variant="button" color={roomChrome.color} style={styles.inspectActionText}>{copy.openBinder}</SeoullyText></Pressable> : null}
      {onWishlist ? <Pressable onPress={onWishlist} style={[styles.inspectAction, roomChromeSurface(roomChrome)]}><SeoullyText variant="button" color={roomChrome.color} style={styles.inspectActionText}>{copy.saveToWishlist}</SeoullyText></Pressable> : null}
      {onMessage ? <Pressable onPress={onMessage} style={[styles.inspectAction, roomChromeSurface(roomChrome)]}><SeoullyText variant="button" color={roomChrome.color} style={styles.inspectActionText}>{copy.messageAboutCollectible}</SeoullyText></Pressable> : null}
      <Pressable onPress={onClose} style={[styles.inspectAction, roomChromeSurface(roomChrome)]}><SeoullyText variant="button" color={roomChrome.color} style={styles.inspectActionText}>{closeLabel}</SeoullyText></Pressable>
    </View>
    {notice ? <SeoullyText variant="caption" color={roomChrome.color} style={styles.inspectionNotice}>{notice}</SeoullyText> : null}
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
  onLayout,
  home = false,
  busy = false,
}: {
  home?: boolean;
  busy?: boolean;
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
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const languageWidth = useLanguageControlWidth();
  const header = topHeaderMetrics(useWindowDimensions().fontScale);
  useLanguageControlTone(chrome.color);
  const chip = [styles.overlayChip, { minHeight: header.controlHeight }, roomChromeSurface(chrome)];
  return <View pointerEvents="box-none" onLayout={onLayout} style={[styles.overlayBar, style, { paddingRight: 16 + languageWidth + 18 }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={home ? copy.roomHome : copy.back} accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onBack} style={[chip, home ? { minWidth: 44 } : null]}>
      {home && !busy ? <IconHome color={chrome.color} size={20} /> : <SeoullyText variant="button" color={chrome.color}>{busy ? copy.saving : copy.back}</SeoullyText>}
    </Pressable>
    {readOnly || !onEdit ? <View pointerEvents="none" style={styles.overlaySpacer} /> : <View pointerEvents="box-none" style={styles.overlayActions}>
      {editing ? <Pressable onPress={onCancel} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.cancelEditing}</SeoullyText></Pressable> : <Pressable onPress={onEdit} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.editRoom}</SeoullyText></Pressable>}
      {showStorage ? <Pressable onPress={onStorage} style={chip}><SeoullyText variant="button" color={chrome.color}>{copy.storedAccess}</SeoullyText></Pressable> : null}
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
  overlayBar: { alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 16 },
  messageStack: { position: "absolute" },
  messageContent: { gap: 16, paddingBottom: 2 },
  overlayChip: { maxWidth: "100%", alignItems: "center", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  overlaySpacer: { flex: 1 },
  entrance: { alignItems: "center", bottom: 0, justifyContent: "center", left: 0, paddingHorizontal: 28, position: "absolute", right: 0, top: 0 },
  entranceText: { fontSize: 22, lineHeight: 28, textAlign: "center", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 },
  overlayActions: { flex: 1, minWidth: 0, flexDirection: "row-reverse", flexWrap: "wrap", flexShrink: 1, gap: 16 },
  empty: { marginTop: 24, paddingHorizontal: chrome.gutter },
  stage: StyleSheet.absoluteFill,
  helperTitle: { fontWeight: "700", textAlign: "center" },
  editBar: { alignItems: "center", bottom: 0, gap: 16, left: 0, paddingHorizontal: 0, position: "absolute", right: 0 },
  toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 16, justifyContent: "center" },
  toolButton: { maxWidth: "100%", alignItems: "center", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  toolChip: { maxWidth: "100%", alignItems: "center", borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  contextRow: { borderRadius: 18, borderWidth: 1, padding: 12, flexWrap: "wrap", alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  selectionColumn: { gap: spacing.xs },
  selectionRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  selection: { flexShrink: 1, fontWeight: "700" },
  transformRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, justifyContent: "center" },
  transformButton: { borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  inspection: { bottom: 0, gap: 12, left: 0, position: "absolute", right: 0 },
  inspectionCopy: { minWidth: 0 },
  inspectionTitle: { fontSize: 14, fontWeight: "700" },
  inspectionMeta: { fontSize: 11, marginTop: 1 },
  inspectionActions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  inspectionNotice: { marginTop: 2 },
  inspectAction: { borderRadius: 8, borderWidth: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: 8 },
  inspectActionText: { fontSize: 11, fontWeight: "700" },
});
