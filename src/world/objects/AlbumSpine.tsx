"use client";

import { motion } from "motion/react";
import type { HoldingView } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import { useSurfaceLight } from "./useSurfaceLight";

export const ALBUM_HEIGHT = 176;
export const ALBUM_DEPTH = 150;
/**
 * World px per physical mm. Keeps relative thickness honest between formats —
 * a 22mm photobook album genuinely is nearly twice a 12mm single, and the shelf
 * reads as a real collection because of it.
 */
export const MM = 1.9;

export function spineWidth(view: HoldingView): number {
  return Math.max(18, (view.version?.thicknessMm ?? 16) * MM);
}

/** Lift and swing-out applied while an album is being examined. */
const LIFT_Y = -70;
const LIFT_Z = 300;

/**
 * Where the album's cover ends up relative to where the album was shelved.
 *
 * Only the lift matters to a caller: turning the album 90° about its own base
 * swings the cover half a depth sideways, and the object cancels that out with
 * an equal counter-translation (see below), so the cover lands centred on the
 * gap the album left. The camera consumes this so that "frame the thing I
 * picked up" means where it came to rest rather than where it used to be.
 */
export const ALBUM_INSPECT_LIFT = { x: 0, y: LIFT_Y, z: LIFT_Z };

interface AlbumSpineProps {
  view: HoldingView;
  offsetX: number;
  lean?: number;
  hovered: boolean;
  /** This album is the one currently being inspected. */
  inspecting: boolean;
  /** Another album is being inspected, so this one should get out of the way. */
  displaced: number;
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
  interactive: boolean;
  showSide?: boolean;
}

/**
 * An album standing spine-out on a shelf.
 *
 * Modeled as an actual box: the spine faces the viewer, and the *cover* is the
 * broad face pointing sideways into its neighbor — which is how albums sit on a
 * real shelf. That geometry is what makes inspection work without any sleight
 * of hand: pulling the album forward and rotating it 90° reveals a cover that
 * was physically there the whole time, rather than swapping in a different
 * element.
 */
export function AlbumSpine({
  view,
  offsetX,
  lean = 0,
  hovered,
  inspecting,
  displaced,
  onHover,
  onSelect,
  interactive,
  showSide = false,
}: AlbumSpineProps) {
  const light = useSurfaceLight<HTMLDivElement>();
  const width = spineWidth(view);
  const { version, template } = view;
  const spineColor = version?.spineColor ?? template.colorway.base;
  const coverColor = version?.coverColor ?? template.colorway.base;
  const accent = version?.coverAccent ?? template.colorway.accent;
  const isVinyl = template.kind === "vinyl";

  const height = isVinyl ? ALBUM_HEIGHT + 34 : ALBUM_HEIGHT;
  const depth = isVinyl ? ALBUM_DEPTH + 40 : ALBUM_DEPTH;

  return (
    <motion.div
      ref={light.ref}
      className="zone-hotspot"
      style={{
        position: "absolute",
        left: offsetX,
        bottom: 0,
        width,
        height,
        transformStyle: "preserve-3d",
        transformOrigin: "50% 100%",
      }}
      animate={
        inspecting
          ? {
              // Out of the shelf, turned to present the cover, lifted to eye
              // level. The pivot stays at the album's base so it reads as being
              // drawn out and tipped up, not teleported.
              //
              // The depth-wide translation cancels the sideways swing that
              // turning about the base produces, so the cover finishes centred
              // over the slot it came out of instead of drifting a hand's width
              // to one side of it.
              x: depth,
              y: ALBUM_INSPECT_LIFT.y,
              z: ALBUM_INSPECT_LIFT.z,
              rotateY: -90,
              rotate: 0,
              opacity: 1,
            }
          : {
              x: displaced,
              y: hovered ? -12 : 0,
              z: hovered ? 52 : 0,
              rotateY: hovered ? -8 : 0,
              rotate: lean,
              opacity: 1,
            }
      }
      transition={objectSpring(isVinyl ? "vinyl" : "album")}
      onPointerMove={light.onPointerMove}
      onPointerLeave={() => {
        light.onPointerLeave();
        onHover(false);
      }}
      onPointerEnter={interactive ? () => onHover(true) : undefined}
      onClick={interactive ? onSelect : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={
        interactive
          ? `${view.release?.title ?? template.name}, ${version?.name ?? ""}. Pull from shelf.`
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
    >
      {/* --- Spine (faces the viewer when shelved) ------------------------ */}
      <div
        className={isVinyl ? "world-face m-vinyl" : "world-face m-matte-card"}
        style={{
          ["--base" as string]: spineColor,
          ["--accent" as string]: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontFamily: "var(--font-sans)",
            fontSize: width > 30 ? 10 : 8.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: accent,
            whiteSpace: "nowrap",
            opacity: 0.92,
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {view.release?.title ?? template.name}
        </span>
        <div
          style={{
            position: "absolute",
            left: 2,
            right: 2,
            bottom: 10,
            height: 2,
            background: accent,
            opacity: 0.75,
          }}
        />
      </div>

      {/* --- Cover: the broad face, pointing sideways into the neighbor --- */}
      <div
        className="m-photo-print"
        style={{
          ["--base" as string]: coverColor,
          ["--accent" as string]: accent,
          position: "absolute",
          top: 0,
          right: 0,
          width: depth,
          height,
          transformOrigin: "100% 50%",
          transform: "rotateY(90deg)",
          overflow: "hidden",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, #fff 10%, transparent)",
        }}
      >
        <CoverArt
          title={view.release?.title ?? template.name}
          edition={version?.name ?? ""}
          group={view.group.name}
          accent={accent}
          visible={inspecting || hovered || showSide}
        />
      </div>

      {/* --- Top edge, folded back into the shelf ------------------------- */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: depth,
          transformOrigin: "50% 0%",
          transform: "rotateX(90deg)",
          background: `linear-gradient(180deg, color-mix(in oklab, ${spineColor} 82%, #fff 10%), color-mix(in oklab, ${spineColor} 60%, #000))`,
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.5)",
        }}
      />
    </motion.div>
  );
}

/**
 * Generated cover art.
 *
 * The heavy layers only paint when the cover can actually be seen. A shelf of
 * twenty albums each compositing four gradients on a face that's edge-on to the
 * camera is pure waste, and it's the first thing that costs frames.
 */
function CoverArt({
  title,
  edition,
  group,
  accent,
  visible,
}: {
  title: string;
  edition: string;
  group: string;
  accent: string;
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(74% 58% at 34% 22%, color-mix(in oklab, ${accent} 42%, transparent), transparent 74%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "22%",
          top: "16%",
          width: "56%",
          height: "58%",
          borderRadius: "46% 46% 34% 34%",
          background: `linear-gradient(172deg, color-mix(in oklab, ${accent} 58%, transparent), transparent 76%)`,
        }}
      />
      <div style={{ position: "absolute", left: 16, right: 16, bottom: 18 }}>
        <div className="u-eyebrow" style={{ fontSize: 7.5, color: accent, opacity: 0.9 }}>
          {group}
        </div>
        <div
          className="u-display"
          style={{
            fontSize: 26,
            marginTop: 5,
            color: "#fff",
            textShadow: "0 2px 8px rgba(0,0,0,0.55)",
          }}
        >
          {title}
        </div>
        <div
          className="u-eyebrow"
          style={{ fontSize: 7, marginTop: 5, color: "#fff", opacity: 0.62 }}
        >
          {edition}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 16,
          width: 24,
          height: 2,
          background: accent,
        }}
      />
    </>
  );
}
