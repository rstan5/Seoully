"use client";

import { motion } from "motion/react";
import type { DecorAsset, Transform3D } from "@/domain/types";
import { objectSpring, spring } from "@/design/motion";
import { WorldNode } from "@/world/stage/WorldNode";

/**
 * Catalog meshes. Each one is a small physical object — thickness, shadow,
 * a material that catches the room light — not an icon standing in for furniture.
 */
export function DecorObject({
  asset,
  transform,
  lifted,
  editing,
  far,
  onGrab,
}: {
  asset: DecorAsset;
  transform: Transform3D;
  lifted: boolean;
  editing: boolean;
  far?: boolean;
  onGrab?: (event: React.PointerEvent) => void;
}) {
  const rug = asset.id === "accent-rug";
  const w = rug ? asset.size.w : asset.size.w;
  const h = rug ? (asset.size.d ?? asset.size.w * 0.66) : asset.size.h;

  return (
    <WorldNode
      x={transform.x}
      y={transform.y + (lifted && !rug ? -26 : 0)}
      z={transform.z + (lifted ? 44 : 0)}
      w={w}
      h={h}
      rotateX={rug ? 90 : (transform.rotateX ?? 0)}
      rotateY={transform.rotateY ?? 0}
      rotateZ={transform.rotateZ ?? 0}
      scale={lifted ? 1.04 : (transform.scale ?? 1)}
      className={far ? "fidelity-far" : undefined}
    >
      <motion.div
        className={editing ? `editing-grab${lifted ? " is-lifted" : ""}` : undefined}
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          cursor: editing ? "grab" : undefined,
          touchAction: editing ? "none" : undefined,
        }}
        transition={lifted ? spring.float : objectSpring("furniture")}
        onPointerDown={
          editing
            ? (event) => {
                event.stopPropagation();
                onGrab?.(event);
              }
            : undefined
        }
        role={editing ? "button" : undefined}
        tabIndex={editing ? 0 : -1}
        aria-label={editing ? `${asset.name}. Move.` : undefined}
      >
        <DecorMesh assetId={asset.id} w={w} h={h} d={asset.size.d ?? 60} />
      </motion.div>
    </WorldNode>
  );
}

export function DecorMesh({ assetId, w, h, d }: { assetId: string; w: number; h: number; d: number }) {
  switch (assetId) {
    case "floor-lamp":
      return <FloorLamp w={w} h={h} />;
    case "plant":
      return <Plant w={w} h={h} d={d} />;
    case "speaker":
      return <Speaker w={w} h={h} d={d} />;
    case "storage-crate":
      return <Crate w={w} h={h} d={d} />;
    case "chair":
      return <Chair w={w} h={h} d={d} />;
    case "accent-rug":
      return <Rug w={w} h={h} />;
    case "wall-mirror":
      return <Mirror w={w} h={h} d={d} />;
    case "framed-print":
      return <FramedPrint w={w} h={h} />;
    case "photo-string":
      return <PhotoString w={w} h={h} />;
    case "display-stand":
      return <DisplayStand w={w} h={h} d={d} />;
    default:
      return <Crate w={w} h={h} d={d} />;
  }
}

function FloorLamp({ w, h }: { w: number; h: number }) {
  return (
    <>
      <div
        className="contact-shadow"
        style={{
          left: w * 0.12,
          bottom: -10,
          width: w * 0.76,
          height: 16,
          ["--shadow-blur" as string]: "10px",
        }}
      />
      <div
        className="m-brushed-metal"
        style={{
          position: "absolute",
          left: w * 0.18,
          bottom: 0,
          width: w * 0.64,
          height: 10,
          borderRadius: "50%",
          transform: "rotateX(72deg)",
          background: "color-mix(in oklab, var(--room-furniture-edge) 55%, #2a2434)",
        }}
      />
      <div
        className="m-brushed-metal"
        style={{
          position: "absolute",
          left: w / 2 - 4,
          bottom: 8,
          width: 8,
          height: h * 0.72,
          background: "linear-gradient(90deg, #3a3448, #8a8298, #2e2838)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: w * 0.16,
          top: 0,
          width: w * 0.68,
          height: h * 0.22,
          borderRadius: "46% 46% 12% 12%",
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--room-light-color) 55%, #efe4d2), color-mix(in oklab, var(--room-furniture) 40%, #c9b59a))",
          boxShadow: `0 8px 28px color-mix(in oklab, var(--room-light-color) 42%, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: w * 0.22,
          top: h * 0.18,
          width: w * 0.56,
          height: 18,
          borderRadius: "50%",
          background: `radial-gradient(circle, var(--room-light-color), transparent 72%)`,
          boxShadow: `0 0 40px 16px color-mix(in oklab, var(--room-light-color) 28%, transparent)`,
        }}
      />
    </>
  );
}

function Plant({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <>
      <div
        className="contact-shadow"
        style={{
          left: w * 0.1,
          bottom: -8,
          width: w * 0.8,
          height: 14,
          ["--shadow-blur" as string]: "8px",
        }}
      />
      <div
        className="m-warm-wood"
        style={{
          ["--base" as string]: "#8a4a38",
          position: "absolute",
          left: w * 0.22,
          bottom: 0,
          width: w * 0.56,
          height: h * 0.28,
          borderRadius: "6% 6% 18% 18%",
          boxShadow: "inset 0 8px 14px color-mix(in oklab, #000 28%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: w * 0.22,
          bottom: 0,
          width: d * 0.5,
          height: h * 0.28,
          transformOrigin: "0% 50%",
          transform: "rotateY(90deg)",
          background: "color-mix(in oklab, #8a4a38 70%, #000)",
        }}
      />
      {[
        { left: 0.18, rot: -28, h: 0.62, tone: "#2f6a48" },
        { left: 0.38, rot: -8, h: 0.78, tone: "#3d8a5c" },
        { left: 0.52, rot: 12, h: 0.7, tone: "#2a5c3e" },
        { left: 0.64, rot: 32, h: 0.56, tone: "#4a9a68" },
      ].map((leaf, i) => (
        <div
          key={i}
          className="life-leaf"
          style={{
            position: "absolute",
            left: `${leaf.left * 100}%`,
            bottom: h * 0.24,
            width: w * 0.22,
            height: h * leaf.h,
            transformOrigin: "50% 100%",
            animationDelay: `${i * -1.6}s`,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `rotate(${leaf.rot}deg) translateZ(${i * 3}px)`,
              borderRadius: "50% 50% 46% 46% / 62% 62% 38% 38%",
              background: `linear-gradient(180deg, color-mix(in oklab, ${leaf.tone} 70%, #cfe8c4), ${leaf.tone})`,
              boxShadow: "2px 6px 10px color-mix(in oklab, #000 28%, transparent)",
            }}
          />
        </div>
      ))}
    </>
  );
}

