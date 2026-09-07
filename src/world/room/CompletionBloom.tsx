"use client";

import { AnimatePresence, motion } from "motion/react";

/**
 * The bloom over a completed set.
 *
 * Deliberately a screen-space layer rather than an object in the room, for the
 * same reason the vignette and the film grain are: bloom is something that
 * happens in a lens, not something that exists in a space. Trying to model it
 * as geometry inside the 3D chain produced exactly what you'd expect — a
 * rectangle of light with visible edges, sorted against the furniture.
 */
export function CompletionBloom({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="atmo"
          style={{
            zIndex: 22,
            mixBlendMode: "screen",
            background:
              "radial-gradient(46% 42% at 50% 46%, rgba(255,206,132,0.5), rgba(255,158,72,0.13) 52%, transparent 76%)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.34] }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.6, times: [0, 0.26, 1], ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}
