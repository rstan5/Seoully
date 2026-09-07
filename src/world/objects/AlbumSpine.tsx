"use client";

import { motion } from "motion/react";
import type { HoldingView } from "@/domain/types";
import { objectSpring } from "@/design/motion";

export const ALBUM_HEIGHT = 176;
export const ALBUM_DEPTH = 150;
/**
 * World px per physical mm. Keeps relative thickness honest between formats —
 * a 22mm photobook album genuinely is nearly twice a 12mm single, and the
 * shelf reads as a real collection because of it.
 */
export const MM = 1.9;

export function spineWidth(view: HoldingView): number {
  return Math.max(18, (view.version?.thicknessMm ?? 16) * MM);
}

interface AlbumSpineProps {
  view: HoldingView;
  /** Horizontal position of the album's left edge within the shelf row. */
  offsetX: number;
  /** Lean angle in degrees, for albums at the end of a run. */
  lean?: number;
  hovered: boolean;
  dimmed: boolean;
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
  interactive: boolean;
  /** Only the last album in a run needs its side face; the rest are occluded. */
  showSide?: boolean;
}

/**
 * An album standing spine-out on a shelf.
 *
 * Built as real geometry — spine face plus a top face folded back into the
 * shelf — rather than a rectangle with a drop shadow. The top face is what
 * makes it read as an object with depth when the camera parallaxes: you
 * actually see the top of the case, and it occludes its neighbors correctly.
 */
export function AlbumSpine({
  view,
  offsetX,
  lean = 0,
  hovered,
  dimmed,
  onHover,
  onSelect,
  interactive,
  showSide = false,
}: AlbumSpineProps) {
  const width = spineWidth(view);
  const { version, template } = view;
  const spineColor = version?.spineColor ?? template.colorway.base;
  const accent = version?.coverAccent ?? template.colorway.accent;
  const isVinyl = template.kind === "vinyl";

  const height = isVinyl ? ALBUM_HEIGHT + 34 : ALBUM_HEIGHT;
  const depth = isVinyl ? ALBUM_DEPTH + 40 : ALBUM_DEPTH;

  return (
    <motion.div
      className="zone-hotspot"
      style={{
        position: "absolute",
        left: offsetX,
        bottom: 0,
        width,
        height,
        transformStyle: "preserve-3d",
        transformOrigin: "50% 100%",
        // Lean is applied as a base rotation the hover animation composes with.
        rotate: lean,
      }}
      animate={{
        // Hovered albums ease *out* of the shelf toward the viewer, and rise a
        // little as though lifted over the lip of the board.
        z: hovered ? 46 : 0,
        y: hovered ? -10 : 0,
        rotateY: hovered ? -7 : 0,
        opacity: dimmed ? 0.55 : 1,
      }}
      transition={objectSpring(isVinyl ? "vinyl" : "album")}
      onHoverStart={interactive ? () => onHover(true) : undefined}
      onHoverEnd={interactive ? () => onHover(false) : undefined}
      onClick={interactive ? onSelect : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : -1}
      aria-label={interactive ? `${view.template.name}. Pull from shelf.` : undefined}
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
      {/* Spine face */}
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
        {/* Title runs bottom-to-top along the spine, the way it does in life. */}
        <span
          style={{
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontFamily: "var(--font-sans)",
            fontSize: width > 20 ? 10 : 8.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            fontWeight: 600,
            color: accent,
            whiteSpace: "nowrap",
            opacity: 0.92,
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {view.release?.title ?? view.template.name}
        </span>

        {/* Foil band near the base — the detail that makes spines look printed
            rather than filled. */}
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

      {/* Top face, folded back into the shelf. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: depth,
          transformOrigin: "50% 0%",
          transform: "rotateX(-90deg)",
          background: `linear-gradient(180deg, color-mix(in oklab, ${spineColor} 82%, #fff 10%), color-mix(in oklab, ${spineColor} 60%, #000))`,
          boxShadow: "inset 0 0 12px rgba(0,0,0,0.5)",
        }}
      />

      {/* Right face, so the album at the end of a run doesn't look like paper.
          Rendered only when nothing is standing next to it to hide it. */}
      {(showSide || hovered) && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: depth,
            height,
            transformOrigin: "100% 50%",
            transform: "rotateY(90deg)",
            background: `linear-gradient(90deg, color-mix(in oklab, ${spineColor} 40%, #000), color-mix(in oklab, ${spineColor} 66%, #000))`,
          }}
        />
      )}
    </motion.div>
  );
}
