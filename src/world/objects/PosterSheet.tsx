"use client";

import { motion } from "motion/react";
import type { HoldingView } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import { useSurfaceLight } from "./useSurfaceLight";

interface PosterSheetProps {
  view: HoldingView;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Small rotation, because nothing on a real wall is perfectly straight. */
  tilt: number;
  mount: "tape" | "pins" | "frame";
  hovered: boolean;
  interactive: boolean;
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
}

/**
 * A print on the wall.
 *
 * Posters lift from their bottom edge on hover — paper taped at the top curls
 * away from the wall, it doesn't slide around. Getting that one axis right is
 * the difference between "poster" and "rectangle with a hover state".
 */
export function PosterSheet({
  view,
  x,
  y,
  w,
  h,
  tilt,
  mount,
  hovered,
  interactive,
  onHover,
  onSelect,
}: PosterSheetProps) {
  const light = useSurfaceLight<HTMLDivElement>();
  const { template, member, era } = view;
  const framed = mount === "frame";

  return (
    <motion.div
      ref={light.ref}
      className="zone-hotspot"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        transformStyle: "preserve-3d",
        // Pinned along the top edge, so that's where it pivots.
        transformOrigin: "50% 0%",
        rotate: tilt,
      }}
      animate={{ rotateX: hovered ? -7 : 0, z: hovered ? 16 : 0 }}
      transition={objectSpring("poster")}
      onPointerMove={light.onPointerMove}
      onPointerLeave={() => {
        light.onPointerLeave();
        onHover(false);
      }}
      onPointerEnter={interactive ? () => onHover(true) : undefined}
      onClick={interactive ? onSelect : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={interactive ? `${template.name}. Inspect.` : undefined}
    >
      {framed && (
        <div
          className="m-brushed-metal"
          style={{
            position: "absolute",
            inset: -11,
            filter: "brightness(0.7)",
            boxShadow: "8px 12px 26px color-mix(in oklab, #000 56%, transparent)",
          }}
        />
      )}

      <div
        className="world-face m-photo-print"
        style={{
          ["--base" as string]: template.colorway.base,
          ["--accent" as string]: template.colorway.accent,
          overflow: "hidden",
          boxShadow: framed
            ? "inset 0 0 24px color-mix(in oklab, #000 40%, transparent)"
            : "6px 10px 24px color-mix(in oklab, #000 52%, transparent)",
        }}
      >
        <PosterArt
          title={template.name}
          subtitle={era?.name ?? member?.stageName ?? view.group.name}
          accent={template.colorway.accent}
          ink={template.colorway.ink}
        />
      </div>

      {mount === "tape" && <>
        <Tape x="14%" rotate={-8} />
        <Tape x="72%" rotate={6} />
      </>}
      {mount === "pins" && <>
        <Pin x="6%" y="4%" />
        <Pin x="90%" y="4%" />
      </>}
    </motion.div>
  );
}

/**
 * Generated poster art. Composed from the collectible's colorway rather than
 * loaded — no licensed imagery, no page weight, and any new catalog entry
 * renders plausibly the moment it exists.
 */
function PosterArt({
  title,
  subtitle,
  accent,
  ink,
}: {
  title: string;
  subtitle: string;
  accent: string;
  ink: string;
}) {
  return (
    <>
      {/* Suggestion of a figure: a soft vertical mass, off-center. */}
      <div
        style={{
          position: "absolute",
          left: "18%",
          top: "8%",
          width: "58%",
          height: "74%",
          borderRadius: "44% 44% 38% 38% / 52% 52% 48% 48%",
          background: `linear-gradient(170deg, color-mix(in oklab, ${accent} 62%, transparent), transparent 78%)`,
          filter: "blur(0.5px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(78% 62% at 62% 26%, color-mix(in oklab, ${accent} 26%, transparent), transparent 72%)`,
        }}
      />
      {/* Editorial type block, bottom-left, the way tour prints are laid out. */}
      <div style={{ position: "absolute", left: "8%", right: "8%", bottom: "7%" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            lineHeight: 0.92,
            letterSpacing: "-0.02em",
            color: ink,
            textShadow: "0 2px 8px rgba(0,0,0,0.55)",
          }}
        >
          {title}
        </div>
        <div
          className="u-eyebrow"
          style={{ marginTop: 6, color: accent, opacity: 0.95, fontSize: 9 }}
        >
          {subtitle}
        </div>
      </div>
    </>
  );
}

function Tape({ x, rotate }: { x: string; rotate: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: -12,
        width: 46,
        height: 24,
        transform: `rotate(${rotate}deg) translateZ(2px)`,
        background:
          "linear-gradient(180deg, color-mix(in oklab, #fff 46%, transparent), color-mix(in oklab, #fff 22%, transparent))",
        boxShadow: "0 2px 6px color-mix(in oklab, #000 34%, transparent)",
        // Washi tape is translucent, so the wall reads through it.
        opacity: 0.72,
      }}
    />
  );
}

function Pin({ x, y }: { x: string; y: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 9,
        height: 9,
        borderRadius: "50%",
        transform: "translateZ(6px)",
        background:
          "radial-gradient(circle at 34% 30%, #fff, color-mix(in oklab, var(--room-light-color) 60%, #888) 60%, #3a3547)",
        boxShadow: "0 3px 5px color-mix(in oklab, #000 60%, transparent)",
      }}
    />
  );
}
