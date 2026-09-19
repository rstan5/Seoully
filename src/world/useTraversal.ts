"use client";

import { repository } from "@/domain/memory-repository";
import type { UserId } from "@/domain/types";
import { useWorld } from "@/world/store/worldStore";

/** How long the doorway is open before the rooms swap. */
const LEAVE_MS = 620;

export interface TravelDestination {
  light: string;
  fill: string;
}

let travelTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Travelling from one collector's room to another.
 *
 * Not a hook-owned animation: two components (the page and the room chrome)
 * both need to send you through a doorway, and two hook instances would mean
 * two timers and a doorway that doesn't know where you're going. The travel
 * function is a module singleton; the hook only reads the destination light.
 */
export function travelToRoomOf(userId: UserId) {
  const room = repository.getRoomByOwner(userId);
  if (!room) return;

  const state = useWorld.getState();
  if (room.id === state.roomId) {
    state.back();
    return;
  }

  state.setTraversal("leaving", {
    light: room.theme.light.color,
    fill: room.theme.light.fill,
  });
  if (travelTimer) clearTimeout(travelTimer);
  travelTimer = setTimeout(() => useWorld.getState().enterRoom(room.id), LEAVE_MS);
}

export function useTraversal() {
  const destination = useWorld((s) => s.doorway);
  return { travelToRoomOf, destination, leaveMs: LEAVE_MS };
}
