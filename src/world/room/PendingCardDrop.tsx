"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { CollectibleTemplate, Member } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import { WorldNode } from "@/world/stage/WorldNode";
import { CARD_RATIO, Photocard } from "@/world/objects/Photocard";

/**
 * Where the mailer sits: on top of the archive crates, diagonally opposite the
 * binder.
 *
 * On the crates rather than on the floor because the floor is at the bottom
 * edge of the overview frame, and a card that starts its journey half
 * cropped-off can't be the thing the room is asking you to notice. The
 * diagonal matters too — it's what gives the flight a trajectory across the
 * room instead of a hop along one wall.
 */
export const DROP_POINT = { x: -320, y: 446, z: -250 };

/** Place the mailer on a given archive zone instead of Soomin's leftover coords. */
export function dropPointFor(archive: { transform: { x: number; y: number; z: number } }) {
  return {
    x: archive.transform.x + 60,
    y: archive.transform.y - 140,
    z: archive.transform.z + 70,
  };
}
const CARD_H = 116;

/**
 * A padded mailer on the floor with the card that finishes a set in it.
 *
 * This exists because the product's biggest moment needs a *place* to start
 * from. A button labelled "add card" would be the same click and none of the
 * meaning: the card has to be somewhere in the room, in something that just
 * came through the post, before it can travel across the room and land in a
 * binder. The whole flight is only legible because it has an origin you can
 * point at.
 */
export function PendingCardDrop({
  template,
  member,
  setName,
  remaining,
  interactive,
  onSend,
  origin = DROP_POINT,
}: {
  template: CollectibleTemplate;
  member?: Member | undefined;
  setName: string;
  /** How many the set is still missing, this card included. */
  remaining: number;
  interactive: boolean;
  onSend: () => void;
  origin?: { x: number; y: number; z: number };
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <WorldNode
      x={origin.x}
      y={origin.y}
      z={origin.z}
      w={230}
      h={150}
      className="zone-hotspot"
      style={{ transformStyle: "preserve-3d" }}
    >
      {/* Mailer, lying open on the floor. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformOrigin: "50% 100%",
          transform: "rotateX(72deg)",
          transformStyle: "preserve-3d",
        }}
      >
        <div
          className="m-paper"
          style={{
            ["--base" as string]: "#cbb99a",
            position: "absolute",
            inset: 0,
            borderRadius: 3,
            boxShadow: "0 10px 26px color-mix(in oklab, #000 55%, transparent)",
          }}
        />
        {/* Torn flap, folded back. */}
        <div
          className="m-paper"
          style={{
            ["--base" as string]: "#bda989",
            position: "absolute",
            left: 0,
            right: 0,
            top: -44,
            height: 48,
            transformOrigin: "50% 100%",
            transform: "rotateX(-46deg)",
            clipPath: "polygon(0 0, 100% 6%, 100% 100%, 0 100%)",
            filter: "brightness(0.88)",
          }}
        />
        <div
          className="u-eyebrow"
          style={{
            position: "absolute",
            left: 14,
            bottom: 10,
            fontSize: 7,
            color: "#4d3d29",
            letterSpacing: "0.24em",
          }}
        >
          {setName.split("—")[0]?.trim()}
        </div>
        <div
          className="u-display"
          style={{
            position: "absolute",
            left: 14,
            bottom: 28,
            fontSize: 15,
            fontStyle: "italic",
            color: "#3d2e1c",
            opacity: 0.7,
          }}
        >
          for the binder
        </div>
      </div>

      {/* The card, standing out of the mailer at an angle. */}
      <motion.div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 26,
          width: CARD_H * CARD_RATIO,
          height: CARD_H,
          marginLeft: (-CARD_H * CARD_RATIO) / 2,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 100%",
          cursor: interactive ? "pointer" : "default",
        }}
        animate={{
          rotateX: hovered ? -8 : -16,
          rotateZ: hovered ? -1 : -5,
          y: hovered ? -18 : 0,
          z: hovered ? 42 : 8,
        }}
        transition={objectSpring("photocard")}
        onPointerEnter={interactive ? () => setHovered(true) : undefined}
        onPointerLeave={() => setHovered(false)}
        onClick={interactive ? onSend : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-label={`${template.name}. Put it in the binder.`}
        onKeyDown={(e) => {
          if (interactive && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSend();
          }
        }}
      >
        <Photocard template={template} member={member} height={CARD_H} />
      </motion.div>

      {/* Prompt. The one piece of non-diegetic text in the room, and it earns
          its place by being the only thing that can't be inferred from looking
          at the object. */}
      <motion.div
        style={{
          position: "absolute",
          left: "50%",
          top: -28,
          marginLeft: -70,
          width: 140,
          textAlign: "center",
          pointerEvents: "none",
        }}
        animate={{ opacity: hovered ? 0.9 : 0, y: hovered ? -2 : 6 }}
        transition={objectSpring("photocard")}
      >
        <div
          className="u-eyebrow"
          style={{
            fontSize: 8,
            color: "var(--room-ink)",
            textShadow: "0 2px 10px rgba(0,0,0,0.7)",
          }}
        >
          {remaining} to go
        </div>
      </motion.div>
    </WorldNode>
  );
}
