"use client";

import { useCallback, useRef } from "react";

/**
 * Drives the --px / --py custom properties that glossy and holographic
 * materials read, so a surface's specular highlight tracks the pointer.
 *
 * Writes straight to the element's inline style rather than going through
 * React state. A holo card updates on every pointermove; routing that through
 * a render would cost a reconciliation per frame per hovered object, and with
 * a binder page of twelve cards it would visibly stutter.
 */
export function useSurfaceLight<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const frame = useRef(0);

  const onPointerMove = useCallback((event: React.PointerEvent<T>) => {
    const node = ref.current;
    if (!node) return;
    // Coalesce to one write per frame; pointermove can fire far faster.
    if (frame.current) return;
    const { clientX, clientY } = event;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      node.style.setProperty("--px", ((clientX - rect.left) / rect.width).toFixed(3));
      node.style.setProperty("--py", ((clientY - rect.top) / rect.height).toFixed(3));
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    if (frame.current) {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    // Return to the room's key light rather than snapping to center, so
    // leaving a card looks like the highlight settling back, not resetting.
    node.style.setProperty("--px", "0.32");
    node.style.setProperty("--py", "0.22");
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}
