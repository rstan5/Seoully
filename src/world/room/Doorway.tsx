"use client";

import { AnimatePresence, motion } from "motion/react";
import type { TraversalPhase } from "@/world/store/worldStore";
import type { TravelDestination } from "@/world/useTraversal";

/**
 * The light you pass through between two rooms.
 *
 * A screen-space wipe, and unapologetically so — it's the one moment in the
 * product where something genuinely discontinuous happens, and the honest way
 * to handle that is to put a physical event in front of it. The slot of light
 * takes the colour of the room you're walking into, so entering Minji's
 * daylight apartment does not feel like entering Soomin's night bedroom.
 */
export function Doorway({
  phase,
  destination,
}: {
  phase: TraversalPhase;
  destination: TravelDestination | null;
}) {
  const light = destination?.light ?? "#ffecce";
  const fill = destination?.fill ?? "#ffce96";

  return (
    <AnimatePresence>
      {phase === "leaving" && (
        <motion.div
          className="atmo"
          style={{ zIndex: 80, background: "#0a0810" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.5, 0, 0.9, 0.4] }}
        >
          <motion.div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 240,
              height: 460,
              marginLeft: -120,
              marginTop: -230,
              borderRadius: "6px 6px 2px 2px",
              background: `linear-gradient(178deg, ${light}, color-mix(in oklab, ${fill} 70%, ${light}))`,
              boxShadow: `0 0 180px 70px color-mix(in oklab, ${fill} 42%, transparent)`,
            }}
            initial={{ scaleX: 0.06, scaleY: 0.7, opacity: 0 }}
            animate={{ scaleX: 9, scaleY: 3.4, opacity: 1 }}
            transition={{ duration: 0.58, ease: [0.36, 0, 0.66, 0.28] }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
