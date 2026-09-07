"use client";

import { forwardRef } from "react";
import { motion } from "motion/react";
import type { CollectibleTemplate, Member } from "@/domain/types";
import { useSurfaceLight } from "./useSurfaceLight";

/** Real photocards are 55 × 85 mm. Everything sizes off this ratio. */
export const CARD_RATIO = 55 / 85;
export const CARD_HEIGHT = 132;
export const CARD_WIDTH = CARD_HEIGHT * CARD_RATIO;

export interface PhotocardProps {
  template: CollectibleTemplate;
  member?: Member | undefined;
  height?: number;
  /** Renders the reverse: printed back, no foil, no portrait. */
  flipped?: boolean;
  /** Empty slot styling for cards the collector doesn't own yet. */
  ghost?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A photocard.
 *
 * The most important object in the product, so it gets the most attention:
 * real cardstock edges, a printed back, and — for foil cards — the holographic
 * material whose hue sweeps with pointer position. Rarity is expressed through
 * *material* rather than a badge, which is how it works in life: you can tell a
 * chase card across a room because of how it catches light.
 */
export const Photocard = forwardRef<HTMLDivElement, PhotocardProps>(function Photocard(
  { template, member, height = CARD_HEIGHT, flipped = false, ghost = false, className, style },
  forwardedRef,
) {
  const light = useSurfaceLight<HTMLDivElement>();
  const width = height * CARD_RATIO;
  const { colorway, rarity } = template;
  const foil = template.material === "holo-foil";

  if (ghost) {
    return (
      <div
        ref={forwardedRef}
        className={className}
        style={{
          width,
          height,
          borderRadius: 4,
          // A missing card is drawn as an empty sleeve, not as a grey box. The
          // absence should feel like a gap in a collection, not a loading state.
          border: "1px dashed color-mix(in oklab, var(--room-ink) 26%, transparent)",
          background:
            "linear-gradient(160deg, color-mix(in oklab, #000 26%, transparent), transparent 70%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <span
          className="u-stat"
          style={{
            fontSize: 15,
            color: "color-mix(in oklab, var(--room-ink) 40%, transparent)",
          }}
        >
          {template.setIndex ?? "?"}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      ref={mergeRefs(forwardedRef, light.ref)}
      className={className}
      style={{
        width,
        height,
        borderRadius: 4,
        transformStyle: "preserve-3d",
        ...style,
      }}
      onPointerMove={light.onPointerMove}
      onPointerLeave={light.onPointerLeave}
    >
      {/* Front */}
      <div
        className={`world-face ${foil ? "m-holo-foil" : "m-glossy-card"} m-edge-card${
          rarity === "grail" ? " m-grail-halo" : ""
        }`}
        style={{
          ["--base" as string]: colorway.base,
          ["--accent" as string]: member?.color ?? colorway.accent,
          borderRadius: 4,
          overflow: "hidden",
          backfaceVisibility: "hidden",
          transform: flipped ? "rotateY(180deg)" : undefined,
          opacity: flipped ? 0 : 1,
        }}
      >
        <CardArt template={template} member={member} height={height} />
      </div>

      {/* Back: printed card stock with the set number, as they actually are. */}
      {flipped && (
        <div
          className="world-face m-matte-card m-edge-card"
          style={{
            ["--base" as string]: `color-mix(in oklab, ${colorway.base} 70%, #1b1620)`,
            borderRadius: 4,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <div
            className="u-eyebrow"
            style={{ fontSize: 7, color: colorway.ink, opacity: 0.75 }}
          >
            {template.name.split("—")[0]?.trim()}
          </div>
          <div className="u-stat" style={{ fontSize: 20, color: colorway.ink }}>
            {template.setIndex}
            <span style={{ opacity: 0.45, fontSize: 12 }}>/{template.setSize}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
});

/**
 * Generated card art: a portrait crop suggested with layered gradients, plus
 * the printed name plate. Composed from the member's accent color so every
 * card in a set is recognizably different at a glance — which is exactly how
 * you scan a real binder page.
 */
function CardArt({
  template,
  member,
  height,
}: {
  template: CollectibleTemplate;
  member?: Member | undefined;
  height: number;
}) {
  const accent = member?.color ?? template.colorway.accent;
  const label = member?.stageName ?? template.name;
  const pose = template.name.split("—")[1]?.trim();

  return (
    <>
      {/* Backdrop wash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(168deg, color-mix(in oklab, ${accent} 46%, transparent), transparent 62%)`,
        }}
      />
      {/* Figure: shoulders and head silhouette, cropped like a real photocard. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "-14%",
          width: "88%",
          height: "72%",
          marginLeft: "-44%",
          borderRadius: "48% 48% 0 0",
          background: `linear-gradient(180deg, color-mix(in oklab, ${accent} 80%, #fff 12%), color-mix(in oklab, ${accent} 42%, #000))`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "14%",
          width: "42%",
          height: "34%",
          marginLeft: "-21%",
          borderRadius: "50% 50% 44% 44%",
          background: `linear-gradient(170deg, color-mix(in oklab, ${accent} 92%, #fff 22%), color-mix(in oklab, ${accent} 55%, #000))`,
        }}
      />
      {/* Name plate */}
      <div
        style={{
          position: "absolute",
          left: 5,
          right: 5,
          bottom: 5,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: Math.max(9, height * 0.085),
            lineHeight: 1,
            color: "#fff",
            textShadow: "0 1px 4px rgba(0,0,0,0.7)",
          }}
        >
          {label}
        </div>
        {pose && height > 90 && (
          <div
            className="u-eyebrow"
            style={{
              fontSize: Math.max(5.5, height * 0.042),
              color: "#fff",
              opacity: 0.72,
              marginTop: 2,
            }}
          >
            {pose}
          </div>
        )}
      </div>
    </>
  );
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref && typeof ref === "object") (ref as React.RefObject<T | null>).current = value;
    }
  };
}
