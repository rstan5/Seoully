"use client";

import { motion } from "motion/react";
import type { CollectibleTemplate, Member } from "@/domain/types";
import { flightDuration } from "@/design/motion";
import { FLOOR_Y } from "@/domain/fixtures/collectors";
import { CARD_RATIO, Photocard } from "@/world/objects/Photocard";

export interface FlightPath {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
}

/**
 * A photocard crossing the room.
 *
 * Deliberately *not* a portal or an overlay layer. The card is rendered as a
 * node in the same 3D chain as the furniture, and its world coordinates are
 * animated directly — so the perspective, the scale falloff with depth, and the
 * occlusion against the shelf and the desk are all the ones the room already
 * uses. A DOM-overlay flight layer would have to fake every one of those, and
 * the fake is visible precisely at the moment the product is asking to be
 * believed.
 *
 * The arc is a three-point keyframe rather than a straight interpolation.
 * A card thrown across a room rises, comes toward the viewer, and drops into
 * place; a straight line between two points reads as a UI element sliding.
 */
export function CardFlight({
  template,
  member,
  path,
  height,
  pacing,
  onArrive,
}: {
  template: CollectibleTemplate;
  member?: Member | undefined;
  path: FlightPath;
  /** Card height at the destination. It grows on the way past the camera. */
  height: number;
  pacing?: number;
  onArrive: () => void;
}) {
  const { from, to } = path;
  const span = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const duration = flightDuration(span, "photocard", pacing);

  // Apex: up, and pulled toward the viewer so the card passes in front of the
  // furniture instead of clipping through it.
  const apex = {
    x: (from.x + to.x) / 2 + (to.x - from.x) * 0.1,
    y: Math.min(from.y, to.y) - 300,
    z: Math.max(from.z, to.z) + 300,
  };

  return (
    <>
      {/* Contact shadow, tracking the card across the floor. It's the cheapest
          possible proof that the card is at a height, and without it a flying
          object reads as a sticker moving over a photograph. */}
      <motion.div
        className="contact-shadow"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: height * CARD_RATIO * 1.5,
          height: height * 0.5,
          marginLeft: (-height * CARD_RATIO * 1.5) / 2,
          marginTop: -height * 0.25,
          ["--shadow-blur" as string]: "22px",
        }}
        initial={{
          x: from.x,
          y: FLOOR_Y - 2,
          z: from.z,
          rotateX: 90,
          opacity: 0.42,
          scale: 1,
        }}
        animate={{
          x: [from.x, apex.x, to.x],
          y: FLOOR_Y - 2,
          z: [from.z, apex.z, to.z],
          rotateX: 90,
          opacity: [0.42, 0.08, 0.3],
          scale: [1, 2.1, 1.1],
        }}
        transition={{ duration, times: [0, 0.45, 1], ease: ["easeOut", "easeInOut"] }}
      />

      <motion.div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: height * CARD_RATIO,
          height,
          marginLeft: (-height * CARD_RATIO) / 2,
          marginTop: -height / 2,
          transformStyle: "preserve-3d",
          zIndex: 30,
        }}
        initial={{
          x: from.x,
          y: from.y,
          z: from.z,
          // Starts lying nearly flat, as it was on the floor.
          rotateX: 68,
          rotateY: 24,
          rotateZ: -12,
          scale: 0.9,
        }}
        animate={{
          x: [from.x, apex.x, to.x],
          y: [from.y, apex.y, to.y],
          z: [from.z, apex.z, to.z],
          // Rights itself over the flight, squaring up to the page it's
          // arriving at. The rotation resolving *as* it lands is what makes the
          // landing feel like a landing.
          rotateX: [68, 16, 0],
          rotateY: [24, -22, 0],
          rotateZ: [-12, 14, 0],
          scale: [0.9, 1.5, 1],
        }}
        transition={{ duration, times: [0, 0.45, 1], ease: ["easeOut", "easeInOut"] }}
        onAnimationComplete={onArrive}
      >
        <Photocard template={template} member={member} height={height} />
      </motion.div>
    </>
  );
}
