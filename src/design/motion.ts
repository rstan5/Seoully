import type { Transition } from "motion/react";

/**
 * Seoully motion system.
 *
 * Rule of the codebase: no component writes an inline duration or spring.
 * Everything comes from here.
 *
 * The organizing idea is that **mass is a design token**. A photocard and a
 * vinyl record must not move the same way, and enforcing that through shared
 * presets is what keeps "physicality" from decaying into a vibe that each
 * component re-invents slightly differently.
 *
 * Springs are used for anything representing a physical object. Eases are used
 * only for non-diegetic UI chrome (overlays, text, cursors) — things that
 * aren't pretending to exist in the room.
 */

// ---------------------------------------------------------------------------
// Object mass → spring
// ---------------------------------------------------------------------------

/**
 * Implied physical mass of each object class. Higher mass means slower
 * acceleration and a longer settle. These numbers were tuned by feel against
 * the real objects: a photocard is 2g of laminated cardstock, an album is a
 * few hundred grams, a vinyl box set is genuinely heavy.
 */
export const MASS = {
  photocard: 0.6,
  poster: 0.8,
  book: 1.1,
  album: 1.4,
  plushie: 1.0,
  figure: 1.6,
  lightstick: 1.2,
  vinyl: 2.2,
  binder: 2.6,
  furniture: 4,
} as const;

export type MassKind = keyof typeof MASS;

/**
 * Spring for a physical object of a given class.
 *
 * `damping` scales sub-linearly with mass so heavier things stay critically
 * damped rather than becoming sluggish — a heavy object should feel *deliberate*,
 * not underwater.
 */
export function objectSpring(kind: MassKind, overrides?: Partial<Transition>): Transition {
  const mass = MASS[kind];
  return {
    type: "spring",
    mass,
    stiffness: 220 / Math.sqrt(mass),
    damping: 26 * Math.pow(mass, 0.35),
    restDelta: 0.001,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Named presets
// ---------------------------------------------------------------------------

export const spring = {
  /** Default resting motion for an object returning to place. */
  settle: {
    type: "spring",
    mass: 1,
    stiffness: 210,
    damping: 26,
    restDelta: 0.001,
  },

  /** Fast, crisp, minimal overshoot. Hover responses, small nudges. */
  snap: {
    type: "spring",
    mass: 0.5,
    stiffness: 460,
    damping: 34,
    restDelta: 0.001,
  },

  /** Loose and buoyant. Objects lifting, hovering, being carried. */
  float: {
    type: "spring",
    mass: 0.8,
    stiffness: 140,
    damping: 18,
    restDelta: 0.001,
  },

  /** Substantial objects with real inertia. */
  heavy: {
    type: "spring",
    mass: 2.4,
    stiffness: 150,
    damping: 34,
    restDelta: 0.001,
  },

  /** A binder page rotating on its spine. Slight overshoot as it flops down. */
  pageturn: {
    type: "spring",
    mass: 1.6,
    stiffness: 120,
    damping: 20,
    restDelta: 0.001,
  },

  /** Camera moves. Cinematic, no visible bounce — bounce reads as nausea. */
  camera: {
    type: "spring",
    mass: 1.1,
    stiffness: 88,
    damping: 24,
    restDelta: 0.0005,
  },

  /** Long cinematic traversal, e.g. entering another collector's room. */
  traverse: {
    type: "spring",
    mass: 1.6,
    stiffness: 54,
    damping: 22,
    restDelta: 0.0005,
  },
} satisfies Record<string, Transition>;

/** Non-diegetic UI only. Anything that isn't pretending to be a physical object. */
export const ease = {
  ui: { duration: 0.24, ease: [0.32, 0.72, 0.24, 1] },
  uiSlow: { duration: 0.42, ease: [0.32, 0.72, 0.24, 1] },
  text: { duration: 0.55, ease: [0.22, 0.61, 0.36, 1] },
  /** Light and atmosphere shifts — these should never feel mechanical. */
  ambient: { duration: 1.6, ease: [0.4, 0, 0.2, 1] },
  /** The arrival sequence's light bloom. */
  dawn: { duration: 2.6, ease: [0.16, 0.84, 0.3, 1] },
} satisfies Record<string, Transition>;

// ---------------------------------------------------------------------------
// Flight paths
// ---------------------------------------------------------------------------

/**
 * Duration for an object flying across the room, scaled by distance so that a
 * short hop and a cross-room throw both read as the same physical speed.
 */
export function flightDuration(
  distancePx: number,
  kind: MassKind = "photocard",
  pacing: number = pace.physical,
): number {
  const speed = 1400 / Math.sqrt(MASS[kind]); // px/sec
  return clamp((distancePx / speed) * pacing, 0.55, 3.2);
}

/**
 * Pacing multipliers for flights that are narrative beats rather than just
 * objects moving.
 *
 * Honest physics puts a tossed photocard across the room in about half a
 * second, which is correct and useless: the single most important animation in
 * the product would be over before it registered. `hero` slows it to the speed
 * of a thing being *placed*, which is also what it is.
 */
export const pace = {
  physical: 1,
  hero: 2.4,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// ---------------------------------------------------------------------------
// Stagger
// ---------------------------------------------------------------------------

/**
 * Neighbors reacting to a disturbance. Objects nearer the disturbance move
 * first and further — this is what sells cause-and-effect on the shelf.
 */
export function neighborResponse(distanceFromSource: number): {
  delay: number;
  falloff: number;
} {
  const falloff = Math.max(0, 1 - Math.abs(distanceFromSource) / 3.2);
  return { delay: Math.abs(distanceFromSource) * 0.028, falloff };
}

// ---------------------------------------------------------------------------
// Reduced motion
// ---------------------------------------------------------------------------

export type MotionProfile = "full" | "reduced";

/**
 * Degrades a transition for users who prefer reduced motion. We deliberately
 * keep a short cross-fade rather than removing motion entirely: instant state
 * swaps in a spatial interface are more disorienting than a gentle dissolve.
 */
export function forProfile(transition: Transition, profile: MotionProfile): Transition {
  if (profile === "full") return transition;
  return { duration: 0.2, ease: [0.4, 0, 0.2, 1] };
}
