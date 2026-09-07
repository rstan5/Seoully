"use client";

import { useEffect, useMemo, useState } from "react";
import { repository } from "@/domain/memory-repository";
import type { HoldingView, RoomId, ZoneId, ZoneKind } from "@/domain/types";
import { useWorld, type InspectTarget } from "@/world/store/worldStore";
import { RoomStage } from "@/world/stage/RoomStage";
import { RoomShell } from "@/world/room/RoomShell";
import { RoomDressing } from "@/world/room/RoomDressing";
import { Atmosphere } from "@/world/room/Atmosphere";
import { CompletionBloom } from "@/world/room/CompletionBloom";
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
import { OpenBinder } from "@/world/objects/OpenBinder";
import {
  POCKET_CARD_H,
  buildPages,
  spreadOfInterest,
  spreadOfSet,
} from "@/world/objects/binderGeometry";
import { CardFlight } from "@/world/flight/CardFlight";
import { useCardArrival } from "@/world/flight/useCardArrival";
import { PendingCardDrop } from "@/world/room/PendingCardDrop";
import { pace } from "@/design/motion";

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
  const [collectionVersion, setCollectionVersion] = useState(0);
  const { room, contents } = useRoomData(roomId, collectionVersion);
  const view = useWorld((s) => s.view);
  const inspect = useWorld((s) => s.inspect);
  const openBinder = useWorld((s) => s.openBinder);
  const focusZone = useWorld((s) => s.focusZone);
  const showProfile = useWorld((s) => s.showProfile);
  const turnPage = useWorld((s) => s.turnPage);
  const [binderHovered, setBinderHovered] = useState(false);
  // A card taken out of its sleeve. Local to the room rather than in the world
  // store: it's a transient physical gesture inside one object, not a place the
  // camera has travelled to, and putting it in the navigation state machine
  // would make "step back" ambiguous.
  const [heldCard, setHeldCard] = useState<HoldingView | null>(null);
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
    [room, collectionVersion],
  );

  const pages = useMemo(
    () =>
      buildPages(progress, contents.byKind.binder, (templateId) =>
        repository.getTemplate(templateId),
      ),
    [progress, contents.byKind.binder],
  );

  const binderZone = room?.zones.find((z) => z.kind === "binder");

  const arrival = useCardArrival({
    ownerId: room?.ownerId ?? ("" as never),
    progress,
    binderZone,
    onOpenBinder: (setId) => {
      if (binderZone) openBinder(binderZone.id, spreadOfSet(pages, setId));
    },
    onCollectionChanged: () => setCollectionVersion((v) => v + 1),
  });

  // Putting a card back is part of leaving the binder, not a separate action.
  useEffect(() => {
    if (view.kind !== "binder" && heldCard) setHeldCard(null);
  }, [view.kind, heldCard]);

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
    <div
      className="room-lighting"
      // The room brightens slightly when a set completes. It's the least
      // literal celebration available and the most convincing one: the space
      // itself responds, so the achievement belongs to the room rather than to
      // a notification drawn on top of it.
      style={themeVars(room.theme, lightScale * (arrival.celebratingSetId ? 1.16 : 1))}
    >
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
              onOpen={() => openBinder(binder.id, spreadOfInterest(pages, progress))}
            />
          )}

          {binder && view.kind === "binder" && (
            <OpenBinder
              at={binder.transform}
              pages={pages}
              spread={view.page}
              heldTemplateId={heldCard?.template.id ?? null}
              arrivedTemplateId={arrival.landedTemplateId}
              celebratingSetId={arrival.celebratingSetId}
              onHold={setHeldCard}
              onTurn={turnPage}
            />
          )}

          {/* The last card of a set, waiting on the floor where it arrived. */}
          {arrival.candidate && view.kind === "room" && (
            <PendingCardDrop
              template={arrival.candidate.template}
              member={arrival.candidate.member}
              setName={arrival.candidate.setName}
              remaining={arrival.candidate.remaining}
              interactive={view.kind === "room"}
              onSend={arrival.send}
            />
          )}

          {/* And the same card in the air, on its way to its pocket. */}
          {arrival.phase === "flying" && arrival.inFlight && arrival.path && (
            <CardFlight
              template={arrival.inFlight.template}
              member={arrival.inFlight.member}
              path={arrival.path}
              height={POCKET_CARD_H}
              pacing={pace.hero}
              onArrive={arrival.land}
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
      <CompletionBloom active={arrival.celebratingSetId !== null} />

      <WorldChrome
        user={owner}
        profile={profile}
        stats={stats}
        room={room}
        inspected={inspected ?? heldCard}
        onOpenProfile={() => showProfile(room.ownerId)}
      />

      <ArrivalSequence user={owner} profile={profile} theme={room.theme} />
    </div>
  );
}
