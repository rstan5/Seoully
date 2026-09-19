"use client";

import { create } from "zustand";
import { repository } from "@/domain/memory-repository";
import type { HoldingId, RoomId, TemplateId, UserId, ZoneId } from "@/domain/types";

/**
 * World state.
 *
 * This is a state *machine*, not a bag of booleans. Navigation in Seoully is a
 * camera move through one continuous scene, so the app's mode and the camera's
 * destination have to stay in lockstep — a boolean soup would let them drift
 * and the illusion dies the moment they do.
 *
 * Deliberately excluded from this store: pointer parallax and any per-frame
 * animation value. Those live in motion values so they never trigger a React
 * render. The store only holds things that change on *user intent*.
 */

/** A point in room coordinates. */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

/**
 * Where an object comes to rest when picked up, plus how big it is.
 *
 * The height is what lets the camera stop at a distance that makes *this*
 * object a comfortable size, so a photocard and a vinyl box both fill the frame
 * rather than sharing one compromise distance that suits neither.
 */
export interface InspectTarget extends WorldPoint {
  height?: number;
}

export type WorldView =
  /** Cold open. The room is dark and resolving. */
  | { kind: "arrival" }
  /** Neutral camera, whole room in frame. */
  | { kind: "room" }
  /** Camera docked at a zone. */
  | { kind: "zone"; zoneId: ZoneId }
  /**
   * An object pulled forward and being examined.
   *
   * Carries the object's own world position rather than just its zone, so the
   * camera frames *that object* instead of the middle of the shelf it came
   * from. Without this, inspecting the leftmost album leaves it off to the side
   * of frame and the move stops feeling like you picked that one up.
   */
  | { kind: "inspect"; zoneId: ZoneId; holdingId: HoldingId; at: InspectTarget }
  /** The binder is open, camera close, page spread visible. */
  | { kind: "binder"; zoneId: ZoneId; page: number }
  /** A collector's identity page, floating over their darkened room. */
  | { kind: "profile"; userId: UserId }
  /** The discovery layer. */
  | { kind: "feed" }
  | { kind: "search" }
  | { kind: "inbox" }
  | { kind: "notices" }
  | { kind: "compose" }
  /** Own room, arranging objects in place. Same camera as overview. */
  | { kind: "edit" };

/** Where the camera is currently travelling, for transition-aware rendering. */
export type TraversalPhase = "idle" | "leaving" | "entering";

interface WorldState {
  roomId: RoomId;
  viewerId: UserId;
  view: WorldView;
  /** Set while moving between two collectors' rooms. */
  traversal: TraversalPhase;
  /** Light of the room being entered, used by the doorway wipe. */
  doorway: { light: string; fill: string } | null;
  /** True once the arrival sequence has played out. */
  arrived: boolean;

  /** The card queued for the flagship flight-into-binder interaction. */
  pendingCard: TemplateId | null;
  /** Set ids that completed during this session, so we can celebrate once. */
  celebrated: string[];

  enterRoom: (roomId: RoomId) => void;
  adoptViewer: (userId: UserId, roomId: RoomId, view?: WorldView) => void;
  finishArrival: () => void;
  focusZone: (zoneId: ZoneId) => void;
  inspect: (zoneId: ZoneId, holdingId: HoldingId, at: InspectTarget) => void;
  openBinder: (zoneId: ZoneId, page?: number) => void;
  turnPage: (page: number) => void;
  showProfile: (userId: UserId) => void;
  showFeed: () => void;
  showSearch: () => void;
  showInbox: () => void;
  showNotices: () => void;
  showCompose: () => void;
  enterEdit: () => void;
  exitEdit: () => void;
  back: () => void;
  setTraversal: (phase: TraversalPhase, doorway?: { light: string; fill: string } | null) => void;
  queueCard: (templateId: TemplateId | null) => void;
  markCelebrated: (setId: string) => void;
}

