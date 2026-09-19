"use client";

import { Fragment } from "react";
import type { HoldingView, Placement, Transform3D } from "@/domain/types";
import type { InspectTarget } from "@/world/store/worldStore";
import { WorldNode } from "@/world/stage/WorldNode";
import { AlbumSpine, ALBUM_HEIGHT, spineWidth } from "@/world/objects/AlbumSpine";
import { PosterSheet } from "@/world/objects/PosterSheet";
import { FigureStand, Lightstick, Plushie } from "@/world/objects/CaseObjects";
import { Photocard, CARD_HEIGHT, CARD_WIDTH } from "@/world/objects/Photocard";
import { targetFor, type ArrangeContext } from "./arrange";
import { GroundingShadow } from "./Grounding";
import { heightForKind } from "./useRoomEdit";

export interface FreeHolding {
  view: HoldingView;
  placement: Placement;
}

export function FreeLayer({
  items,
  live,
  editing,
  arrange,
  far,
  onSelect,
}: {
  items: FreeHolding[];
  live: { id: string; transform: Transform3D } | null;
  editing: boolean;
  arrange?: ArrangeContext;
  far?: boolean;
  onSelect: (view: HoldingView, at: InspectTarget) => void;
}) {
  return (
    <>
      {items.map(({ view, placement }) => {
        const transform =
          live?.id === view.holding.id ? live.transform : placement.transform;
        if (!transform) return null;
        const lifted =
          arrange?.selectedId === view.holding.id || arrange?.draggingId === view.holding.id;
        const height = heightForKind(view.template.kind);
        const width = widthFor(view);
        const wallish = transform.z < -820;
        return (
          <Fragment key={view.holding.id}>
            {!wallish && (
              <GroundingShadow
                x={transform.x}
                y={transform.y + height / 2}
                z={transform.z}
                width={width}
                depth={Math.max(36, width * 0.55)}
                lift={lifted ? 1 : 0}
              />
            )}
            <FreeCollectible
              view={view}
              transform={transform}
              editing={editing}
              far={far && !lifted}
              arrange={arrange}
              onSelect={() =>
                onSelect(view, {
                  x: transform.x,
                  y: transform.y,
                  z: transform.z,
                  height,
                })
              }
            />
          </Fragment>
        );
      })}
    </>
  );
}

function widthFor(view: HoldingView): number {
  switch (view.template.kind) {
    case "album":
    case "vinyl":
    case "book":
      return Math.max(36, spineWidth(view) * 3);
    case "poster":
      return 180;
    case "photocard":
      return CARD_WIDTH;
    default:
      return 90;
  }
}

function FreeCollectible({
  view,
  transform,
  editing,
  far,
  arrange,
  onSelect,
}: {
  view: HoldingView;
  transform: Transform3D;
  editing: boolean;
  far?: boolean;
  arrange?: ArrangeContext;
  onSelect: () => void;
}) {
  const target = targetFor(arrange, view.holding.id, transform);
  const kind = view.template.kind;

  if (kind === "poster") {
    const w = 180;
    const h = 240;
    return (
      <WorldNode
        x={transform.x}
        y={transform.y}
        z={transform.z}
        w={w}
        h={h}
        rotateY={transform.rotateY ?? 0}
        scale={transform.scale ?? 1}
        className={far ? "fidelity-far" : undefined}
      >
        <PosterSheet
          view={view}
          x={0}
          y={0}
          w={w}
          h={h}
          tilt={0}
          mount={view.holding.treasured ? "frame" : "tape"}
          hovered={false}
          interactive={!editing}
          arrange={target}
          onHover={() => undefined}
          onSelect={onSelect}
        />
      </WorldNode>
    );
  }

  if (kind === "photocard") {
    return (
      <WorldNode
        x={transform.x}
        y={transform.y}
        z={transform.z}
        w={CARD_WIDTH}
        h={CARD_HEIGHT}
        rotateY={transform.rotateY ?? 0}
        className={far ? "fidelity-far" : undefined}
      >
        <div
          className={editing ? "editing-grab" : undefined}
          style={{
            position: "absolute",
            inset: 0,
            cursor: editing ? "grab" : undefined,
            touchAction: editing ? "none" : undefined,
          }}
          onPointerDown={target?.onGrab}
          onClick={!editing ? onSelect : undefined}
          role="button"
          tabIndex={0}
        >
          <Photocard
            template={view.template}
            {...(view.member ? { member: view.member } : {})}
            reactive={!far}
            examining={target?.selected}
          />
        </div>
      </WorldNode>
    );
  }

  if (kind === "lightstick" || kind === "figure" || kind === "plushie") {
    const size = 96;
    const shared = {
      view,
      x: 0,
      bottom: 0,
      size,
      hovered: false,
      interactive: !editing,
      arrange: target,
      onHover: () => undefined,
      onSelect,
    };
    return (
      <WorldNode
        x={transform.x}
        y={transform.y}
        z={transform.z}
        w={size}
        h={size * 1.2}
        rotateY={transform.rotateY ?? 0}
        className={far ? "fidelity-far" : undefined}
      >
        {kind === "lightstick" ? (
          <Lightstick {...shared} />
        ) : kind === "figure" ? (
          <FigureStand {...shared} />
        ) : (
          <Plushie {...shared} />
        )}
      </WorldNode>
    );
  }

  if (kind === "memorabilia" || kind === "apparel") {
    const w = 116;
    const h = 48;
    return (
      <WorldNode
        x={transform.x}
        y={transform.y}
        z={transform.z}
        w={w}
        h={h}
        rotateX={transform.z > -700 ? 72 : 0}
        className={far ? "fidelity-far" : undefined}
      >
        <div
          className={`m-paper${editing ? " editing-grab" : ""}`}
          style={{
            ["--base" as string]: view.template.colorway.base,
            position: "absolute",
            inset: 0,
            cursor: editing ? "grab" : undefined,
            touchAction: editing ? "none" : undefined,
          }}
          onPointerDown={target?.onGrab}
          onClick={!editing ? onSelect : undefined}
          role="button"
          tabIndex={0}
        />
      </WorldNode>
    );
  }

  const height = kind === "vinyl" ? ALBUM_HEIGHT + 34 : ALBUM_HEIGHT;
  const width = spineWidth(view);
  return (
    <WorldNode
      x={transform.x}
      y={transform.y}
      z={transform.z}
      w={width}
      h={height}
      rotateY={transform.rotateY ?? 0}
      className={far ? "fidelity-far" : undefined}
    >
      <AlbumSpine
        view={view}
        offsetX={0}
        lean={0}
        hovered={false}
        inspecting={false}
        displaced={0}
        interactive={!editing}
        arrange={target}
        onHover={() => undefined}
        onSelect={onSelect}
      />
    </WorldNode>
  );
}
