"use client";

import { motion } from "motion/react";
import type { HoldingView } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import { grabHandlers, mergeArrange, type ArrangeTarget } from "@/world/edit/arrange";
import { useSurfaceLight } from "./useSurfaceLight";

interface ShelfObjectProps {
  view: HoldingView;
  offsetX: number;
  height: number;
  hovered: boolean;
  interactive: boolean;
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
  arrange?: ArrangeTarget;
}

/**
 * A record standing face-out, propped against the back of the bay.
 *
 * Records get displayed cover-forward because that's what people do with the
 * ones they care about — filing a vinyl spine-out like a CD is the tell of
 * someone who doesn't own any.
 */
export function FaceOutRecord({
  view,
  offsetX,
  height,
  hovered,
  interactive,
  onHover,
  onSelect,
  arrange,
}: ShelfObjectProps) {
  const light = useSurfaceLight<HTMLDivElement>();
  const size = Math.min(height, 190);
  const { template, version } = view;
  const cover = version?.coverColor ?? template.colorway.base;
  const accent = version?.coverAccent ?? template.colorway.accent;
  const grab = grabHandlers(arrange, interactive, onSelect);

  return (
    <motion.div
      ref={light.ref}
      className={`zone-hotspot${arrange?.editing ? " editing-grab" : ""}`}
      style={{
        position: "absolute",
        left: offsetX,
        bottom: 0,
        width: size,
        height: size,
        transformStyle: "preserve-3d",
        transformOrigin: "50% 100%",
        touchAction: arrange?.editing ? "none" : undefined,
      }}
      animate={mergeArrange(
        { rotateX: hovered ? -4 : -9, z: hovered ? 30 : 0, y: hovered ? -6 : 0 } as {
          x?: number;
          y?: number;
          z?: number;
          rotate?: number;
          scale?: number;
          rotateX?: number;
        },
        arrange,
      )}
      transition={objectSpring("vinyl")}
      onPointerMove={light.onPointerMove}
      onPointerLeave={() => {
        light.onPointerLeave();
        onHover(false);
      }}
      onPointerEnter={interactive || arrange?.editing ? () => onHover(true) : undefined}
      onPointerDown={grab.onPointerDown}
      onClick={grab.onClick}
      role={grab.role}
      tabIndex={grab.tabIndex}
      aria-label={
        arrange?.editing
          ? `${template.name}. Move.`
          : interactive
            ? `${template.name}. Inspect.`
            : undefined
      }
    >
      {/* The record itself, peeking out of the top of the sleeve. */}
      <div
        className="m-vinyl"
        style={{
          position: "absolute",
          left: "8%",
          top: -10,
          width: "84%",
          height: size,
          borderRadius: "50%",
          transform: "translateZ(-4px)",
        }}
      />
      {/* Sleeve */}
      <div
        className="world-face m-photo-print"
        style={{
          ["--base" as string]: cover,
          ["--accent" as string]: accent,
          boxShadow:
            "inset 0 0 0 1px color-mix(in oklab, #fff 14%, transparent), 6px 8px 18px color-mix(in oklab, #000 50%, transparent)",
          overflow: "hidden",
        }}
      >
        <SleeveArt title={view.release?.title ?? template.name} accent={accent} />
      </div>
    </motion.div>
  );
}

/**
 * Generated cover art.
 *
 * Every collectible's artwork is composed from its colorway rather than loaded
 * as an image. That keeps the prototype free of licensed material, keeps the
 * page weight near zero, and means a new release in the catalog renders
 * plausibly the moment it's added.
 */
function SleeveArt({ title, accent }: { title: string; accent: string }) {
  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(70% 60% at 30% 24%, color-mix(in oklab, ${accent} 40%, transparent), transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "10%",
          bottom: "12%",
          right: "10%",
          fontFamily: "var(--font-display)",
          fontSize: 20,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: accent,
          textShadow: "0 2px 6px rgba(0,0,0,0.6)",
        }}
      >
        {title}
      </div>
      <div
        style={{
          position: "absolute",
          left: "10%",
          top: "12%",
          width: 26,
          height: 2,
          background: accent,
          opacity: 0.8,
        }}
      />
    </>
  );
}

/** A photobook leaning against the end of a bay. */
export function LeaningBook({
  view,
  offsetX,
  height,
  hovered,
  interactive,
  onHover,
  onSelect,
  arrange,
}: ShelfObjectProps) {
  const { template } = view;
  const width = 104;
  const grab = grabHandlers(arrange, interactive, onSelect);

  return (
    <motion.div
      className={`zone-hotspot${arrange?.editing ? " editing-grab" : ""}`}
      style={{
        position: "absolute",
        left: offsetX,
        bottom: 0,
        width,
        height,
        transformStyle: "preserve-3d",
        transformOrigin: "100% 100%",
        touchAction: arrange?.editing ? "none" : undefined,
      }}
      animate={mergeArrange({ rotate: hovered ? -14 : -11, z: hovered ? 24 : 0 }, arrange)}
      transition={objectSpring("book")}
      onHoverStart={interactive || arrange?.editing ? () => onHover(true) : undefined}
      onHoverEnd={interactive || arrange?.editing ? () => onHover(false) : undefined}
      onPointerDown={grab.onPointerDown}
      onClick={grab.onClick}
      role={grab.role}
      tabIndex={grab.tabIndex}
      aria-label={
        arrange?.editing
          ? `${template.name}. Move.`
          : interactive
            ? `${template.name}. Inspect.`
            : undefined
      }
    >
      <div
        className="world-face m-paper"
        style={{
          ["--base" as string]: template.colorway.base,
          boxShadow:
            "inset -6px 0 12px color-mix(in oklab, #000 34%, transparent), 5px 6px 16px color-mix(in oklab, #000 46%, transparent)",
          overflow: "hidden",
        }}
      >
        {/* Cloth spine band down the binding edge. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 13,
            background: `linear-gradient(90deg, color-mix(in oklab, ${template.colorway.accent} 90%, #000), color-mix(in oklab, ${template.colorway.accent} 55%, #000))`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 26,
            right: 12,
            top: 20,
            fontFamily: "var(--font-display)",
            fontSize: 13,
            lineHeight: 1.05,
            color: template.colorway.ink,
            opacity: 0.9,
          }}
        >
          {template.name}
        </div>
      </div>
      {/* Page block along the fore edge. */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          width: 24,
          height,
          transformOrigin: "100% 50%",
          transform: "rotateY(90deg)",
          background:
            "repeating-linear-gradient(90deg, #d9cfbc 0px, #efe6d6 1.5px, #cabfa9 3px)",
        }}
      />
    </motion.div>
  );
}
