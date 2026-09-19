"use client";

import { useState } from "react";
import type { HoldingView, RoomZone } from "@/domain/types";
import type { InspectTarget } from "@/world/store/worldStore";
import { WorldNode } from "@/world/stage/WorldNode";
import { PosterSheet } from "@/world/objects/PosterSheet";
import { targetFor, type ArrangeContext } from "@/world/edit/arrange";

interface WallZoneProps {
  zone: RoomZone;
  items: HoldingView[];
  interactive: boolean;
  far?: boolean;
  selectedId?: string | null;
  arrange?: ArrangeContext;
  onSelect: (view: HoldingView, at: InspectTarget) => void;
}

/**
 * The poster wall.
 *
 * Deliberately not a grid. Real collector walls are an overlapping, slightly
 * crooked collage assembled over years, and a neat 3×2 arrangement is the
 * single fastest way to make this look like a CMS. The layout below is a fixed
 * composition with intentional overlap, varied scale, and mixed mounting —
 * treasured pieces get framed, everything else gets taped or pinned.
 */
export function WallZone({ zone, items, interactive, far = false, selectedId, arrange, onSelect }: WallZoneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { w, h } = zone.size;

  const slots = composeWall(items.length, w, h);

  return (
    <WorldNode x={zone.transform.x} y={zone.transform.y} z={zone.transform.z} w={w} h={h} className={far ? "fidelity-far" : undefined}>
      {items.map((view, index) => {
        const slot = slots[index];
        if (!slot) return null;
        const treasured = view.holding.treasured === true;
        return (
          <div
            key={view.holding.id}
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              // Later posters sit slightly proud, so overlaps read as layered
              // paper rather than z-fighting.
              transform: `translateZ(${index * 2.5}px)`,
            }}
          >
            <PosterSheet
              view={view}
              x={slot.x}
              y={slot.y}
              w={slot.w}
              h={slot.h}
              tilt={slot.tilt}
              mount={treasured ? "frame" : index % 2 === 0 ? "tape" : "pins"}
              hovered={hoveredId === view.holding.id}
              inspecting={selectedId === view.holding.id}
              interactive={interactive}
              arrange={targetFor(arrange, view.holding.id, {
                x: zone.transform.x - w / 2 + slot.x + slot.w / 2,
                y: zone.transform.y - h / 2 + slot.y + slot.h / 2,
                z: zone.transform.z,
              })}
              onHover={(hovering) => setHoveredId(hovering ? view.holding.id : null)}
              onSelect={() =>
                onSelect(view, {
                  x: zone.transform.x - w / 2 + slot.x + slot.w / 2,
                  y: zone.transform.y - h / 2 + slot.y + slot.h / 2,
                  z: zone.transform.z,
                })
              }
            />
          </div>
        );
      })}
    </WorldNode>
  );
}

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
  tilt: number;
}

/**
 * Fixed compositions rather than an algorithm.
 *
 * Procedural placement with jitter always ends up looking either too regular or
 * randomly scattered. Hand-composed arrangements per count read as an actual
 * person's wall, and there are only a handful of counts to support.
 */
function composeWall(count: number, w: number, h: number): Slot[] {
  const u = (fx: number) => fx * w;
  const v = (fy: number) => fy * h;

  const layouts: Record<number, Slot[]> = {
    1: [{ x: u(0.28), y: v(0.14), w: u(0.44), h: v(0.7), tilt: -1.2 }],
    2: [
      { x: u(0.04), y: v(0.1), w: u(0.44), h: v(0.68), tilt: -2 },
      { x: u(0.52), y: v(0.2), w: u(0.4), h: v(0.62), tilt: 1.6 },
    ],
    3: [
      // A dominant hero print, with two smaller pieces crowding it.
      { x: u(0.3), y: v(0.06), w: u(0.4), h: v(0.8), tilt: -0.8 },
      { x: u(0.02), y: v(0.2), w: u(0.31), h: v(0.5), tilt: -3.4 },
      { x: u(0.66), y: v(0.3), w: u(0.32), h: v(0.52), tilt: 2.6 },
    ],
    4: [
      { x: u(0.26), y: v(0.04), w: u(0.36), h: v(0.72), tilt: -1 },
      { x: u(0.01), y: v(0.16), w: u(0.28), h: v(0.44), tilt: -3.6 },
      { x: u(0.6), y: v(0.24), w: u(0.3), h: v(0.48), tilt: 2.4 },
      { x: u(0.16), y: v(0.58), w: u(0.26), h: v(0.36), tilt: 1.8 },
    ],
  };

  return layouts[count] ?? layouts[3]!;
}
