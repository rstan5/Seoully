"use client";

import { useEffect, useState } from "react";

export interface Viewport {
  width: number;
  height: number;
}

/**
 * Viewport size, used to solve camera framing.
 *
 * Seeded with a sensible desktop size rather than zero so the first client
 * render frames the room correctly instead of flashing a collapsed scene.
 */
export function useViewport(): Viewport {
  const [viewport, setViewport] = useState<Viewport>({ width: 1440, height: 900 });

  useEffect(() => {
    const read = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    read();
    window.addEventListener("resize", read, { passive: true });
    return () => window.removeEventListener("resize", read);
  }, []);

  return viewport;
}

/** Respects the OS reduced-motion setting, and reacts if it changes mid-session. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}
