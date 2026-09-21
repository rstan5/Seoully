"use client";

import { useEffect, useMemo, useState } from "react";
import { repository } from "@/domain/memory-repository";
import type { HoldingId, HoldingView, RoomId, RoomObjectId, TemplateId, Transform3D, UserId, ZoneId, ZoneKind } from "@/domain/types";
import { useSession } from "@/world/store/sessionStore";
import { isSocialView, useWorld, type InspectTarget } from "@/world/store/worldStore";
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
import { InspectPlate } from "@/world/ui/InspectPlate";
import { EditChrome } from "@/world/ui/EditChrome";
import { DecorLayer } from "@/world/edit/DecorLayer";
import { FreeLayer, type FreeHolding } from "@/world/edit/FreeLayer";
import { SurfaceHint } from "@/world/edit/Grounding";
import { useRoomEdit } from "@/world/edit/useRoomEdit";
import { syncProductionRoom } from "@/world/store/roomPersistence";
import type { ArrangeContext } from "@/world/edit/arrange";
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
import { useViewport } from "@/world/stage/useViewport";

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
export function Room({
  roomId,
  onMessage,
  readOnly = false,
}: {
  roomId: RoomId;
  onMessage?: (peerId: UserId, opts?: { templateIds?: TemplateId[] }) => void;
  readOnly?: boolean;
}) {
  const [collectionVersion, setCollectionVersion] = useState(0);
  const { room, contents } = useRoomData(roomId, collectionVersion);
  const view = useWorld((s) => s.view);
  const inspect = useWorld((s) => s.inspect);
  const openBinder = useWorld((s) => s.openBinder);
  const focusZone = useWorld((s) => s.focusZone);
  const showProfile = useWorld((s) => s.showProfile);
  const viewerId = useWorld((s) => s.viewerId);
  const turnPage = useWorld((s) => s.turnPage);
  const exitEdit = useWorld((s) => s.exitEdit);
  const finishRoomIntro = () => {
    useSession.getState().finishRoomIntro();
    exitEdit();
  };
  const editing = !readOnly && view.kind === "edit";
  const edit = useRoomEdit(room, editing);
  const [binderHovered, setBinderHovered] = useState(false);
  // A card taken out of its sleeve. Local to the room rather than in the world
  // store: it's a transient physical gesture inside one object, not a place the
  // camera has travelled to, and putting it in the navigation state machine
  // would make "step back" ambiguous.
  const [heldCard, setHeldCard] = useState<HoldingView | null>(null);
  const lightScale = useArrivalLight();
  const viewport = useViewport();
  const compact = viewport.width < 800;
  const daylight = room?.aesthetic === "maximalist";

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

  const archiveZone = room?.zones.find((z) => z.kind === "archive");

  const arrival = useCardArrival({
    ownerId: room?.ownerId ?? ("" as never),
    progress,
    binderZone,
    archiveZone,
    onOpenBinder: (setId) => {
      if (binderZone) openBinder(binderZone.id, spreadOfSet(pages, setId));
    },
    onCollectionChanged: () => setCollectionVersion((v) => v + 1),
  });

  // Putting a card back is part of leaving the binder, not a separate action.
  useEffect(() => {
    if (view.kind !== "binder" && heldCard) setHeldCard(null);
  }, [view.kind, heldCard]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      if (edit.dragging) {
        edit.cancelDrag();
        return;
      }
      if (edit.selected) {
        edit.clear();
        return;
      }
      finishRoomIntro();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [editing, edit, exitEdit]);

  // Escape returns a held card before the chrome steps the camera back. Capture
  // so the first press is "put the card away", not "leave the binder".
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !heldCard) return;
      e.stopImmediatePropagation();
      setHeldCard(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [heldCard]);

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

  const overlay = isSocialView(view);
  const examiningCard = Boolean(heldCard) || inspected?.template.kind === "photocard";
  const far = (zoneId: ZoneId) => !editing && focusedZoneId !== null && focusedZoneId !== zoneId;
  const binderCover = daylight ? "#8f3558" : "#4a1c2c";

  const holdingOffsets = contents.offsets;
  const draggingHoldingId = edit.dragging && edit.holdingLive ? edit.holdingLive.id : null;
  const hideFromZones = (items: HoldingView[]) =>
    draggingHoldingId ? items.filter((item) => item.holding.id !== draggingHoldingId) : items;

  const arrange: ArrangeContext = {
    editing,
    selectedId: edit.selected?.kind === "holding" ? edit.selected.id : null,
    draggingId: draggingHoldingId,
    offsets: holdingOffsets,
    onGrab: (id, event, world) => {
      const placement = repository.listPlacements(room.id).find((p) => p.holdingId === id);
      const pose = placement?.transform ?? world;
      if (!pose) return;
      edit.beginGrab({ kind: "holding", id: id as HoldingId }, event, pose);
    },
  };

  const freeItems = mergeFreeHoldings(contents.freeHoldings, edit.holdingLive, room.zones[0]?.id);

  return (
    <div
      className={`room-lighting${examiningCard ? " is-examining" : ""}`}
      data-mood={daylight ? "day" : "night"}
      style={themeVars(
        room.theme,
        lightScale *
          (overlay ? 0.52 : examiningCard ? 0.68 : 1) *
          (arrival.celebratingSetId ? 1.16 : 1),
      )}
    >
      <RoomStage room={room} examining={!!heldCard}>
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
              items={hideFromZones(contents.byKind.wall)}
              interactive={!editing && interactive(wall.id)}
              far={far(wall.id)}
              selectedId={selectedHoldingId}
              arrange={arrange}
              onSelect={select(wall.id)}
            />
          )}

          {shelf && (
            <ShelfZone
              zone={shelf}
              items={hideFromZones(contents.byKind.shelf)}
              interactive={!editing && interactive(shelf.id)}
              far={far(shelf.id)}
              selectedId={selectedHoldingId}
              personality={daylight ? "overflow" : "neat"}
              arrange={arrange}
              onSelect={select(shelf.id)}
            />
          )}

          {displayCase && (
            <DisplayCaseZone
              zone={displayCase}
              items={hideFromZones(contents.byKind["display-case"])}
              interactive={!editing && interactive(displayCase.id)}
              far={far(displayCase.id)}
              selectedId={selectedHoldingId}
              arrange={arrange}
              onSelect={select(displayCase.id)}
            />
          )}

          {desk && (
            <DeskZone
              zone={desk}
              items={hideFromZones(contents.byKind.desk)}
              interactive={!editing && interactive(desk.id)}
              far={far(desk.id)}
              lamp={!daylight}
              selectedId={selectedHoldingId}
              arrange={arrange}
              onSelect={select(desk.id)}
            />
          )}

          {binder && view.kind !== "binder" && (
            <BinderZone
              zone={binder}
              progress={progress}
              hovered={binderHovered}
              interactive={!editing && interactive(binder.id)}
              cover={binderCover}
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
              cover={binderCover}
              onHold={setHeldCard}
              onTurn={turnPage}
            />
          )}

          {/* The last card of a set, waiting on the floor where it arrived. */}
          {arrival.candidate && view.kind === "room" && room.ownerId === viewerId && (
            <PendingCardDrop
              template={arrival.candidate.template}
              member={arrival.candidate.member}
              setName={arrival.candidate.setName}
              remaining={arrival.candidate.remaining}
              interactive={view.kind === "room"}
              onSend={arrival.send}
              origin={arrival.origin}
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
              items={hideFromZones(contents.byKind.archive)}
              interactive={!editing && interactive(archive.id)}
              far={far(archive.id)}
              selectedId={selectedHoldingId}
              arrange={arrange}
              onSelect={select(archive.id)}
            />
          )}

          <DecorLayer
            room={room}
            objects={contents.objects}
            editing={editing}
            selectedId={edit.selected?.kind === "decor" ? edit.selected.id : null}
            draggingId={
              edit.dragging && edit.selected?.kind === "decor" ? edit.selected.id : null
            }
            live={edit.decorLive}
            spawn={edit.spawnDecor}
            far={focusedZoneId !== null}
            onGrab={(object, event) =>
              edit.beginGrab({ kind: "decor", id: object.id as RoomObjectId }, event, object.transform)
            }
          />

          <FreeLayer
            items={freeItems}
            live={edit.holdingLive}
            editing={editing}
            arrange={arrange}
            far={focusedZoneId !== null}
            onSelect={(item, at) => {
              const home = room.zones[0];
              if (!home) return;
              inspect(home.id, item.holding.id, at);
            }}
          />

          {editing && edit.hotSurface && <SurfaceHint surface={edit.hotSurface} />}
        </div>
      </RoomStage>

      <Atmosphere
        mood={daylight ? "day" : "night"}
        dust={compact ? 8 : daylight ? 14 : 26}
      />
      <CompletionBloom active={arrival.celebratingSetId !== null} />

      <WorldChrome
        user={owner}
        profile={profile}
        stats={stats}
        room={room}
        inspected={inspected ?? heldCard}
        onOpenProfile={() => showProfile(room.ownerId)}
      />
      {editing && !readOnly && (
        <EditChrome
          room={room}
          selected={edit.selected}
          canUndo={repository.canUndoRoom(room.id)}
          canRedo={repository.canRedoRoom(room.id)}
          onUndo={() => { repository.undoRoom(room.id); void syncProductionRoom(room.id); }}
          onRedo={() => { repository.redoRoom(room.id); void syncProductionRoom(room.id); }}
          onStore={edit.storeSelected}
          onDone={finishRoomIntro}
          onPlaceDecor={(asset, event) => edit.placeDecor(asset.id, event)}
          onRestoreHolding={(view, event) => edit.restoreHolding(view.holding.id, event)}
          onRestoreDecor={(object, event) => edit.restoreDecor(object, event)}
        />
      )}
      <InspectPlate view={heldCard ?? inspected} onMessage={onMessage} />

      <ArrivalSequence user={owner} profile={profile} theme={room.theme} />
    </div>
  );
}

function mergeFreeHoldings(
  items: FreeHolding[],
  live: { id: string; transform: Transform3D } | null,
  fallbackZone?: ZoneId,
): FreeHolding[] {
  if (!live) return items;
  if (items.some((item) => item.view.holding.id === live.id)) {
    return items.map((item) =>
      item.view.holding.id === live.id
        ? { ...item, placement: { ...item.placement, transform: live.transform } }
        : item,
    );
  }
  const view = repository.getHoldingView(live.id as HoldingId);
  if (!view || !fallbackZone) return items;
  return [
    ...items,
    {
      view,
      placement: {
        holdingId: view.holding.id,
        zoneId: fallbackZone,
        slot: 0,
        transform: live.transform,
      },
    },
  ];
}
