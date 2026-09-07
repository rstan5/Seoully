"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { HoldingView, RoomZone } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import type { InspectTarget } from "@/world/store/worldStore";
import { WorldNode } from "@/world/stage/WorldNode";

const DESK_DEPTH = 250;
const TOP_THICKNESS = 18;

interface DeskZoneProps {
  zone: RoomZone;
  items: HoldingView[];
  interactive: boolean;
  onSelect: (view: HoldingView, at: InspectTarget) => void;
}

/**
 * The collector's workspace.
 *
 * This is the room's only *horizontal* surface at working height, and it earns
 * its place by being where things are mid-process: ticket stubs not yet
 * archived, a wristband still out, the binder open next to them. A room where
 * everything is filed reads as a showroom; the desk is what makes it look
 * inhabited.
 */
export function DeskZone({ zone, items, interactive, onSelect }: DeskZoneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { w, h } = zone.size;
  const legInset = 26;

  return (
    <WorldNode x={zone.transform.x} y={zone.transform.y} z={zone.transform.z} w={w} h={h}>
      {/* Legs, set back and inboard so the top appears to float slightly. */}
      {[legInset, w - legInset - 22].map((left, i) => (
        <div
          key={i}
          className="m-brushed-metal"
          style={{
            position: "absolute",
            left,
            top: TOP_THICKNESS,
            width: 22,
            height: h - TOP_THICKNESS,
            filter: "brightness(0.42)",
            transform: `translateZ(${-DESK_DEPTH * 0.35}px)`,
          }}
        />
      ))}

      {/* Drawer unit under one side. Gives the desk mass and stops the space
          beneath it from reading as a black hole. */}
      <div
        style={{
          position: "absolute",
          left: w * 0.52,
          top: TOP_THICKNESS,
          width: w * 0.4,
          height: h * 0.62,
          transformStyle: "preserve-3d",
          transform: `translateZ(${-DESK_DEPTH * 0.32}px)`,
          background:
            "linear-gradient(var(--lit-angle), color-mix(in oklab, var(--room-furniture-edge) 22%, var(--room-furniture)), color-mix(in oklab, var(--room-furniture) 72%, #000))",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, #000 40%, transparent)",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 8,
              right: 8,
              top: 10 + i * (h * 0.62 - 20) / 3,
              height: (h * 0.62 - 26) / 3,
              background:
                "linear-gradient(180deg, color-mix(in oklab, #fff 5%, transparent), color-mix(in oklab, #000 22%, transparent))",
              boxShadow: "inset 0 1px 0 color-mix(in oklab, #fff 10%, transparent)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "38%",
                right: "38%",
                top: "42%",
                height: 4,
                borderRadius: 2,
                background: "color-mix(in oklab, var(--room-furniture-edge) 60%, transparent)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Desktop surface, folded forward toward the viewer.
          Wood rather than the room's furniture colour: this is the one plane
          the lamp actually falls on, and a matched-to-everything-else surface
          swallowed the light and read as a painted plank. */}
      <div
        className="m-warm-wood"
        style={{
          ["--base" as string]: "#6b4a35",
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: DESK_DEPTH,
          transformOrigin: "50% 0%",
          transform: "rotateX(90deg)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Objects lying flat on the desk. Rotated back upright so they sit on
            the surface rather than standing out of it. */}
        {items.map((view, index) => (
          <FlatObject
            key={view.holding.id}
            view={view}
            left={40 + index * 150}
            top={80 + (index % 2) * 42}
            rotate={index % 2 === 0 ? -7 : 5}
            hovered={hoveredId === view.holding.id}
            interactive={interactive}
            onHover={(hovering) => setHoveredId(hovering ? view.holding.id : null)}
            onSelect={() => onSelect(view, zone.transform)}
          />
        ))}
      </div>

      <DeskLamp left={26} baseTop={-4} />

      {/* Front edge of the desktop. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: TOP_THICKNESS,
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--room-furniture-edge) 46%, var(--room-furniture)), color-mix(in oklab, var(--room-furniture) 70%, #000))",
          boxShadow: "0 8px 26px color-mix(in oklab, #000 52%, transparent)",
        }}
      />

      <div
        className="contact-shadow"
        style={{ left: 0, bottom: -14, width: w, height: 34, ["--shadow-blur" as string]: "14px" }}
      />
    </WorldNode>
  );
}

/**
 * The desk lamp.
 *
 * Set dressing, but load-bearing set dressing: the room's key light comes from
 * this side, and until something physically emits it the lighting reads as an
 * arbitrary gradient. Giving the light a source is what makes the rest of the
 * shading feel motivated rather than decorative.
 */
function DeskLamp({ left, baseTop }: { left: number; baseTop: number }) {
  const armH = 190;
  return (
    <div
      style={{
        position: "absolute",
        left,
        top: baseTop - armH,
        width: 150,
        height: armH,
        transformStyle: "preserve-3d",
        transform: "translateZ(-70px)",
      }}
    >
      {/* Upright */}
      <div
        className="m-brushed-metal"
        style={{
          position: "absolute",
          left: 16,
          bottom: 0,
          width: 7,
          height: armH,
          filter: "brightness(0.55)",
        }}
      />
      {/* Arm, angled out over the desk. */}
      <div
        className="m-brushed-metal"
        style={{
          position: "absolute",
          left: 19,
          top: 6,
          width: 96,
          height: 6,
          transformOrigin: "0% 50%",
          transform: "rotate(14deg)",
          filter: "brightness(0.6)",
        }}
      />
      {/* Shade */}
      <div
        style={{
          position: "absolute",
          left: 92,
          top: 22,
          width: 58,
          height: 34,
          transform: "rotate(14deg)",
          borderRadius: "4px 4px 26px 26px",
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--room-furniture-edge) 40%, #2c2636), #1a1622)",
          boxShadow: "0 3px 10px rgba(0,0,0,0.5)",
        }}
      />
      {/* The bulb's glow, spilling down onto the desk. */}
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 50,
          width: 50,
          height: 16,
          borderRadius: "50%",
          background: `radial-gradient(circle, var(--room-light-color), transparent 72%)`,
          boxShadow: `0 0 60px 26px color-mix(in oklab, var(--room-light-color) 34%, transparent)`,
        }}
      />
    </div>
  );
}

/** A small paper item lying on the desk. */
function FlatObject({
  view,
  left,
  top,
  rotate,
  hovered,
  interactive,
  onHover,
  onSelect,
}: {
  view: HoldingView;
  left: number;
  top: number;
  rotate: number;
  hovered: boolean;
  interactive: boolean;
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
}) {
  const { template } = view;
  const isBand = template.material === "velvet";
  const w = isBand ? 128 : 116;
  const h = isBand ? 26 : 48;

  return (
    <motion.div
      className={`zone-hotspot ${isBand ? "m-velvet" : "m-paper"}`}
      style={{
        ["--base" as string]: template.colorway.base,
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        rotate,
        borderRadius: isBand ? 13 : 2,
        transformStyle: "preserve-3d",
        boxShadow: "2px 4px 10px color-mix(in oklab, #000 44%, transparent)",
        overflow: "hidden",
      }}
      animate={{ z: hovered ? 14 : 0 }}
      transition={objectSpring("photocard")}
      onHoverStart={interactive ? () => onHover(true) : undefined}
      onHoverEnd={interactive ? () => onHover(false) : undefined}
      onClick={interactive ? onSelect : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={interactive ? `${template.name}. Inspect.` : undefined}
    >
      {!isBand && (
        <>
          {/* Perforated stub edge — the detail that says "ticket". */}
          <div
            style={{
              position: "absolute",
              left: 34,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundImage: `repeating-linear-gradient(180deg, ${template.colorway.ink} 0 3px, transparent 3px 6px)`,
              opacity: 0.4,
            }}
          />
          <div
            className="u-eyebrow"
            style={{
              position: "absolute",
              left: 42,
              top: 9,
              fontSize: 7,
              color: template.colorway.ink,
              opacity: 0.8,
            }}
          >
            {view.era?.name ?? view.group.name}
          </div>
          <div
            style={{
              position: "absolute",
              left: 42,
              top: 22,
              right: 8,
              height: 3,
              background: template.colorway.accent,
              opacity: 0.6,
            }}
          />
        </>
      )}
    </motion.div>
  );
}
