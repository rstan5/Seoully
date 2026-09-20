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
  /** Pointer-driven foil. Off when the card is distant or in a static strip. */
  reactive?: boolean;
  /** Held up to the light — stronger specular, slightly thicker edge. */
  examining?: boolean;
  imageUrl?: string;
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
  { template, member, height = CARD_HEIGHT, flipped = false, ghost = false, className, style, reactive = true, examining = false, imageUrl },
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
          border: "1px dashed color-mix(in oklab, #5a4a38 40%, transparent)",
          background:
            "linear-gradient(160deg, color-mix(in oklab, #2b2118 16%, transparent), transparent 72%)",
          boxShadow: "inset 0 2px 7px color-mix(in oklab, #2b2118 22%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...style,
        }}
      >
        <span
          className="u-stat"
          style={{
            fontSize: height * 0.16,
            color: "color-mix(in oklab, #5a4a38 46%, transparent)",
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
      onPointerMove={reactive ? light.onPointerMove : undefined}
      onPointerLeave={reactive ? light.onPointerLeave : undefined}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: examining ? 4 : 2.5,
          height,
          transformOrigin: "100% 50%",
          transform: "rotateY(-90deg)",
          background: "linear-gradient(180deg, #f3ead8, #c8b89a 48%, #8a7a62)",
          borderRadius: 1,
        }}
      />
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
        <CardArt template={template} member={member} height={height} imageUrl={imageUrl} />
        {examining && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `linear-gradient(
                calc(var(--lit-angle, 145deg)),
                color-mix(in oklab, #fff 28%, transparent),
                transparent 36%,
                transparent 62%,
                color-mix(in oklab, var(--lit-color, #fff) 10%, transparent)
              )`,
              mixBlendMode: "soft-light",
            }}
          />
        )}
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
  imageUrl,
}: {
  template: CollectibleTemplate;
  member?: Member | undefined;
  height: number;
  imageUrl?: string;
}) {
  const accent = member?.color ?? template.colorway.accent;
  const label = member?.stageName ?? template.name;
  const pose = template.name.split("—")[1]?.trim();
  // Deterministic per-card framing, so a page of cards doesn't read as one
  // portrait stamped six times. Real sets vary the crop card to card.
  const seed = hashString(template.id);
  const shift = ((seed % 100) / 100 - 0.5) * 16; // horizontal crop offset, %
  const scale = 1 + ((seed >> 7) % 100) / 100 * 0.22;
  const warm = (seed >> 13) % 2 === 0;

  return (
    <>
      {imageUrl && <img src={imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
      {imageUrl && <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 60%, color-mix(in oklab, #000 42%, transparent))" }} />}
      {/* Studio backdrop: a lit sweep behind the figure, darker at the edges,
          which is what makes the crop read as a photograph rather than as a
          shape on a colored rectangle. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(76% 58% at ${50 + shift}% 24%,
              color-mix(in oklab, ${accent} 42%, #fff 46%),
              color-mix(in oklab, ${accent} 44%, #201826) 74%),
            linear-gradient(${warm ? 168 : 196}deg,
              transparent,
              color-mix(in oklab, #0d0a12 34%, transparent) 92%)`,
        }}
      />

      {/* Figure. Shoulders, neck and head, cropped tight and off-centre the
          way a photocard crop actually sits. */}
      <div
        style={{
          position: "absolute",
          left: `${50 + shift}%`,
          bottom: "-16%",
          width: `${74 * scale}%`,
          height: `${68 * scale}%`,
          marginLeft: `${(-74 * scale) / 2}%`,
          borderRadius: "44% 44% 0 0",
          background: `linear-gradient(174deg,
            color-mix(in oklab, ${accent} 88%, #fff 6%),
            color-mix(in oklab, ${accent} 52%, #140f1a))`,
          boxShadow: `inset ${warm ? "" : "-"}6px 4px 12px color-mix(in oklab, #000 34%, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: `${50 + shift * 1.4}%`,
          top: `${13 + (seed % 5)}%`,
          width: `${34 * scale}%`,
          height: `${31 * scale}%`,
          marginLeft: `${(-34 * scale) / 2}%`,
          borderRadius: "50% 50% 46% 46%",
          background: `linear-gradient(${warm ? 156 : 204}deg,
            color-mix(in oklab, ${accent} 62%, #fff 44%),
            color-mix(in oklab, ${accent} 72%, #171020))`,
        }}
      />
      {/* Rim light down one side of the figure. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(${warm ? 100 : 260}deg,
            color-mix(in oklab, #fff 26%, transparent),
            transparent 34%)`,
          mixBlendMode: "soft-light",
        }}
      />

      {/* Scrim so the name plate has something to sit on. */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: "38%",
          background: "linear-gradient(0deg, rgba(8,6,12,0.66), transparent)",
        }}
      />

      <div style={{ position: "absolute", left: "7%", right: "7%", bottom: "5%" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: height * 0.12,
            lineHeight: 1,
            color: "#fff",
            letterSpacing: "0.005em",
            textShadow: "0 1px 5px rgba(0,0,0,0.6)",
          }}
        >
          {label}
        </div>
        {pose && (
          <div
            className="u-eyebrow"
            style={{
              fontSize: height * 0.055,
              color: "#fff",
              opacity: 0.6,
              marginTop: height * 0.022,
            }}
          >
            {pose}
          </div>
        )}
      </div>

      {/* Set number, printed small in the corner as they are in real sets. */}
      {template.setIndex && (
        <div
          className="u-stat"
          style={{
            position: "absolute",
            right: "7%",
            top: "5%",
            fontSize: height * 0.06,
            color: "#fff",
            opacity: 0.5,
          }}
        >
          {String(template.setIndex).padStart(2, "0")}
        </div>
      )}
    </>
  );
}

/** Stable per-template seed, so generated framing never changes between renders. */
function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 1_000_000;
}

function mergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return (value: T) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(value);
      else if (ref && typeof ref === "object") (ref as React.RefObject<T | null>).current = value;
    }
  };
}
