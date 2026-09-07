"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ease } from "@/design/motion";
import type { Profile, RoomTheme, User } from "@/domain/types";
import { useWorld } from "@/world/store/worldStore";
import { useReducedMotion } from "@/world/stage/useViewport";

const ARRIVAL_MS = 3400;

/**
 * Arriving in a room.
 *
 * Not a loading screen — there is nothing to load. It's the moment of walking
 * into a dark room and finding the light switch, and it exists because a room
 * that simply *appears* is a web page, while a room that resolves is a place
 * you entered.
 *
 * The sequence layers three things that resolve at different rates:
 *   1. a veil lifting, so the room emerges from black rather than fading in;
 *   2. the key light coming up, which is what actually reveals the objects;
 *   3. the collector's name, set like a title card and gone before it outstays.
 *
 * The camera is doing its own part of this — see `poseForView`'s arrival case,
 * which starts further back and settles forward.
 */
export function ArrivalSequence({
  user,
  profile,
  theme,
}: {
  user: User;
  profile: Profile;
  theme: RoomTheme;
}) {
  const view = useWorld((s) => s.view);
  const finishArrival = useWorld((s) => s.finishArrival);
  const reduced = useReducedMotion();
  const arriving = view.kind === "arrival";

  useEffect(() => {
    if (!arriving) return;
    const timer = setTimeout(finishArrival, reduced ? 400 : ARRIVAL_MS);
    return () => clearTimeout(timer);
  }, [arriving, finishArrival, reduced]);

  // Let people skip it. A cinematic open is a gift the first time and a tax
  // every time after.
  useEffect(() => {
    if (!arriving) return;
    const skip = () => finishArrival();
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [arriving, finishArrival]);

  return (
    <AnimatePresence>
      {arriving && (
        <>
          <motion.div
            className="atmo"
            style={{ background: "#05050a", zIndex: 60 }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.3 : 2.4, ease: [0.16, 0.84, 0.3, 1] }}
          />

          {/* Title card. Sits in the plane of the screen, not the room — this
              is the one moment the interface is allowed to be non-diegetic. */}
          <motion.div
            className="atmo"
            style={{
              zIndex: 61,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: 14,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduced ? 0.4 : 3.2,
              times: [0, 0.16, 0.62, 1],
              ease: "easeInOut",
            }}
          >
            <motion.div
              className="u-eyebrow"
              style={{ color: theme.inkSoft, letterSpacing: "0.42em" }}
              initial={{ y: 10 }}
              animate={{ y: 0 }}
              transition={ease.text}
            >
              Entering
            </motion.div>
            <motion.div
              className="u-display-xl"
              style={{ fontSize: 76, color: theme.ink }}
              initial={{ y: 18, filter: "blur(6px)" }}
              animate={{ y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.5, ease: [0.16, 0.84, 0.3, 1] }}
            >
              {user.displayName}
            </motion.div>
            <motion.div
              className="u-eyebrow"
              style={{ color: theme.light.fill, fontSize: 10 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 1 }}
            >
              {profile.tagline}
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Scales the room's key light during arrival.
 *
 * Returned as a multiplier the theme layer applies, so "the lights coming on"
 * is a property of the room's lighting model rather than a one-off overlay
 * animation. Every material in the scene reads --lit-strength, so they all
 * brighten together and in the right proportion.
 */
export function useArrivalLight(): number {
  const view = useWorld((s) => s.view);
  const arrived = useWorld((s) => s.arrived);
  if (view.kind === "arrival" && !arrived) return 0.12;
  return 1;
}
