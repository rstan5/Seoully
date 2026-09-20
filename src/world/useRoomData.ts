"use client";

import { useEffect, useMemo } from "react";
import { hydrateRoomLayouts, repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { HoldingView, Placement, Room, RoomId, RoomObject, Transform3D, ZoneKind } from "@/domain/types";
import { hydrateProductionRoom } from "@/world/store/roomPersistence";

export interface ZoneContents {
  /** Items packed into each zone. Freed placements are omitted. */
  byKind: Record<ZoneKind, HoldingView[]>;
  offsets: Record<string, Partial<Transform3D>>;
  objects: RoomObject[];
  freeHoldings: { view: HoldingView; placement: Placement }[];
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
  const revision = useRepoRevision();
  useEffect(() => {
    hydrateRoomLayouts();
    void hydrateProductionRoom(roomId);
  }, [roomId]);
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
    const offsets: Record<string, Partial<Transform3D>> = {};
    const objects = room ? repository.listRoomObjects(room.id) : [];
    const freeHoldings: { view: HoldingView; placement: Placement }[] = [];

    if (room) {
      for (const placement of repository.listPlacements(room.id)) {
        if (placement.transform) {
          const view = repository.getHoldingView(placement.holdingId);
          if (view) freeHoldings.push({ view, placement });
          continue;
        }
        if (placement.offset) offsets[placement.holdingId] = placement.offset;
      }
      for (const zone of room.zones) {
        byKind[zone.kind] = repository
          .listPlacementsInZone(room.id, zone.id)
          .map((placement) => repository.getHoldingView(placement.holdingId))
          .filter((v): v is HoldingView => v !== undefined);
      }
    }

    return { room, contents: { byKind, offsets, objects, freeHoldings } };
  }, [roomId, version, revision]);
}
