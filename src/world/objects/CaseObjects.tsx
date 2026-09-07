"use client";

import { motion } from "motion/react";
import type { HoldingView } from "@/domain/types";
import { objectSpring } from "@/design/motion";
import { useSurfaceLight } from "./useSurfaceLight";

interface CaseObjectProps {
  view: HoldingView;
  x: number;
  bottom: number;
  size: number;
  hovered: boolean;
  interactive: boolean;
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
}

/**
 * Objects inside a display case.
 *
 * Each shape is built from primitives rather than illustrated, so a collector's
 * case populates automatically from whatever they own. The shared behavior —
 * rise and rotate slightly toward the viewer on hover, cast a contact shadow on
 * the glass shelf — is what makes a mixed shelf of plushies, figures, and a
 * lightstick feel like one collection rather than a sticker sheet.
 */

export function Plushie({ view, x, bottom, size, hovered, interactive, onHover, onSelect }: CaseObjectProps) {
  const { template } = view;
  const w = size;
  const h = size * 1.16;

  return (
    <CaseObjectShell
      x={x}
      bottom={bottom}
      w={w}
      h={h}
      hovered={hovered}
      interactive={interactive}
      label={template.name}
      mass="plushie"
      onHover={onHover}
      onSelect={onSelect}
    >
      {/* Ears */}
      {[0.16, 0.62].map((left, i) => (
        <div
          key={i}
          className="m-plush"
          style={{
            ["--base" as string]: template.colorway.base,
            position: "absolute",
            left: `${left * 100}%`,
            top: -h * 0.16,
            width: w * 0.24,
            height: h * 0.3,
            borderRadius: "50% 50% 40% 40%",
          }}
        />
      ))}
      {/* Body */}
      <div
        className="m-plush"
        style={{
          ["--base" as string]: template.colorway.base,
          position: "absolute",
          inset: 0,
          borderRadius: "46% 46% 42% 42% / 40% 40% 56% 56%",
        }}
      />
      {/* Face: two eyes and a muzzle patch. Minimal on purpose — plushie faces
          are simple, and any more detail starts to look uncanny at this size. */}
      {[0.3, 0.62].map((left, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: `${left * 100}%`,
            top: "36%",
            width: Math.max(3, w * 0.075),
            height: Math.max(4, w * 0.095),
            borderRadius: "50%",
            background: "#241c22",
            opacity: 0.85,
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: "38%",
          top: "52%",
          width: w * 0.24,
          height: h * 0.13,
          borderRadius: "50%",
          background: `color-mix(in oklab, ${template.colorway.accent} 55%, #fff)`,
          opacity: 0.5,
        }}
      />
    </CaseObjectShell>
  );
}

export function Lightstick({ view, x, bottom, size, hovered, interactive, onHover, onSelect }: CaseObjectProps) {
  const { template } = view;
  const w = size * 0.52;
  const h = size * 1.9;
  const bulb = w * 1.5;

  return (
    <CaseObjectShell
      x={x}
      bottom={bottom}
      w={w}
      h={h}
      hovered={hovered}
      interactive={interactive}
      label={template.name}
      mass="lightstick"
      onHover={onHover}
      onSelect={onSelect}
    >
      {/* Handle */}
      <div
        className="m-brushed-metal"
        style={{
          position: "absolute",
          left: "50%",
          marginLeft: -w * 0.28,
          bottom: 0,
          width: w * 0.56,
          height: h * 0.52,
          borderRadius: w * 0.3,
          filter: "brightness(0.62)",
        }}
      />
      {/* Illuminated head. The one genuinely emissive object in the room, so it
          gets a real bloom — a lightstick that isn't lit is just a stick. */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          marginLeft: -bulb / 2,
          top: 0,
          width: bulb,
          height: bulb,
          borderRadius: "50%",
          background: `radial-gradient(circle at 38% 32%, #fff, ${template.colorway.accent} 46%, color-mix(in oklab, ${template.colorway.accent} 60%, #000) 100%)`,
          boxShadow: `0 0 ${bulb * 0.7}px ${template.colorway.accent}, 0 0 ${bulb * 1.6}px color-mix(in oklab, ${template.colorway.accent} 55%, transparent)`,
        }}
      />
    </CaseObjectShell>
  );
}

export function FigureStand({ view, x, bottom, size, hovered, interactive, onHover, onSelect }: CaseObjectProps) {
  const light = useSurfaceLight<HTMLDivElement>();
  const { template } = view;
  const w = size * 0.62;
  const h = size * 1.5;

  return (
    <CaseObjectShell
      x={x}
      bottom={bottom}
      w={w}
      h={h}
      hovered={hovered}
      interactive={interactive}
      label={template.name}
      mass="figure"
      onHover={onHover}
      onSelect={onSelect}
    >
      {/* Base disc */}
      <div
        className="m-acrylic"
        style={{
          position: "absolute",
          left: "50%",
          marginLeft: -w * 0.44,
          bottom: 0,
          width: w * 0.88,
          height: h * 0.07,
          borderRadius: "50%",
        }}
      />
      {/* Acrylic standee: a flat printed panel, which is what most of these
          actually are. Catches a hard specular edge as the camera parallaxes. */}
      <div
        ref={light.ref}
        className="m-acrylic"
        style={{
          position: "absolute",
          left: 0,
          bottom: h * 0.05,
          width: w,
          height: h * 0.95,
          borderRadius: `${w * 0.42}px ${w * 0.42}px 6px 6px`,
          overflow: "hidden",
        }}
        onPointerMove={light.onPointerMove}
        onPointerLeave={light.onPointerLeave}
      >
        <div
          style={{
            position: "absolute",
            left: "16%",
            right: "16%",
            top: "10%",
            bottom: "6%",
            borderRadius: "44% 44% 30% 30%",
            background: `linear-gradient(175deg, color-mix(in oklab, ${template.colorway.accent} 80%, transparent), color-mix(in oklab, ${template.colorway.base} 70%, transparent))`,
          }}
        />
      </div>
    </CaseObjectShell>
  );
}

/** Shared positioning, hover physics, and contact shadow. */
function CaseObjectShell({
  x,
  bottom,
  w,
  h,
  hovered,
  interactive,
  label,
  mass,
  onHover,
  onSelect,
  children,
}: {
  x: number;
  bottom: number;
  w: number;
  h: number;
  hovered: boolean;
  interactive: boolean;
  label: string;
  mass: "plushie" | "figure" | "lightstick";
  onHover: (hovering: boolean) => void;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="contact-shadow"
        style={{
          left: x - w * 0.14,
          bottom: bottom - 5,
          width: w * 1.28,
          height: 15,
          ["--shadow-blur" as string]: "7px",
          opacity: hovered ? 0.55 : 0.9,
          transition: "opacity 200ms var(--ease-physical)",
        }}
      />
      <motion.div
        className="zone-hotspot"
        style={{
          position: "absolute",
          left: x,
          bottom,
          width: w,
          height: h,
          transformStyle: "preserve-3d",
          transformOrigin: "50% 100%",
        }}
        animate={{ y: hovered ? -9 : 0, rotateY: hovered ? 9 : 0, z: hovered ? 22 : 0 }}
        transition={objectSpring(mass)}
        onHoverStart={interactive ? () => onHover(true) : undefined}
        onHoverEnd={interactive ? () => onHover(false) : undefined}
        onClick={interactive ? onSelect : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : -1}
        aria-label={interactive ? `${label}. Inspect.` : undefined}
      >
        {children}
      </motion.div>
    </>
  );
}
