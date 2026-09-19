"use client";

import { useState } from "react";
import type { HoldingView, RoomZone } from "@/domain/types";
import type { InspectTarget } from "@/world/store/worldStore";
import { WorldNode } from "@/world/stage/WorldNode";
import { FigureStand, Lightstick, Plushie } from "@/world/objects/CaseObjects";
import { targetFor, type ArrangeContext } from "@/world/edit/arrange";

const CASE_DEPTH = 150;
const GLASS_INSET = 12;

interface DisplayCaseZoneProps {
  zone: RoomZone;
  items: HoldingView[];
  interactive: boolean;
  far?: boolean;
  selectedId?: string | null;
  arrange?: ArrangeContext;
  onSelect: (view: HoldingView, at: InspectTarget) => void;
}

/**
 * The display case: an acrylic-fronted cabinet for the pieces that don't get
 * handled.
 *
 * The glass front is the whole point. It's rendered as a real pane sitting
 * *forward* of the contents, so objects are genuinely behind it and pick up the
 * pane's specular streak. That single layer is what distinguishes a display
 * case from an open shelf, and it's why the rare items in here read as
 * protected rather than just arranged.
 */
export function DisplayCaseZone({ zone, items, interactive, far = false, selectedId, arrange, onSelect }: DisplayCaseZoneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { w, h } = zone.size;

  const shelves = distribute(items);
  const shelfH = (h - GLASS_INSET * 2) / shelves.length;

  return (
    <WorldNode x={zone.transform.x} y={zone.transform.y} z={zone.transform.z} w={w} h={h} className={far ? "fidelity-far" : undefined}>
      {/* Cabinet interior, lit from within. Backlighting a case is what makes
          the objects inside pop against a dark room. */}
      <div
        className="world-face"
        style={{
          transform: `translateZ(${-CASE_DEPTH}px)`,
          background: `linear-gradient(180deg,
            color-mix(in oklab, var(--room-light-color) 16%, var(--room-furniture)),
            color-mix(in oklab, var(--room-furniture) 76%, #000))`,
        }}
      />

      {/* Interior side walls */}
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          style={{
            position: "absolute",
            top: 0,
            [side]: 0,
            width: CASE_DEPTH,
            height: h,
            transformOrigin: side === "left" ? "0% 50%" : "100% 50%",
            transform: `rotateY(${side === "left" ? -90 : 90}deg)`,
            background: `color-mix(in oklab, var(--room-furniture) ${side === "left" ? 82 : 58}%, #000)`,
          }}
        />
      ))}

      {shelves.map((shelfItems, shelfIndex) => {
        const top = GLASS_INSET + shelfIndex * shelfH;
        const objectSize = Math.min(shelfH * 0.62, (w - 40) / Math.max(2, shelfItems.length));

        return (
          <div
            key={shelfIndex}
            style={{
              position: "absolute",
              left: GLASS_INSET,
              top,
              width: w - GLASS_INSET * 2,
              height: shelfH,
              transformStyle: "preserve-3d",
            }}
          >
            {/* Glass shelf: a thin lit edge is all you see of it head-on. */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                width: "100%",
                height: 5,
                background:
                  "linear-gradient(180deg, color-mix(in oklab, #fff 34%, transparent), color-mix(in oklab, var(--room-light-color) 22%, transparent))",
                boxShadow: "0 0 14px color-mix(in oklab, var(--room-light-color) 30%, transparent)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 5,
                left: 0,
                width: "100%",
                height: CASE_DEPTH,
                transformOrigin: "50% 100%",
                transform: "rotateX(-90deg)",
                background:
                  "linear-gradient(180deg, color-mix(in oklab, #fff 8%, transparent), transparent 70%)",
              }}
            />

            {shelfItems.map((view, i) => {
              const spacing = (w - GLASS_INSET * 2) / (shelfItems.length + 1);
              const x = spacing * (i + 1) - objectSize / 2;
              const shared = {
                view,
                x,
                bottom: 6,
                size: objectSize,
                hovered: hoveredId === view.holding.id,
                inspecting: selectedId === view.holding.id,
                interactive,
                arrange: targetFor(arrange, view.holding.id, {
                  x: zone.transform.x - w / 2 + GLASS_INSET + x + objectSize / 2,
                  y: zone.transform.y - h / 2 + top + shelfH - objectSize * 0.58,
                  z: zone.transform.z - 40,
                }),
                onHover: (hovering: boolean) =>
                  setHoveredId(hovering ? view.holding.id : null),
                onSelect: () => onSelect(view, zone.transform),
              };
              switch (view.template.kind) {
                case "lightstick":
                  return <Lightstick key={view.holding.id} {...shared} />;
                case "figure":
                  return <FigureStand key={view.holding.id} {...shared} />;
                default:
                  return <Plushie key={view.holding.id} {...shared} />;
              }
            })}
          </div>
        );
      })}

      {/* Cabinet frame */}
      {(
        [
          { left: 0, top: 0, width: GLASS_INSET, height: h },
          { right: 0, top: 0, width: GLASS_INSET, height: h },
          { left: 0, top: 0, width: w, height: GLASS_INSET },
          { left: 0, bottom: 0, width: w, height: GLASS_INSET },
        ] as React.CSSProperties[]
      ).map((box, i) => (
        <div
          key={i}
          className="m-brushed-metal"
          style={{
            position: "absolute",
            ...box,
            background: "color-mix(in oklab, var(--room-furniture-edge) 50%, #2a2433)",
          }}
        />
      ))}

      {/* The acrylic pane, forward of everything. */}
      <div
        className="m-acrylic"
        style={{
          position: "absolute",
          left: GLASS_INSET,
          top: GLASS_INSET,
          width: w - GLASS_INSET * 2,
          height: h - GLASS_INSET * 2,
          transform: "translateZ(4px)",
          pointerEvents: "none",
        }}
      />

      <div
        className="contact-shadow"
        style={{ left: -16, bottom: -16, width: w + 32, height: 40, ["--shadow-blur" as string]: "14px" }}
      />
    </WorldNode>
  );
}

/**
 * Splits contents across shelves, keeping the tallest object on its own row so
 * a lightstick never ends up sharing a shelf it doesn't fit on.
 */
function distribute(items: HoldingView[]): HoldingView[][] {
  const tall = items.filter((i) => i.template.kind === "lightstick" || i.template.kind === "figure");
  const rest = items.filter((i) => !tall.includes(i));
  const shelves: HoldingView[][] = [];
  if (tall.length) shelves.push(tall);
  for (let i = 0; i < rest.length; i += 2) shelves.push(rest.slice(i, i + 2));
  return shelves.length ? shelves : [[]];
}
