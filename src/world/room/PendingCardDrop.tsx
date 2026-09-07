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
}: {
  template: CollectibleTemplate;
  member?: Member | undefined;
  setName: string;
  /** How many the set is still missing, this card included. */
  remaining: number;
  interactive: boolean;
  onSend: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <WorldNode
      x={DROP_POINT.x}
      y={DROP_POINT.y}
      z={DROP_POINT.z}
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
          {setName.split("—")[0]?.trim()} · {remaining} to go
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
          rotateX: hovered ? -6 : -13,
          rotateZ: hovered ? -2 : -6,
          y: hovered ? -14 : 0,
          z: hovered ? 34 : 0,
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
          top: -58,
          marginLeft: -90,
          width: 180,
          textAlign: "center",
          pointerEvents: "none",
        }}
        animate={{ opacity: hovered ? 1 : 0.62, y: hovered ? -4 : 0 }}
      >
        <div
          className="u-eyebrow"
          style={{
            fontSize: 15,
            color: "var(--room-ink)",
            textShadow: "0 2px 12px rgba(0,0,0,0.85)",
          }}
        >
          Put it in the binder
        </div>
        <div
          style={{
            width: 1,
            height: 26,
            margin: "8px auto 0",
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--room-ink) 55%, transparent), transparent)",
          }}
        />
      </motion.div>
    </WorldNode>
  );
}