export const useWorld = create<WorldState>((set, get) => ({
  roomId: "room-soo" as RoomId,
  viewerId: "u-soo" as UserId,
  view: { kind: "arrival" },
  traversal: "idle",
  doorway: null,
  arrived: false,
  pendingCard: null,
  celebrated: [],

  /**
   * Swap which room we're standing in.
   *
   * Lands in `arrival`, not in `room`. Entering someone else's world runs the
   * exact same resolve-out-of-the-dark sequence the app opens with, which is
   * both less code and the right feeling: you don't arrive in a stranger's
   * room already looking at everything.
   */
  enterRoom: (roomId) =>
    set({ roomId, view: { kind: "arrival" }, arrived: false, traversal: "entering" }),
  adoptViewer: (userId, roomId, view = { kind: "arrival" }) =>
    set({
      viewerId: userId,
      roomId,
      view,
      arrived: view.kind !== "arrival",
      traversal: "idle",
      pendingCard: null,
      celebrated: [],
    }),
  finishArrival: () => set({ arrived: true, view: { kind: "room" }, traversal: "idle" }),
  focusZone: (zoneId) => set({ view: { kind: "zone", zoneId } }),
  inspect: (zoneId, holdingId, at) => set({ view: { kind: "inspect", zoneId, holdingId, at } }),
  openBinder: (zoneId, page = 0) => set({ view: { kind: "binder", zoneId, page } }),
  turnPage: (page) => {
    const view = get().view;
    if (view.kind === "binder") set({ view: { ...view, page } });
  },
  showProfile: (userId) =>
    set((state) => ({
      view: { kind: "profile", userId },
      ...glimpseOwnerRoom(state, userId),
    })),
  showFeed: () =>
    set((state) => ({
      view: { kind: "feed" },
      ...glimpseOwnerRoom(state, state.viewerId),
    })),
  showSearch: () =>
    set((state) => ({
      view: { kind: "search" },
      ...glimpseOwnerRoom(state, state.viewerId),
    })),
  showInbox: () =>
    set((state) => ({
      view: { kind: "inbox" },
      ...glimpseOwnerRoom(state, state.viewerId),
    })),
  showNotices: () =>
    set((state) => ({
      view: { kind: "notices" },
      ...glimpseOwnerRoom(state, state.viewerId),
    })),
  showCompose: () =>
    set((state) => ({
      view: { kind: "compose" },
      ...glimpseOwnerRoom(state, state.viewerId),
    })),
  enterEdit: () => set({ view: { kind: "edit" } }),
  exitEdit: () => set({ view: { kind: "room" } }),

  /**
   * One step out along the spatial hierarchy. Modeled explicitly rather than as
   * a history stack: in a spatial interface "back" means *zoom out*, and a
   * history stack would sometimes fly the camera somewhere it had been rather
   * than somewhere that makes spatial sense.
   */
  back: () => {
    const view = get().view;
    switch (view.kind) {
      case "inspect":
        set({ view: { kind: "zone", zoneId: view.zoneId } });
        break;
      case "binder":
        set({ view: { kind: "zone", zoneId: view.zoneId } });
        break;
      case "zone":
        set({ view: { kind: "room" } });
        break;
      case "profile":
      case "feed":
      case "search":
      case "inbox":
      case "notices":
      case "edit":
        set({ view: { kind: "room" } });
        break;
      case "compose":
        set({ view: { kind: "feed" } });
        break;
      default:
        break;
    }
  },

  setTraversal: (traversal, doorway) =>
    set({
      traversal,
      ...(doorway !== undefined ? { doorway } : traversal === "idle" ? { doorway: null } : {}),
    }),
  queueCard: (pendingCard) => set({ pendingCard }),
  markCelebrated: (setId) =>
    set((s) => (s.celebrated.includes(setId) ? s : { celebrated: [...s.celebrated, setId] })),
}));

// Handle for the screenshot harness, which needs to park the world in a
// specific state before capturing it. Development only.
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __world?: typeof useWorld }).__world = useWorld;
}

/** Zone currently in focus, if any. Used for progressive scene fidelity. */
export function activeZoneId(view: WorldView): ZoneId | null {
  switch (view.kind) {
    case "zone":
    case "inspect":
    case "binder":
      return view.zoneId;
    default:
      return null;
  }
}

/**
 * Keep the existing room mounted under social, but look at the right collector's
 * world. Own Discover/Search/Messages sit over the viewer's room; someone
 * else's profile sits over theirs. Does not run arrival — Enter Room still
 * uses the doorway when you actually walk in.
 */
function glimpseOwnerRoom(
  state: Pick<WorldState, "roomId">,
  ownerId: UserId,
): { roomId: RoomId; arrived: true } | Record<string, never> {
  const room = repository.getRoomByOwner(ownerId);
  if (!room || room.id === state.roomId) return {};
  return { roomId: room.id, arrived: true };
}

/** Social overlays sit in front of the room; the camera and chrome treat them as one layer. */
export function isSocialView(view: WorldView): boolean {
  return (
    view.kind === "profile" ||
    view.kind === "feed" ||
    view.kind === "search" ||
    view.kind === "inbox" ||
    view.kind === "notices" ||
    view.kind === "compose"
  );
}
