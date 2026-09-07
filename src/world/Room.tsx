"use client";

import { useMemo, useState } from "react";
import { repository } from "@/domain/memory-repository";
import type { HoldingView, RoomId, ZoneId, ZoneKind } from "@/domain/types";
import { useWorld, type InspectTarget } from "@/world/store/worldStore";
import { RoomStage } from "@/world/stage/RoomStage";
import { RoomShell } from "@/world/room/RoomShell";
import { RoomDressing } from "@/world/room/RoomDressing";
import { Atmosphere } from "@/world/room/Atmosphere";
import { ZoneHotspots } from "@/world/room/ZoneHotspots";
import { ArrivalSequence, useArrivalLight } from "@/world/room/ArrivalSequence";
import { themeVars } from "@/world/room/roomTheme";
import { useRoomData } from "@/world/useRoomData";
import { WorldChrome } from "@/world/ui/WorldChrome";
import { ShelfZone } from "@/world/zones/ShelfZone";
import { WallZone } from "@/world/zones/WallZone";
import { DisplayCaseZone } from "@/world/zones/DisplayCaseZone";
import { DeskZone } from "@/world/zones/DeskZone";
import { ArchiveZone } from "@/world/zones/ArchiveZone";
import { BinderZone } from "@/world/zones/BinderZone";

/**
 * Assembles a collector's room.
 *
 * Zones are resolved by kind rather than by index, so a room can omit one or
 * add a second shelf without this file changing. Interactivity is gated on the
 * focused zone: when the camera is docked somewhere, only that zone accepts
 * input, which stops a stray hover across the room from firing mid-interaction
 * and doubles as the progressive-fidelity mechanism — unfocused zones stop
 * mounting pointer behavior entirely.
 */
export function Room({ roomId }: { roomId: RoomId }) {
  const { room, contents } = useRoomData(roomId);
  const view = useWorld((s) => s.view);
  const inspect = useWorld((s) => s.inspect);
  const openBinder = useWorld((s) => s.openBinder);
  const focusZone = useWorld((s) => s.focusZone);
  const showProfile = useWorld((s) => s.showProfile);
  const [binderHovered, setBinderHovered] = useState(false);
  const lightScale = useArrivalLight();

  const owner = room ? repository.getUser(room.ownerId) : undefined;
  const profile = room ? repository.getProfile(room.ownerId) : undefined;

  const { progress, stats } = useMemo(
    () =>
      room
        ? {
            progress: repository.listSetProgress(room.ownerId),
            stats: repository.getStats(room.ownerId),
          }
        : { progress: [], stats: null },
    [room],
  );

  if (!room || !owner || !profile || !stats) return null;

  const zone = (kind: ZoneKind) => room.zones.find((z) => z.kind === kind);

  const focusedZoneId =
    view.kind === "zone" || view.kind === "inspect" || view.kind === "binder"
      ? view.zoneId
      : null;

  const interactive = (zoneId: ZoneId) =>
    view.kind !== "arrival" && (focusedZoneId === null || focusedZoneId === zoneId);

  const select = (zoneId: ZoneId) => (item: HoldingView, at: InspectTarget) =>
    inspect(zoneId, item.holding.id, at);

  const selectedHoldingId = view.kind === "inspect" ? view.holdingId : null;
  const inspected = selectedHoldingId
    ? repository.getHoldingView(selectedHoldingId) ?? null
    : null;

  const shelf = zone("shelf");
  const wall = zone("wall");
  const displayCase = zone("display-case");
  const desk = zone("desk");
  const archive = zone("archive");
  const binder = zone("binder");

  return (
    <div className="room-lighting" style={themeVars(room.theme, lightScale)}>
      <RoomStage room={room}>
        <div className="world-root">
          <RoomShell />
          <RoomDressing room={room} />

          <ZoneHotspots
            room={room}
            active={view.kind === "room"}
            onFocus={focusZone}
          />

          {wall && (
            <WallZone
              zone={wall}
              items={contents.byKind.wall}
              interactive={interactive(wall.id)}
              onSelect={select(wall.id)}
            />
          )}

          {shelf && (
            <ShelfZone
              zone={shelf}
              items={contents.byKind.shelf}
              interactive={interactive(shelf.id)}
              selectedId={selectedHoldingId}
              onSelect={select(shelf.id)}
            />
          )}

          {displayCase && (
            <DisplayCaseZone
              zone={displayCase}
              items={contents.byKind["display-case"]}
              interactive={interactive(displayCase.id)}
              onSelect={select(displayCase.id)}
            />
          )}

          {desk && (
            <DeskZone
              zone={desk}
              items={contents.byKind.desk}
              interactive={interactive(desk.id)}
              onSelect={select(desk.id)}
            />
          )}

          {binder && view.kind !== "binder" && (
            <BinderZone
              zone={binder}
              progress={progress}
              hovered={binderHovered}
              interactive={interactive(binder.id)}
              onHover={setBinderHovered}
              onOpen={() => openBinder(binder.id)}
            />
          )}

          {archive && (
            <ArchiveZone
              zone={archive}
              items={contents.byKind.archive}
              interactive={interactive(archive.id)}
              onSelect={select(archive.id)}
            />
          )}
        </div>
      </RoomStage>

      <Atmosphere />

      <WorldChrome
        user={owner}
        profile={profile}
        stats={stats}
        room={room}
        inspected={inspected}
        onOpenProfile={() => showProfile(room.ownerId)}
      />

      <ArrivalSequence user={owner} profile={profile} theme={room.theme} />
    </div>
  );
}
