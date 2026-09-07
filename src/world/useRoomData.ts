"use client";

import { useMemo } from "react";
import { repository } from "@/domain/memory-repository";
import type { HoldingView, Room, RoomId, ZoneKind } from "@/domain/types";

export interface ZoneContents {
  /** Items placed in each zone, in slot order. */
  byKind: Record<ZoneKind, HoldingView[]>;
}

/**
 * Resolves a room and everything placed inside it.
 *
 * Joins are done once here and memoized, rather than each zone reaching into
 * the repository. Zones stay presentational, which is what will let a real
 * backend swap in behind this hook without touching the scene.
 */
export function useRoomData(
  roomId: RoomId,
  /**
   * Bumped when the collection changes under us.
   *
   * The prototype's repository is synchronous and in-memory, so there's nothing
   * to subscribe to; a version token is the honest minimum. A real repository
   * would expose invalidation and this parameter would become a query key —
   * which is exactly the same shape, so no component changes when it does.
   */
  version = 0,
): { room: Room | undefined; contents: ZoneContents } {
  return useMemo(() => {
    const room = repository.getRoom(roomId);
    const byKind: Record<ZoneKind, HoldingView[]> = {
      shelf: [],
      binder: [],
      "display-case": [],
      wall: [],
      desk: [],
      archive: [],
    };

    if (room) {
      for (const zone of room.zones) {
        byKind[zone.kind] = repository
          .listPlacementsInZone(room.id, zone.id)
          .map((placement) => repository.getHoldingView(placement.holdingId))
          .filter((v): v is HoldingView => v !== undefined);
      }
    }

    return { room, contents: { byKind } };
  }, [roomId, version]);
}
