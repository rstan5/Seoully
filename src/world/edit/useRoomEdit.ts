"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FLOOR_Y } from "@/domain/fixtures/collectors";
import { DECOR_BY_ID } from "@/domain/fixtures/decor";
import { repository } from "@/domain/memory-repository";
import {
  assistTowardSurface,
  clampToRoom,
  nearestSurface,
  settleOnSurface,
  surfacesForRoom,
  type Surface,
} from "@/domain/placement-rules";
import type {
  CollectibleKind,
  DecorId,
  HoldingId,
  Room,
  RoomMount,
  RoomObject,
  RoomObjectId,
  Transform3D,
} from "@/domain/types";
import { editPose, scaleAtDepth } from "@/world/stage/camera";
import { useViewport } from "@/world/stage/useViewport";
import { persistLocalPlacement, removeLocalPlacement } from "@/world/store/roomPersistence";

export type PlacedSubject =
  | { kind: "holding"; id: HoldingId }
  | { kind: "decor"; id: RoomObjectId };

export type EditSubject =
  | PlacedSubject
  | { kind: "spawn-decor"; assetId: DecorId }
  | { kind: "spawn-holding"; id: HoldingId }
  | { kind: "spawn-stored-decor"; id: RoomObjectId };

interface DragState {
  subject: EditSubject;
  pointerId: number;
  startX: number;
  startY: number;
  base: Transform3D;
  height: number;
}

const SETTLE_REACH = 160;
const ASSIST_REACH = 200;

export function heightForKind(kind: CollectibleKind): number {
  switch (kind) {
    case "album":
      return 176;
    case "vinyl":
      return 210;
    case "poster":
      return 220;
    case "photocard":
      return 90;
    case "lightstick":
      return 150;
    case "figure":
      return 120;
    case "plushie":
      return 110;
    case "book":
      return 160;
    default:
      return 80;
  }
}

export function heightForAsset(assetId: string): number {
  return DECOR_BY_ID.get(assetId)?.size.h ?? 80;
}

function heightForSubject(subject: EditSubject, room: Room): number {
  if (subject.kind === "spawn-decor") return heightForAsset(subject.assetId);
  if (subject.kind === "decor" || subject.kind === "spawn-stored-decor") {
    const object =
      repository.listRoomObjects(room.id).find((o) => o.id === subject.id) ??
      repository.listStoredDecor(room.id).find((o) => o.id === subject.id);
    return object ? heightForAsset(object.assetId) : 80;
  }
  const view = repository.getHoldingView(subject.id);
  return view ? heightForKind(view.template.kind) : 80;
}

function pointerWorld(
  clientX: number,
  clientY: number,
  viewport: { width: number; height: number },
  height: number,
): Transform3D {
  const pose = editPose(viewport.width, viewport.height);
  const scale = Math.max(0.35, scaleAtDepth(pose, pose.z));
  return clampToRoom({
    x: pose.x + (clientX - viewport.width / 2) / scale,
    y: FLOOR_Y - height / 2,
    z: pose.z - (clientY - viewport.height / 2) / scale,
  });
}

function mountFromSurface(surface: Surface | null, room: Room): RoomMount {
  if (!surface) return "floor";
  if (surface.kind === "wall") return "wall";
  if (surface.kind === "floor") return "floor";
  const zone = room.zones.find(
    (z) => surface.id === z.id || surface.id.startsWith(`${z.id}-`),
  );
  return zone?.kind ?? "desk";
}

/**
 * Physical grab for room editing.
 *
 * Everything moves in world space. Nearby surfaces gently attract; they never
 * lock. Commit happens on release so undo is one gesture.
 */
