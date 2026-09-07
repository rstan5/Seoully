"use client";

import { motion } from "motion/react";
import type { RoomZone, SetProgress } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import { WorldNode } from "@/world/stage/WorldNode";

const SPINE = 34;

interface BinderZoneProps {
  zone: RoomZone;
  /** Sets tracked in this binder, used for the spine labels. */
  progress: SetProgress[];
  hovered: boolean;
  interactive: boolean;
  onHover: (hovering: boolean) => void;
  onOpen: () => void;
}

/**
 * The binder, closed and standing on the desk.
 *
 * Rendered as a real object with a spine, a swollen page block, and a cover
 * that tilts open a few degrees on hover — a full binder never closes flat.
 * Clicking doesn't open a modal; it hands off to the camera, which flies in
 * and opens the binder in place.
 */
export function BinderZone({
  zone,
  progress,
  hovered,
  interactive,
  onHover,
  onOpen,
}: BinderZoneProps) {
  const { w, h } = zone.size;
  const coverW = w - SPINE;
  const headline = progress[0];

  return (
    <WorldNode x={zone.transform.x} y={zone.transform.y} z={zone.transform.z} w={w} h={h}>
      <motion.div
        className="zone-hotspot"
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 100%",
        }}
        // Leans back against the wall behind the desk.
        animate={{
          rotateX: hovered ? -6 : -9,
          rotateY: hovered ? -13 : -7,
          z: hovered ? 26 : 0,
          y: hovered ? -6 : 0,
        }}
        transition={objectSpring("binder")}
        onHoverStart={interactive ? () => onHover(true) : undefined}
        onHoverEnd={interactive ? () => onHover(false) : undefined}
        onClick={interactive ? onOpen : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? "Photocard binder. Open." : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen();
                }
              }
            : undefined
        }
      >
        {/* Spine, angled away from the viewer. */}
        <div
          className="m-velvet"
          style={{
            ["--base" as string]: "#3a1420",
            position: "absolute",
            left: 0,
            top: 0,
            width: SPINE,
            height: h,
            transformOrigin: "0% 50%",
            transform: "rotateY(58deg)",
            overflow: "hidden",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%,-50%) rotate(180deg)",
              writingMode: "vertical-rl",
              fontFamily: "var(--font-sans)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "color-mix(in oklab, var(--color-bone) 80%, transparent)",
              whiteSpace: "nowrap",
            }}
          >
            {headline?.set.name.split("—")[0]?.trim() ?? "Binder"}
          </span>
        </div>

        {/* Page block: the sleeves visible along the open edge. A binder's
            thickness is the most legible sign of how much is inside it. */}
        <div
          style={{
            position: "absolute",
            right: 3,
            top: 6,
            width: 16,
            height: h - 12,
            transformOrigin: "100% 50%",
            transform: "rotateY(-90deg) translateZ(-2px)",
            background:
              "repeating-linear-gradient(180deg, #efe8da 0px, #d8cfbe 2px, #f4efe4 4px)",
            boxShadow: "inset 0 0 8px rgba(0,0,0,0.32)",
          }}
        />

        {/* Front cover */}
        <div
          className="m-velvet"
          style={{
            ["--base" as string]: "#4a1c2c",
            position: "absolute",
            left: SPINE,
            top: 0,
            width: coverW,
            height: h,
            borderRadius: "2px 5px 5px 2px",
            boxShadow:
              "inset 0 0 0 1px color-mix(in oklab, #fff 8%, transparent), 10px 14px 30px color-mix(in oklab, #000 60%, transparent)",
            overflow: "hidden",
          }}
        >
          {/* Debossed frame and label, the way binder covers actually are. */}
          <div
            style={{
              position: "absolute",
              inset: 14,
              border: "1px solid color-mix(in oklab, var(--color-bone) 20%, transparent)",
              boxShadow: "inset 0 1px 0 rgba(0,0,0,0.4)",
            }}
          />
          <div style={{ position: "absolute", left: 26, top: 34, right: 26 }}>
            <div
              className="u-eyebrow"
              style={{ fontSize: 7.5, color: "var(--color-bone)", opacity: 0.55 }}
            >
              {headline?.set.groupId === "skz" ? "Stray Kids" : "Collection"}
            </div>
            <div
              className="u-display"
              style={{ fontSize: 26, marginTop: 8, color: "var(--color-paper)" }}
            >
              {headline?.set.name.split("—")[0]?.trim() ?? "Photocards"}
            </div>
          </div>

          {/* Completion mark, foil-stamped into the cover. This is the only
              place in the room where progress is stated as a number, and it
              earns it by being physically part of the object. */}
          {headline && (
            <div style={{ position: "absolute", left: 26, bottom: 30 }}>
              <div
                className="u-stat"
                style={{
                  fontSize: 15,
                  color: headline.complete ? "#e8c46a" : "color-mix(in oklab, var(--color-bone) 62%, transparent)",
                  letterSpacing: "0.04em",
                }}
              >
                {headline.owned}
                <span style={{ opacity: 0.5 }}>/{headline.total}</span>
              </div>
            </div>
          )}

          {/* Elastic closure band. */}
          <div
            style={{
              position: "absolute",
              right: 30,
              top: -6,
              bottom: -6,
              width: 9,
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.5), color-mix(in oklab, #1c1620 88%, #000), rgba(0,0,0,0.5))",
              boxShadow: "0 0 8px rgba(0,0,0,0.5)",
            }}
          />
        </div>
      </motion.div>

      <div
        className="contact-shadow"
        style={{ left: 6, bottom: -12, width: w, height: 26, ["--shadow-blur" as string]: "10px" }}
      />
    </WorldNode>
  );
}
