"use client";

import { useMemo } from "react";

/**
 * Everything that makes the room feel like air rather than a picture.
 *
 * All of it lives *outside* the preserve-3d chain by design: these layers use
 * blur, opacity, and blend modes, any one of which would flatten the 3D
 * context and collapse the scene if applied inside it.
 */
export function Atmosphere({
  dust = 26,
  mood = "night",
}: {
  dust?: number;
  mood?: "night" | "day";
}) {
  return (
    <>
      <div className={`atmo atmo-lightshaft${mood === "day" ? " is-day" : ""}`} />
      <DustField count={dust} />
      <div className="atmo atmo-grade" />
      <div className={`atmo atmo-vignette${mood === "day" ? " is-day" : ""}`} />
      <div className={`atmo atmo-grain${mood === "day" ? " is-day" : ""}`} />
    </>
  );
}

/**
 * Motes drifting through the light.
 *
 * Pure CSS animation with per-mote randomized parameters — no React renders, no
 * requestAnimationFrame, no canvas. This is the highest ratio of "the room is
 * alive" to cost anywhere in the product, which is why it's here in the first
 * pass rather than saved as polish.
 */
function DustField({ count }: { count: number }) {
  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        // Integer-only PRNG, seeded per mote. Deterministic so the field
        // doesn't reshuffle between renders, and — importantly — bit-identical
        // between Node and the browser. A Math.sin-based hash is not: the two
        // engines' implementations differ in the last few ulps, which is
        // enough to trip React's hydration check on every single mote.
        const r = (n: number) => mulberry32(i * 2654435761 + n * 40503);
        const size = round(1 + r(1) * 2.6);
        return {
          id: i,
          left: `${round(r(2) * 100)}%`,
          top: `${round(r(3) * 100)}%`,
          size,
          dx: `${round((r(4) - 0.5) * 220)}px`,
          dy: `${round(-60 - r(5) * 200)}px`,
          duration: `${round(14 + r(6) * 22)}s`,
          delay: `${round(-r(7) * 30)}s`,
          // Smaller motes are further away, so they're dimmer.
          peak: round((0.16 + r(8) * 0.4) * (size / 3.6)),
        };
      }),
    [count],
  );

  return (
    <div className="atmo" aria-hidden>
      {motes.map((mote) => (
        <span
          key={mote.id}
          className="dust-mote"
          style={{
            left: mote.left,
            top: mote.top,
            width: mote.size,
            height: mote.size,
            ["--dx" as string]: mote.dx,
            ["--dy" as string]: mote.dy,
            ["--dur" as string]: mote.duration,
            ["--delay" as string]: mote.delay,
            ["--peak" as string]: mote.peak,
          }}
        />
      ))}
    </div>
  );
}

/** Integer-hash PRNG. Identical output in every JS engine. */
function mulberry32(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Trims float noise out of serialized style values. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
