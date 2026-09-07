"use client";

import { useMemo, useState } from "react";
import { repository } from "@/domain/memory-repository";
import type { HoldingView, RoomId, ZoneId, ZoneKind } from "@/domain/types";
import { useWorld } from "@/world/store/worldStore";
import { RoomStage } from "@/world/stage/RoomStage";
import { RoomShell } from "@/world/room/RoomShell";
import { RoomDressing } from "@/world/room/RoomDressing";
import { Atmosphere } from "@/world/room/Atmosphere";
import { themeVars } from "@/world/room/roomTheme";
import { useRoomData } from "@/world/useRoomData";
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
 * input, which prevents a stray hover across the room from firing while you're
 * mid-interaction.
 */
export function Room({ roomId }: { roomId: RoomId }) {
  const { room, contents } = useRoomData(roomId);
  const view = useWorld((s) => s.view);
  const inspect = useWorld((s) => s.inspect);
  const openBinder = useWorld((s) => s.openBinder);
  const [binderHovered, setBinderHovered] = useState(false);

  const progress = useMemo(
    () => (room ? repository.listSetProgress(room.ownerId) : []),
    [room],
  );

  if (!room) return null;

  const zone = (kind: ZoneKind) => room.zones.find((z) => z.kind === kind);

  const focusedZoneId =
    view.kind === "zone" || view.kind === "inspect" || view.kind === "binder"
      ? view.zoneId
      : null;

  const interactive = (zoneId: ZoneId) => focusedZoneId === null || focusedZoneId === zoneId;
  const select = (zoneId: ZoneId) => (item: HoldingView) => inspect(zoneId, item.holding.id);
  const selectedHoldingId = view.kind === "inspect" ? view.holdingId : null;

  const shelf = zone("shelf");
  const wall = zone("wall");
  const displayCase = zone("display-case");
  const desk = zone("desk");
  const archive = zone("archive");
  const binder = zone("binder");

  return (
    <div style={themeVars(room.theme)}>
      <RoomStage room={room}>
        <div className="world-root">
          <RoomShell />
          <RoomDressing room={room} />

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

          {binder && (
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
    </div>
  );
}
