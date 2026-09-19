"use client";

import type { Surface } from "@/domain/placement-rules";
import { WorldNode } from "@/world/stage/WorldNode";

/** Contact blob that stays on the landing plane while the object lifts. */
export function GroundingShadow({
  x,
  y,
  z,
  width,
  depth = 70,
  lift = 0,
}: {
  x: number;
  y: number;
  z: number;
  width: number;
  depth?: number;
  lift?: number;
}) {
  const spread = 1 + lift * 0.78;
  const opacity = Math.max(0.08, 0.56 * (1 - lift * 0.68));
  return (
    <WorldNode
      x={x}
      y={y + 1}
      z={z}
      w={width * spread}
      h={Math.max(28, depth) * spread}
      rotateX={90}
      style={{ pointerEvents: "none" }}
    >
      <div className="grounding-blob" style={{ opacity }} />
    </WorldNode>
  );
}

/** Quiet landing-plane cue while a drag is near a surface. */
export function SurfaceHint({ surface }: { surface: Surface }) {
  const wall = surface.kind === "wall";
  return (
    <WorldNode
      x={surface.origin.x}
      y={surface.origin.y}
      z={surface.origin.z}
      w={surface.size.w}
      h={surface.size.d}
      rotateX={wall ? 0 : 90}
      className="surface-hint"
      style={{ pointerEvents: "none" }}
    />
  );
}
