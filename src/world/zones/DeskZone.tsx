"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { HoldingView, RoomZone } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import type { InspectTarget } from "@/world/store/worldStore";
import { WorldNode } from "@/world/stage/WorldNode";
import { grabHandlers, mergeArrange, targetFor, type ArrangeContext } from "@/world/edit/arrange";

const DESK_DEPTH = 250;
const TOP_THICKNESS = 18;

interface DeskZoneProps {
  zone: RoomZone;
  items: HoldingView[];
  interactive: boolean;
  far?: boolean;
  lamp?: boolean;
  selectedId?: string | null;
  arrange?: ArrangeContext;
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
export function DeskZone({ zone, items, interactive, far = false, lamp = true, selectedId, arrange, onSelect }: DeskZoneProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { w, h } = zone.size;
  const legInset = 26;

  return (
    <WorldNode x={zone.transform.x} y={zone.transform.y} z={zone.transform.z} w={w} h={h} className={far ? "fidelity-far" : undefined}>
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
            background: "color-mix(in oklab, var(--room-furniture-edge) 40%, #1c1824)",
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
          ["--base" as string]: "color-mix(in oklab, var(--room-furniture) 42%, #7a5236)",
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
            inspecting={selectedId === view.holding.id}
            interactive={interactive}
            arrange={targetFor(arrange, view.holding.id, {
              x: zone.transform.x - w / 2 + 40 + index * 150 + 58,
              y: zone.transform.y - h / 2 + TOP_THICKNESS,
              z: zone.transform.z - (80 + (index % 2) * 42),
            })}
            onHover={(hovering) => setHoveredId(hovering ? view.holding.id : null)}
            onSelect={() => onSelect(view, zone.transform)}
          />
        ))}
      </div>

      {lamp && <DeskLamp left={26} baseTop={-4} />}

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
          background: "color-mix(in oklab, var(--room-furniture-edge) 55%, #2a2432)",
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
          background: "color-mix(in oklab, var(--room-furniture-edge) 60%, #2a2432)",
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
  inspecting = false,
  interactive,
  onHover,
  onSelect,
  arrange,
}: {
  view: HoldingView;
  left: number;
  top: number;
  rotate: number;
  hovered: boolean;
  inspecting?: boolean;
  interactive: boolean;
  arrange?: ReturnType<typeof targetFor>;
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
}) {
  const { template } = view;
  const isBand = template.material === "velvet";
  const w = isBand ? 128 : 116;
  const h = isBand ? 26 : 48;
  const grab = grabHandlers(arrange, interactive, onSelect);

  return (
    <motion.div
      className={`zone-hotspot ${isBand ? "m-velvet" : "m-paper"}${arrange?.editing ? " editing-grab" : ""}`}
      style={{
        ["--base" as string]: template.colorway.base,
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        borderRadius: isBand ? 13 : 2,
        transformStyle: "preserve-3d",
        boxShadow: "2px 4px 10px color-mix(in oklab, #000 44%, transparent)",
        overflow: "hidden",
        touchAction: arrange?.editing ? "none" : undefined,
      }}
      animate={
        inspecting
          ? { z: 90, y: -28, rotateX: -28, scale: 1.55, rotate }
          : mergeArrange({ z: hovered ? 14 : 0, y: 0, rotate }, arrange)
      }
      transition={objectSpring("photocard")}
      onHoverStart={interactive || arrange?.editing ? () => onHover(true) : undefined}
      onHoverEnd={interactive || arrange?.editing ? () => onHover(false) : undefined}
      onPointerDown={grab.onPointerDown}
      onClick={grab.onClick}
      role={grab.role}
      tabIndex={grab.tabIndex}
      aria-label={
        arrange?.editing
          ? `${template.name}. Move.`
          : interactive
            ? `${template.name}. Inspect.`
            : undefined
      }
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
