"use client";

import { ROOM_DEPTH } from "@/domain/fixtures/collectors";
import { DECOR_BY_ID } from "@/domain/fixtures/decor";
import type { Room, RoomObject, Transform3D } from "@/domain/types";
import { DecorObject } from "./DecorObject";
import { GroundingShadow } from "./Grounding";

export function DecorLayer({
  room,
  objects,
  editing,
  selectedId,
  draggingId,
  live,
  spawn,
  far,
  onGrab,
}: {
  room: Room;
  objects: RoomObject[];
  editing: boolean;
  selectedId: string | null;
  draggingId: string | null;
  live: { id: string; transform: Transform3D } | null;
  spawn?: { assetId: string; transform: Transform3D; replaceId?: string } | null;
  far?: boolean;
  onGrab: (object: RoomObject, event: React.PointerEvent) => void;
}) {
  void room;
  const ghostId = spawn?.replaceId;
  return (
    <>
      {objects.map((object, i) => {
        if (ghostId && object.id === ghostId) return null;
        const asset = DECOR_BY_ID.get(object.assetId);
        if (!asset) return null;
        const transform = live?.id === object.id ? live.transform : object.transform;
        if (!transform) return null;
        const lifted = selectedId === object.id || draggingId === object.id;
        return (
          <DecorPiece
            key={`${object.id}:${object.assetId}:${i}`}
            assetId={object.assetId}
            transform={transform}
            lifted={lifted}
            editing={editing}
            far={far && !lifted}
            onGrab={(event) => onGrab(object, event)}
          />
        );
      })}
      {spawn && (
        <DecorPiece
          assetId={spawn.assetId}
          transform={spawn.transform}
          lifted
          editing
          far={false}
        />
      )}
    </>
  );
}

function DecorPiece({
  assetId,
  transform,
  lifted,
  editing,
  far,
  onGrab,
}: {
  assetId: string;
  transform: Transform3D;
  lifted: boolean;
  editing: boolean;
  far?: boolean;
  onGrab?: (event: React.PointerEvent) => void;
}) {
  const asset = DECOR_BY_ID.get(assetId);
  if (!asset) return null;
  const rug = asset.id === "accent-rug";
  const wallish = transform.z < -ROOM_DEPTH + 80;
  return (
    <>
      {!rug && !wallish && (
        <GroundingShadow
          x={transform.x}
          y={transform.y + asset.size.h / 2}
          z={transform.z}
          width={asset.size.w}
          depth={asset.size.d ?? 70}
          lift={lifted ? 1 : 0}
        />
      )}
      <DecorObject
        asset={asset}
        transform={transform}
        lifted={lifted}
        editing={editing}
        far={far}
        onGrab={onGrab}
      />
    </>
  );
}
