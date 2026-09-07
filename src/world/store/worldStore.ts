"use client";

import { create } from "zustand";
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
  | { kind: "feed" };

/** Where the camera is currently travelling, for transition-aware rendering. */
export type TraversalPhase = "idle" | "leaving" | "entering";

interface WorldState {
  roomId: RoomId;
  /** The user whose eyes we're behind. Never changes in this slice. */
  viewerId: UserId;
  view: WorldView;
  /** Set while moving between two collectors' rooms. */
  traversal: TraversalPhase;
  /** True once the arrival sequence has played out. */
  arrived: boolean;

  /** The card queued for the flagship flight-into-binder interaction. */
  pendingCard: TemplateId | null;
  /** Set ids that completed during this session, so we can celebrate once. */
  celebrated: string[];

  enterRoom: (roomId: RoomId) => void;
  finishArrival: () => void;
  focusZone: (zoneId: ZoneId) => void;
  inspect: (zoneId: ZoneId, holdingId: HoldingId, at: InspectTarget) => void;
  openBinder: (zoneId: ZoneId, page?: number) => void;
  turnPage: (page: number) => void;
  showProfile: (userId: UserId) => void;
  showFeed: () => void;
  back: () => void;
  setTraversal: (phase: TraversalPhase) => void;
  queueCard: (templateId: TemplateId | null) => void;
  markCelebrated: (setId: string) => void;
}

export const useWorld = create<WorldState>((set, get) => ({
  roomId: "room-soo" as RoomId,
  viewerId: "u-soo" as UserId,
  view: { kind: "arrival" },
  traversal: "idle",
  arrived: false,
  pendingCard: null,
  celebrated: [],

  enterRoom: (roomId) => set({ roomId, view: { kind: "room" }, traversal: "entering" }),
  finishArrival: () => set({ arrived: true, view: { kind: "room" } }),
  focusZone: (zoneId) => set({ view: { kind: "zone", zoneId } }),
  inspect: (zoneId, holdingId, at) => set({ view: { kind: "inspect", zoneId, holdingId, at } }),
  openBinder: (zoneId, page = 0) => set({ view: { kind: "binder", zoneId, page } }),
  turnPage: (page) => {
    const view = get().view;
    if (view.kind === "binder") set({ view: { ...view, page } });
  },
  showProfile: (userId) => set({ view: { kind: "profile", userId } }),
  showFeed: () => set({ view: { kind: "feed" } }),

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
        set({ view: { kind: "room" } });
        break;
      default:
        break;
    }
  },

  setTraversal: (traversal) => set({ traversal }),
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