function Speaker({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <>
      <div
        className="contact-shadow"
        style={{ left: 4, bottom: -8, width: w, height: 12, ["--shadow-blur" as string]: "7px" }}
      />
      <div
        className="world-face m-warm-wood"
        style={{
          ["--base" as string]: "color-mix(in oklab, var(--room-furniture) 40%, #5a4030)",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, #000 35%, transparent)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "18%",
            right: "18%",
            top: "14%",
            height: "38%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 40% 36%, #6a6478, #1c1824 62%, #0e0c12 63%, #2a2432)",
            boxShadow: "inset 0 0 0 3px color-mix(in oklab, #000 50%, transparent)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "28%",
            right: "28%",
            bottom: "12%",
            height: "22%",
            borderRadius: "50%",
            background: "radial-gradient(circle at 40% 36%, #5a5468, #16121c 70%)",
          }}
        />
      </div>
      <div
        className="m-warm-wood"
        style={{
          ["--base" as string]: "color-mix(in oklab, var(--room-furniture) 30%, #3a281c)",
          position: "absolute",
          right: 0,
          top: 0,
          width: d,
          height: h,
          transformOrigin: "100% 50%",
          transform: "rotateY(-90deg)",
        }}
      />
    </>
  );
}

function Crate({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <>
      <div
        className="contact-shadow"
        style={{ left: 2, bottom: -8, width: w, height: 14, ["--shadow-blur" as string]: "8px" }}
      />
      <div
        className="world-face m-paper"
        style={{
          ["--base" as string]: "#cbb896",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, #000 22%, transparent)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "12%",
            right: "12%",
            top: "28%",
            height: 18,
            background: "color-mix(in oklab, var(--room-ink) 18%, transparent)",
          }}
        />
      </div>
      <div
        className="m-paper"
        style={{
          ["--base" as string]: "#b79f7c",
          position: "absolute",
          right: 0,
          top: 0,
          width: d * 0.55,
          height: h,
          transformOrigin: "100% 50%",
          transform: "rotateY(-90deg)",
        }}
      />
      <div
        className="m-paper"
        style={{
          ["--base" as string]: "#d8c4a0",
          position: "absolute",
          left: 0,
          top: 0,
          width: w,
          height: d * 0.45,
          transformOrigin: "50% 0%",
          transform: "rotateX(-78deg)",
        }}
      />
    </>
  );
}

function Chair({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <>
      <div
        className="contact-shadow"
        style={{
          left: w * 0.06,
          bottom: -10,
          width: w * 0.9,
          height: 16,
          ["--shadow-blur" as string]: "10px",
        }}
      />
      {[0.12, 0.78].map((left) => (
        <div
          key={left}
          className="m-warm-wood"
          style={{
            ["--base" as string]: "var(--room-furniture)",
            position: "absolute",
            left: `${left * 100}%`,
            bottom: 0,
            width: 10,
            height: h * 0.42,
            transform: `translateZ(${-d * 0.2}px)`,
          }}
        />
      ))}
      <div
        className="m-velvet"
        style={{
          ["--base" as string]: "color-mix(in oklab, var(--room-furniture) 55%, #6a3048)",
          position: "absolute",
          left: w * 0.08,
          bottom: h * 0.38,
          width: w * 0.84,
          height: d * 0.55,
          transformOrigin: "50% 100%",
          transform: "rotateX(-88deg)",
          borderRadius: 8,
        }}
      />
      <div
        className="m-velvet"
        style={{
          ["--base" as string]: "color-mix(in oklab, var(--room-furniture) 40%, #5a283c)",
          position: "absolute",
          left: w * 0.1,
          bottom: h * 0.38,
          width: w * 0.8,
          height: h * 0.58,
          transform: `translateZ(${-d * 0.42}px)`,
          borderRadius: "10px 10px 4px 4px",
        }}
      />
    </>
  );
}

