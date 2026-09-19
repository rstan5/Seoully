"use client";

import type { CollectibleTemplate, Member } from "@/domain/types";
import { CARD_RATIO, Photocard } from "@/world/objects/Photocard";

/**
 * A collectible, drawn as the kind of object it is.
 *
 * Rendering every item as a photocard was the quicker option and it was
 * immediately wrong: a photobook came out as a photocard of a photobook. The
 * product's claim is that these are objects, and that claim is either true
 * everywhere it appears or it isn't true.
 */
export function ObjectTile({
  template,
  member,
  title,
  height = 86,
  ghost = false,
}: {
  template: CollectibleTemplate;
  member?: Member | undefined;
  title?: string | undefined;
  height?: number;
  ghost?: boolean;
}) {
  if (template.imageUrl) {
    const square = template.kind === "album" || template.kind === "vinyl";
    const w = square ? height * 0.86 : height * CARD_RATIO;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={template.imageUrl}
        alt={title ?? template.name}
        width={w}
        height={height}
        style={{
          width: w,
          height,
          objectFit: "cover",
          borderRadius: 4,
          opacity: ghost ? 0.42 : 1,
        }}
      />
    );
  }
  if (template.kind === "photocard") {
    return (
      <Photocard
        template={template}
        {...(member ? { member } : {})}
        height={height}
        ghost={ghost}
        reactive={false}
      />
    );
  }

  const square = template.kind === "album" || template.kind === "vinyl";
  const w = square ? height * 0.86 : height * CARD_RATIO;
  const label = (title ?? template.name).split("—")[0]?.trim();

  return (
    <div
      className="m-photo-print m-edge-card"
      style={{
        ["--base" as string]: template.colorway.base,
        ["--accent" as string]: template.colorway.accent,
        width: w,
        height,
        borderRadius: 2,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        alignItems: "flex-end",
        padding: Math.max(5, height * 0.08),
        opacity: ghost ? 0.42 : 1,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(70% 56% at 32% 24%, color-mix(in oklab, ${template.colorway.accent} 52%, transparent), transparent 72%)`,
        }}
      />
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-display)",
          fontSize: Math.max(9, height * 0.12),
          lineHeight: 1.1,
          color: template.colorway.ink,
        }}
      >
        {label}
      </span>
    </div>
  );
}
