"use client";

import { repository } from "@/domain/memory-repository";
import type { Placement, RoomId, Transform3D, ZoneId } from "@/domain/types";
import { ensureRoom, listRoomPlacements, removeRoomPlacement, upsertRoomPlacement } from "@/server/rooms/actions";
import { useSession } from "@/world/store/sessionStore";

function localRoom(roomId: RoomId) {
  const room = repository.getRoom(roomId);
  const session = useSession.getState().session;
  if (!room || session.kind !== "auth" || room.ownerId !== session.userId) return undefined;
  return room;
}

function productionHoldingId(roomId: RoomId, holdingId: string) {
  const room = localRoom(roomId);
  if (!room) return undefined;
  const holding = repository.listHoldings(room.ownerId).find((item) => item.id === holdingId);
  return holding?.productionId;
}

function toPayload(roomId: string, placement: Placement, holdingId: string) {
  return {
    roomId,
    holdingId,
    zoneId: placement.zoneId,
    slot: placement.slot,
    offset: placement.offset ?? null,
    transform: placement.transform ?? null,
    surfaceId: placement.surfaceId ?? null,
  };
}

export async function hydrateProductionRoom(localRoomId: RoomId) {
  const room = localRoom(localRoomId);
  if (!room) return;
  const ensured = await ensureRoom();
  if (!ensured.ok) return;
  const result = await listRoomPlacements({ roomId: ensured.room.id });
  if (!result.ok) return;
  const productionToLocal = new Map(
    repository.listHoldings(room.ownerId)
      .filter((holding) => holding.productionId)
      .map((holding) => [holding.productionId!, holding.id] as const),
  );
  const placements: Placement[] = result.placements.flatMap((item) => {
    const holdingId = productionToLocal.get(item.holdingId);
    return holdingId ? [{
      holdingId,
      zoneId: item.zoneId as ZoneId,
      slot: item.slot,
      ...(item.offset ? { offset: item.offset } : {}),
      ...(item.transform ? { transform: item.transform as unknown as Transform3D } : {}),
      ...(item.surfaceId ? { surfaceId: item.surfaceId } : {}),
    }] : [];
  });
  repository.replaceProductionPlacements(localRoomId, placements);
}

export async function persistLocalPlacement(localRoomId: RoomId, holdingId: string) {
  const productionId = productionHoldingId(localRoomId, holdingId);
  const placement = repository.listPlacements(localRoomId).find((item) => item.holdingId === holdingId);
  if (!productionId || !placement) return;
  const ensured = await ensureRoom();
  if (!ensured.ok) return;
  try {
    const result = await upsertRoomPlacement(toPayload(ensured.room.id, placement, productionId));
    if (!result.ok) await hydrateProductionRoom(localRoomId);
  } catch {
    await hydrateProductionRoom(localRoomId);
  }
}

export async function removeLocalPlacement(localRoomId: RoomId, holdingId: string) {
  const productionId = productionHoldingId(localRoomId, holdingId);
  if (!productionId) return;
  const ensured = await ensureRoom();
  if (!ensured.ok) return;
  try {
    const result = await removeRoomPlacement({ roomId: ensured.room.id, holdingId: productionId });
    if (!result.ok) await hydrateProductionRoom(localRoomId);
  } catch {
    await hydrateProductionRoom(localRoomId);
  }
}

export async function syncProductionRoom(localRoomId: RoomId) {
  const room = localRoom(localRoomId);
  if (!room) return;
  const ensured = await ensureRoom();
  if (!ensured.ok) return;
  const current = await listRoomPlacements({ roomId: ensured.room.id });
  if (!current.ok) return;
  const desired = repository.listPlacements(localRoomId)
    .flatMap((placement) => {
      const productionId = productionHoldingId(localRoomId, placement.holdingId);
      return productionId ? [{ placement, productionId }] : [];
    });
  const desiredIds = new Set(desired.map(({ productionId }) => productionId));
  try {
    const removals = await Promise.all(current.placements
      .filter((placement) => !desiredIds.has(placement.holdingId))
      .map((placement) => removeRoomPlacement({ roomId: ensured.room.id, holdingId: placement.holdingId })));
    const writes = await Promise.all(desired.map(({ placement, productionId }) =>
      upsertRoomPlacement(toPayload(ensured.room.id, placement, productionId))));
    if (removals.some((result) => !result.ok) || writes.some((result) => !result.ok)) {
      await hydrateProductionRoom(localRoomId);
    }
  } catch {
    await hydrateProductionRoom(localRoomId);
  }
}