function Rug({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="m-velvet"
      style={{
        ["--base" as string]: "color-mix(in oklab, var(--room-furniture) 70%, var(--fill-color))",
        position: "absolute",
        inset: 0,
        borderRadius: 10,
        boxShadow: "0 0 28px color-mix(in oklab, #000 40%, transparent)",
        backgroundImage: `
          radial-gradient(60% 50% at 50% 40%, color-mix(in oklab, var(--fill-color) 26%, transparent), transparent 70%),
          repeating-linear-gradient(90deg,
            color-mix(in oklab, var(--room-furniture-edge) 22%, transparent) 0 8px,
            transparent 8px 18px)`,
      }}
    />
  );
}

function Mirror({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <>
      <div
        className="m-warm-wood"
        style={{
          ["--base" as string]: "var(--room-furniture-edge)",
          position: "absolute",
          inset: 0,
          boxShadow: "4px 8px 18px color-mix(in oklab, #000 40%, transparent)",
        }}
      />
      <div
        className="m-acrylic"
        style={{
          position: "absolute",
          inset: 10,
          background:
            "linear-gradient(145deg, color-mix(in oklab, #fff 55%, #9ab0c8), color-mix(in oklab, #6a7a90 40%, #1a2430))",
          boxShadow: "inset 0 0 0 1px color-mix(in oklab, #fff 35%, transparent)",
        }}
      />
      <div
        className="m-warm-wood"
        style={{
          ["--base" as string]: "var(--room-furniture)",
          position: "absolute",
          right: 0,
          top: 0,
          width: d,
          height: h,
          transformOrigin: "100% 50%",
          transform: "rotateY(-90deg)",
        }}
      />
    </>
  );
}

function FramedPrint({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="m-warm-wood"
      style={{
        ["--base" as string]: "var(--room-furniture-edge)",
        position: "absolute",
        inset: 0,
        padding: 9,
        boxShadow: "5px 8px 16px color-mix(in oklab, #000 38%, transparent)",
      }}
    >
      <div
        className="m-photo-print"
        style={{
          ["--base" as string]: "color-mix(in oklab, var(--fill-color) 40%, #efe4d4)",
          position: "absolute",
          inset: 9,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "22%",
            top: "18%",
            width: "56%",
            height: "44%",
            borderRadius: "40% 40% 36% 36%",
            background: "color-mix(in oklab, var(--fill-color) 50%, #3a2030)",
            opacity: 0.55,
          }}
        />
      </div>
    </div>
  );
}

function PhotoString({ w, h }: { w: number; h: number }) {
  const cards = [0.08, 0.38, 0.68];
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 8,
          height: 2,
          background: "color-mix(in oklab, var(--room-ink) 45%, transparent)",
          transform: "rotate(-2deg)",
        }}
      />
      {cards.map((left, i) => (
        <div
          key={i}
          className="m-photo-print"
          style={{
            ["--base" as string]: `color-mix(in oklab, var(--fill-color) ${22 + i * 10}%, #f0e6d6)`,
            position: "absolute",
            left: `${left * 100}%`,
            top: 14,
            width: w * 0.22,
            height: h * 0.78,
            transform: `rotate(${i === 1 ? 4 : i === 0 ? -8 : 6}deg)`,
            boxShadow: "2px 4px 10px color-mix(in oklab, #000 40%, transparent)",
          }}
        />
      ))}
    </>
  );
}

function DisplayStand({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <>
      <div
        className="contact-shadow"
        style={{ left: 0, bottom: -6, width: w, height: 10, ["--shadow-blur" as string]: "6px" }}
      />
      <div
        className="m-acrylic"
        style={{
          position: "absolute",
          left: w * 0.15,
          bottom: 0,
          width: w * 0.7,
          height: 8,
          transform: "rotateX(80deg)",
          background: "color-mix(in oklab, #fff 28%, transparent)",
        }}
      />
      <div
        className="m-acrylic"
        style={{
          position: "absolute",
          left: w * 0.42,
          bottom: 8,
          width: 8,
          height: h - 8,
          background: "linear-gradient(180deg, color-mix(in oklab, #fff 50%, transparent), color-mix(in oklab, #9ab 30%, transparent))",
        }}
      />
      <div
        className="m-acrylic"
        style={{
          position: "absolute",
          left: w * 0.18,
          top: 0,
          width: w * 0.64,
          height: d * 0.4,
          transformOrigin: "50% 0%",
          transform: "rotateX(-72deg)",
          background: "color-mix(in oklab, #fff 22%, transparent)",
          boxShadow: "0 0 12px color-mix(in oklab, var(--room-light-color) 20%, transparent)",
        }}
      />
    </>
  );
}
