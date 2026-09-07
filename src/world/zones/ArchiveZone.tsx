"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { HoldingView, RoomZone } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import type { InspectTarget } from "@/world/store/worldStore";
import { WorldNode } from "@/world/stage/WorldNode";

const CRATE_DEPTH = 190;

interface ArchiveZoneProps {
  zone: RoomZone;
  items: HoldingView[];
  interactive: boolean;
  onSelect: (view: HoldingView, at: InspectTarget) => void;
}

/**
 * The archive: crates on the floor, well forward of everything else.
 *
 * Its real job in the composition is depth. Every other zone sits against the
 * back wall, and without something occupying the near ground the room reads as
 * a flat backdrop. Putting the least glamorous objects closest to the camera is
 * also just true to life — the overflow boxes are always the thing you trip on.
 */
export function ArchiveZone({ zone, items, interactive, onSelect }: ArchiveZoneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { w, h } = zone.size;
  const crateW = Math.min(180, w / Math.max(1, items.length) - 12);

  return (
    <WorldNode x={zone.transform.x} y={zone.transform.y} z={zone.transform.z} w={w} h={h}>
      {items.map((view, index) => {
        const hovered = hoveredId === view.holding.id;
        // Stagger depth as well as position, so the crates form a small pile
        // rather than a row.
        const zOffset = index * 34;
        const yOffset = index * -18;

        return (
          <motion.div
            key={view.holding.id}
            className="zone-hotspot"
            style={{
              position: "absolute",
              left: index * (crateW + 14),
              bottom: 0,
              width: crateW,
              height: h * 0.78,
              transformStyle: "preserve-3d",
              transformOrigin: "50% 100%",
            }}
            animate={{
              z: hovered ? zOffset + 26 : zOffset,
              y: hovered ? yOffset - 10 : yOffset,
              rotateY: hovered ? -8 : -3 + index * 5,
            }}
            transition={objectSpring("furniture")}
            onHoverStart={interactive ? () => setHoveredId(view.holding.id) : undefined}
            onHoverEnd={interactive ? () => setHoveredId(null) : undefined}
            onClick={interactive ? () => onSelect(view, zone.transform) : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-label={interactive ? `${view.template.name}. Inspect.` : undefined}
          >
            {/* Lid, folded back to give the crate a real top surface. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: crateW,
                height: CRATE_DEPTH,
                transformOrigin: "50% 0%",
                transform: "rotateX(-90deg)",
                background:
                  "linear-gradient(180deg, color-mix(in oklab, var(--room-furniture-edge) 26%, #3a3040), color-mix(in oklab, #241d2c 80%, #000))",
              }}
            />
            {/* Front face */}
            <div
              className="world-face m-paper"
              style={{
                ["--base" as string]: "#332a3d",
                boxShadow:
                  "inset 0 0 0 1px color-mix(in oklab, #000 46%, transparent), 6px 10px 22px color-mix(in oklab, #000 58%, transparent)",
                overflow: "hidden",
              }}
            >
              {/* Handle cutout */}
              <div
                style={{
                  position: "absolute",
                  left: "34%",
                  right: "34%",
                  top: "18%",
                  height: 13,
                  borderRadius: 7,
                  background: "color-mix(in oklab, #000 62%, transparent)",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.7)",
                }}
              />
              {/* Hand-written label. Every archive box has one. */}
              <div
                style={{
                  position: "absolute",
                  left: "16%",
                  right: "16%",
                  bottom: "18%",
                  padding: "5px 7px",
                  background: "color-mix(in oklab, var(--color-paper) 82%, transparent)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 8,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#2c2333",
                  textAlign: "center",
                  transform: `rotate(${index % 2 === 0 ? -1.6 : 1.2}deg)`,
                }}
              >
                {view.era?.name ?? view.group.name}
              </div>
            </div>
          </motion.div>
        );
      })}

      <div
        className="contact-shadow"
        style={{ left: -10, bottom: -10, width: w + 20, height: 30, ["--shadow-blur" as string]: "12px" }}
      />
    </WorldNode>
  );
}