export function useRoomEdit(room: Room | undefined, editing: boolean) {
  const viewport = useViewport();
  const [selected, setSelected] = useState<EditSubject | null>(null);
  const [live, setLive] = useState<Transform3D | null>(null);
  const [hotSurface, setHotSurface] = useState<Surface | null>(null);
  const drag = useRef<DragState | null>(null);
  const liveRef = useRef<Transform3D | null>(null);
  const [dragging, setDragging] = useState(false);

  const pose = useMemo(
    () => editPose(viewport.width, viewport.height),
    [viewport.width, viewport.height],
  );

  const clear = useCallback(() => {
    drag.current = null;
    liveRef.current = null;
    setDragging(false);
    setLive(null);
    setHotSurface(null);
    setSelected(null);
  }, []);

  useEffect(() => {
    if (!editing) clear();
  }, [editing, clear]);

  const beginGrab = useCallback(
    (subject: EditSubject, event: React.PointerEvent, world: Transform3D) => {
      if (!room) return;
      event.preventDefault();
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        /* tray buttons may already have been removed */
      }
      setSelected(subject);
      const height = heightForSubject(subject, room);
      const base = clampToRoom({ ...world });
      drag.current = {
        subject,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        base,
        height,
      };
      liveRef.current = base;
      setLive(base);
      setDragging(true);
    },
    [room],
  );

  useEffect(() => {
    if (!editing || !room) return;

    const publish = (next: Transform3D, surface: Surface | null) => {
      liveRef.current = next;
      setLive(next);
      setHotSurface(surface);
    };

    const onMove = (event: PointerEvent) => {
      const session = drag.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const scale = Math.max(0.35, scaleAtDepth(pose, session.base.z));
      const dx = (event.clientX - session.startX) / scale;
      const dy = (event.clientY - session.startY) / scale;

      const objects = repository
        .listRoomObjects(room.id)
        .filter((object) =>
          session.subject.kind === "decor" ? object.id !== session.subject.id : true,
        );
      const surfaces = surfacesForRoom(room, objects);

      const probe = nearestSurface(
        { ...session.base, x: session.base.x + dx, y: session.base.y, z: session.base.z - dy },
        surfaces,
        session.height,
        ASSIST_REACH,
      );
      const wallish = probe?.surface.kind === "wall";
      const raw = clampToRoom({
        ...session.base,
        x: session.base.x + dx,
        y: wallish ? session.base.y + dy : session.base.y,
        z: wallish ? session.base.z : session.base.z - dy,
      });
      const hot = nearestSurface(raw, surfaces, session.height, ASSIST_REACH);
      if (!hot) {
        publish(raw, null);
        return;
      }
      publish(
        assistTowardSurface(raw, hot.surface, hot.distance, session.height, ASSIST_REACH),
        hot.surface,
      );
    };

    const onUp = (event: PointerEvent) => {
      const session = drag.current;
      if (!session || event.pointerId !== session.pointerId) return;
      const current = liveRef.current;
      const subject = session.subject;
      drag.current = null;
      liveRef.current = null;
      setDragging(false);
      setHotSurface(null);
      if (!current) {
        setLive(null);
        return;
      }

      const objects = repository
        .listRoomObjects(room.id)
        .filter((object) => (subject.kind === "decor" ? object.id !== subject.id : true));
      const surfaces = surfacesForRoom(room, objects);
      const hot = nearestSurface(current, surfaces, session.height, SETTLE_REACH);
      const settled = hot
        ? settleOnSurface(current, hot.surface, session.height)
        : current;
      const transform = clampToRoom(settled);
      const surfaceId = hot?.surface.id;
      const zone = mountFromSurface(hot?.surface ?? null, room);

      const moved =
        Math.hypot(event.clientX - session.startX, event.clientY - session.startY) > 5;
      const spawning =
        subject.kind === "spawn-decor" ||
        subject.kind === "spawn-holding" ||
        subject.kind === "spawn-stored-decor";
      if (!moved && !spawning) {
        setLive(null);
        return;
      }

      if (subject.kind === "spawn-decor") {
        const placed = repository.placeDecor(room.id, subject.assetId, zone, transform, surfaceId);
        setSelected({ kind: "decor", id: placed.id });
        setLive(null);
        return;
      }
      if (subject.kind === "spawn-holding") {
        repository.restorePlacement(room.id, subject.id, transform, surfaceId);
        void persistLocalPlacement(room.id, subject.id);
        setSelected({ kind: "holding", id: subject.id });
        setLive(null);
        return;
      }
      if (subject.kind === "spawn-stored-decor") {
        repository.restoreRoomObject(subject.id, transform, { zone, surfaceId });
        setSelected({ kind: "decor", id: subject.id });
        setLive(null);
        return;
      }
      if (subject.kind === "holding") {
        repository.movePlacement(room.id, subject.id, { transform, surfaceId });
        void persistLocalPlacement(room.id, subject.id);
      } else {
        repository.moveRoomObject(subject.id, { transform, zone, surfaceId });
      }
      setLive(null);
    };

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [editing, pose, room]);

  const storeSelected = useCallback(() => {
    if (!selected || !room) return;
    if (selected.kind === "holding") {
      repository.storePlacement(room.id, selected.id);
      void removeLocalPlacement(room.id, selected.id);
    }
    else if (selected.kind === "decor") repository.storeRoomObject(selected.id);
    else return;
    clear();
  }, [clear, room, selected]);

  const placeDecor = useCallback(
    (assetId: DecorId, event: React.PointerEvent) => {
      if (!room) return;
      const asset = DECOR_BY_ID.get(assetId);
      if (!asset) return;
      const world = pointerWorld(event.clientX, event.clientY, viewport, asset.size.h);
      beginGrab({ kind: "spawn-decor", assetId }, event, world);
    },
    [beginGrab, room, viewport],
  );

  const restoreHolding = useCallback(
    (holdingId: HoldingId, event: React.PointerEvent) => {
      if (!room) return;
      const view = repository.getHoldingView(holdingId);
      const world = pointerWorld(
        event.clientX,
        event.clientY,
        viewport,
        view ? heightForKind(view.template.kind) : 80,
      );
      beginGrab({ kind: "spawn-holding", id: holdingId }, event, world);
    },
    [beginGrab, room, viewport],
  );

  const restoreDecor = useCallback(
    (object: RoomObject, event: React.PointerEvent) => {
      if (!room) return;
      const asset = repository.getDecorAsset(object.assetId);
      const world = pointerWorld(event.clientX, event.clientY, viewport, asset?.size.h ?? 80);
      beginGrab({ kind: "spawn-stored-decor", id: object.id }, event, world);
    },
    [beginGrab, room, viewport],
  );

  const placedSelected: PlacedSubject | null =
    selected?.kind === "holding" || selected?.kind === "decor" ? selected : null;

  const decorLive =
    live &&
    (selected?.kind === "decor" ||
      selected?.kind === "spawn-decor" ||
      selected?.kind === "spawn-stored-decor")
      ? { id: selected.kind === "spawn-decor" ? "spawn-decor" : selected.id, transform: live }
      : null;

  const spawnDecor =
    selected?.kind === "spawn-decor" && live
      ? { assetId: selected.assetId, transform: live }
      : selected?.kind === "spawn-stored-decor" && live
        ? (() => {
            const object = repository.listStoredDecor(room?.id ?? ("" as never)).find((o) => o.id === selected.id);
            return object ? { assetId: object.assetId, transform: live, replaceId: object.id } : null;
          })()
        : null;

  const holdingLive =
    live &&
    (selected?.kind === "holding" || selected?.kind === "spawn-holding")
      ? { id: selected.id, transform: live }
      : null;

  return {
    selected: placedSelected,
    dragging,
    hotSurface,
    decorLive,
    spawnDecor,
    holdingLive,
    select: (subject: PlacedSubject | null) => setSelected(subject),
    clear,
    beginGrab,
    storeSelected,
    placeDecor,
    restoreHolding,
    restoreDecor,
    cancelDrag: () => {
      drag.current = null;
      liveRef.current = null;
      setDragging(false);
      setLive(null);
      setHotSurface(null);
      if (selected && selected.kind !== "holding" && selected.kind !== "decor") {
        setSelected(null);
      }
    },
  };
}
