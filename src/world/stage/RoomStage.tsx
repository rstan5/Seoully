"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import type { Room } from "@/domain/types";
import { spring } from "@/design/motion";
import { useWorld } from "@/world/store/worldStore";
import { PERSPECTIVE, parallaxFor, poseForView, poseToTransform } from "./camera";
import { useReducedMotion, useViewport } from "./useViewport";

/**
 * The stage owns the lens; the camera element owns the view.
 *
 * Every navigation in the product is a change to one transform on one element.
 * Nothing unmounts, nothing cross-fades. That single constraint is what makes
 * the product read as a place instead of a website, so this component is
 * deliberately the only thing allowed to move the camera.
 *
 * Per-frame values (pose springs, pointer parallax) are motion values, never
 * React state — the camera animates entirely off the render path.
 */
export function RoomStage({ room, children }: { room: Room; children: ReactNode }) {
  const view = useWorld((s) => s.view);
  const viewport = useViewport();
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);

  const target = poseForView(view, room, viewport);
  const transition = reduced ? { duration: 0.2 } : spring.camera;

  // Pose channels, each its own spring seeded with a plain number.
  //
  // Springing the channels independently rather than interpolating a transform
  // string keeps the motion physical when a move is interrupted mid-flight,
  // which happens constantly as people click around. Seeded with numbers rather
  // than with source motion values on purpose: a spring driven by a source
  // follows the source, and `.set()` on the output is then a jump rather than
  // an animation, which silently produces a camera that never travels.
  const x = useSpring(target.x, transition);
  const y = useSpring(target.y, transition);
  const z = useSpring(target.z, transition);
  const dolly = useSpring(target.dolly, transition);
  const rotateX = useSpring(target.rotateX, transition);
  const rotateY = useSpring(target.rotateY, transition);

  useEffect(() => {
    x.set(target.x);
    y.set(target.y);
    z.set(target.z);
    dolly.set(target.dolly);
    rotateX.set(target.rotateX);
    rotateY.set(target.rotateY);
  }, [target.x, target.y, target.z, target.dolly, target.rotateX, target.rotateY, x, y, z, dolly, rotateX, rotateY]);

  // Pointer parallax. Softly sprung so the room has inertia rather than
  // sticking to the cursor like a hover effect.
  const pointerX = useSpring(0, { stiffness: 60, damping: 20, mass: 0.9 });
  const pointerY = useSpring(0, { stiffness: 60, damping: 20, mass: 0.9 });

  useEffect(() => {
    if (reduced) return;
    const onMove = (event: PointerEvent) => {
      pointerX.set((event.clientX / window.innerWidth) * 2 - 1);
      pointerY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [pointerX, pointerY, reduced]);

  const amount = parallaxFor(view);

  const transform = useTransform(
    [x, y, z, dolly, rotateX, rotateY, pointerX, pointerY],
    ([cx, cy, cz, cd, rx, ry, px, py]: number[]) =>
      poseToTransform({
        x: cx ?? 0,
        y: cy ?? 0,
        z: cz ?? 0,
        dolly: cd ?? 0,
        // Parallax is inverted: moving the pointer right should swing the room
        // as though you leaned right, revealing the left-hand surfaces.
        rotateX: (rx ?? 0) + (py ?? 0) * -amount.rotateX,
        rotateY: (ry ?? 0) + (px ?? 0) * amount.rotateY,
      }),
  );

  return (
    <>
      <div className="world-backdrop" />
      <div
        ref={stageRef}
        className="world-stage"
        style={{ ["--world-perspective" as string]: `${PERSPECTIVE}px` }}
      >
        <motion.div className="world-camera" style={{ transform }}>
          {children}
        </motion.div>
      </div>
    </>
  );
}
