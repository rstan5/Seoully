"use client";

import { SeoullyHeartMark } from "@/world/ui/onboard/SeoullyHeartMark";

/**
 * Welcome-screen mascot. Bounce is a layout `top` animation, not a
 * transform, so the transparent PNG is not flattened onto a white square.
 */
export function SeoullyHeart() {
  return (
    <div className="onboard-mascot">
      <div className="onboard-mascot-stage">
        <div className="onboard-mascot-float">
          <SeoullyHeartMark className="onboard-mascot-art" alt="Seoully" />
        </div>
        <div className="onboard-mascot-shadow" aria-hidden="true" />
      </div>
    </div>
  );
}
