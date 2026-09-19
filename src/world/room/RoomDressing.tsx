"use client";

import { ROOM_DEPTH, ROOM_HEIGHT, ROOM_WIDTH } from "@/domain/fixtures/collectors";
import type { Room } from "@/domain/types";
import { WorldNode } from "@/world/stage/WorldNode";

/**
 * Set dressing: the things in a collector's room that aren't collection items.
 *
 * This isn't decoration for its own sake. A room built only from zones has
 * large blank wall areas, and blank walls are what make a 3D space read as an
 * empty level rather than somewhere a person lives. A garland of clipped
 * photocards and a rug do more for believability than any additional shelf
 * would, and they're the details fans actually recognize from their own rooms.
 */
export function RoomDressing({ room }: { room: Room }) {
  const daylight = room.aesthetic === "maximalist";
  const sign = daylight ? -1 : 1;

  return (
    <>
      {daylight ? (
        <Garland
          x={sign * -620}
          y={-460}
          z={-878}
          width={640}
          count={7}
          accent={room.theme.light.fill}
        />
      ) : (
        <Garland
          x={sign * -200}
          y={-430}
          z={-878}
          width={220}
          count={3}
          accent={room.theme.light.fill}
        />
      )}

      <WorldNode
        x={sign * (daylight ? 80 : 40)}
        y={ROOM_HEIGHT / 2 - 2}
        z={daylight ? -280 : -360}
        w={daylight ? 920 : 640}
        h={daylight ? 500 : 360}
        rotateX={90}
        style={{
          background: daylight
            ? `
            radial-gradient(70% 70% at 50% 40%, color-mix(in oklab, ${room.theme.light.fill} 28%, transparent), transparent 72%),
            repeating-linear-gradient(96deg,
              color-mix(in oklab, ${room.theme.furniture} 88%, #fff) 0px,
              color-mix(in oklab, ${room.theme.light.fill} 22%, ${room.theme.furniture}) 6px,
              color-mix(in oklab, ${room.theme.furniture} 92%, #000) 14px)`
            : `
            radial-gradient(60% 50% at 40% 30%, color-mix(in oklab, ${room.theme.light.color} 10%, transparent), transparent 70%),
            repeating-linear-gradient(90deg,
              color-mix(in oklab, ${room.theme.furniture} 70%, #000) 0px,
              color-mix(in oklab, ${room.theme.furnitureEdge} 18%, ${room.theme.furniture}) 7px,
              color-mix(in oklab, ${room.theme.furniture} 80%, #000) 16px)`,
          borderRadius: daylight ? 8 : 3,
          boxShadow: `0 0 ${daylight ? 36 : 52}px color-mix(in oklab, #000 ${daylight ? 28 : 56}%, transparent)`,
        }}
      />

      <WorldNode
        x={0}
        y={ROOM_HEIGHT / 2 - 56}
        z={-ROOM_DEPTH + 14}
        w={ROOM_WIDTH * (daylight ? 0.9 : 0.72)}
        h={5}
        style={{
          background: `linear-gradient(90deg, transparent, ${room.theme.light.fill}, transparent)`,
          boxShadow: `0 0 ${daylight ? 28 : 46}px 12px color-mix(in oklab, ${room.theme.light.fill} ${daylight ? 22 : 38}%, transparent)`,
        }}
      />

      {!daylight && (
        <>
          <NightWindow x={-ROOM_WIDTH / 2 + 10} y={-40} z={-380} />
          <StickyNote
            x={sign * 318}
            y={-18}
            z={-872}
            rotate={-4}
            ink="#5a3a18"
            paper="#f3d27a"
            text="11 / 12"
          />
          <Polaroid
            x={sign * -160}
            y={-220}
            z={-876}
            rotate={3}
            caption="ATE night"
            wash="#c1121f"
          />
          <Tote
            x={sign * -780}
            y={ROOM_HEIGHT / 2 - 92}
            z={-240}
            body="#2a2238"
            strap="#c1121f"
          />
        </>
      )}

      {daylight && (
        <>
          <DayWindow x={-ROOM_WIDTH / 2 + 8} y={-80} z={-420} room={room} />
          <Polaroid
            x={sign * 240}
            y={-280}
            z={-876}
            rotate={-7}
            caption="won"
            wash="#e8567f"
          />
          <Polaroid
            x={sign * 318}
            y={-236}
            z={-870}
            rotate={9}
            caption="dive"
            wash="#7aa0d8"
          />
          <Polaroid
            x={sign * 180}
            y={-190}
            z={-868}
            rotate={-3}
            caption="rei"
            wash="#7ad0c4"
          />
          <Washi x={sign * -80} y={-520} z={-882} rotate={-14} color="#ff8fb1" />
          <Washi x={sign * 40} y={-548} z={-882} rotate={8} color="#fff4c8" />
          <Washi x={sign * 160} y={-500} z={-880} rotate={4} color="#c478d4" />
          <PinnedCard x={sign * 520} y={-120} z={-874} rotate={-11} wash="#ff8fb1" />
          <PinnedCard x={sign * 568} y={-40} z={-868} rotate={7} wash="#c478d4" />
          <PinnedCard x={sign * 500} y={40} z={-870} rotate={4} wash="#7aa0d8" />
          <Tote
            x={sign * 760}
            y={ROOM_HEIGHT / 2 - 88}
            z={-220}
            body="#fdeef4"
            strap="#e8567f"
          />
        </>
      )}
    </>
  );
}

function NightWindow({ x, y, z }: { x: number; y: number; z: number }) {
  return (
    <WorldNode x={x} y={y} z={z} w={380} h={520} rotateY={88}>
      <div
        className="m-warm-wood"
        style={{
          ["--base" as string]: "var(--room-furniture)",
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 0 14px color-mix(in oklab, var(--room-furniture) 80%, #000)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 16,
          background:
            "linear-gradient(180deg, #14101c 0%, #1a1428 40%, #2a1830 100%)",
          boxShadow: "inset 0 0 40px color-mix(in oklab, #000 50%, transparent)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 16,
          background:
            "repeating-linear-gradient(180deg, transparent 0 18px, color-mix(in oklab, #1a1420 72%, transparent) 18px 20px)",
        }}
      />
      <div
        className="life-glow"
        style={{
          position: "absolute",
          left: "28%",
          top: "22%",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "radial-gradient(circle, #ffc48a, transparent 70%)",
        }}
      />
    </WorldNode>
  );
}

function DayWindow({
  x,
  y,
  z,
  room,
}: {
  x: number;
  y: number;
  z: number;
  room: Room;
}) {
  return (
    <WorldNode x={x} y={y} z={z} w={520} h={640} rotateY={88}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(180deg,
              color-mix(in oklab, ${room.theme.light.color} 92%, #fff) 0%,
              color-mix(in oklab, ${room.theme.wallAccent} 40%, ${room.theme.light.color}) 100%)`,
          boxShadow: `0 0 90px 28px color-mix(in oklab, ${room.theme.light.color} 55%, transparent)`,
          border: `10px solid color-mix(in oklab, ${room.theme.furniture} 70%, #fff)`,
        }}
      />
      <div
        className="life-curtain"
        style={{
          position: "absolute",
          left: 12,
          top: 10,
          width: 88,
          bottom: 10,
          background:
            "repeating-linear-gradient(90deg, color-mix(in oklab, #fff 78%, #ffd0e4) 0 10px, color-mix(in oklab, #ffe8f2 80%, #fff) 10px 18px)",
          transformOrigin: "0% 0%",
          boxShadow: "4px 0 18px color-mix(in oklab, #000 12%, transparent)",
        }}
      />
      <div
        className="life-curtain"
        style={{
          position: "absolute",
          right: 12,
          top: 10,
          width: 72,
          bottom: 10,
          background:
            "repeating-linear-gradient(90deg, color-mix(in oklab, #fff 78%, #ffd0e4) 0 10px, color-mix(in oklab, #ffe8f2 80%, #fff) 10px 18px)",
          transformOrigin: "100% 0%",
          animationDelay: "-4s",
          boxShadow: "-4px 0 18px color-mix(in oklab, #000 12%, transparent)",
        }}
      />
    </WorldNode>
  );
}

/**
 * A string of photocards clipped to a wire.
 *
 * The cards hang at alternating angles with a shallow catenary sag, because a
 * dead-straight wire with evenly-spaced cards is the tell of a CSS grid
 * pretending to be a garland.
 */
function Garland({
  x,
  y,
  z,
  width,
  accent,
  count = 7,
}: {
  x: number;
  y: number;
  z: number;
  width: number;
  accent: string;
  count?: number;
}) {
  const cards = Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    // Parabolic sag, deepest in the middle.
    const sag = Math.sin(t * Math.PI) * 34;
    return {
      i,
      left: t * (width - 46),
      top: sag,
      tilt: (i % 2 === 0 ? -1 : 1) * (3 + (i % 3) * 2.5),
    };
  });

  return (
    <WorldNode x={x} y={y} z={z} w={width} h={150}>
      {/* The wire itself. */}
      <svg
        width={width}
        height={60}
        style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}
        aria-hidden
      >
        <path
          d={`M 0 4 Q ${width / 2} 46 ${width} 4`}
          fill="none"
          stroke="color-mix(in oklab, #000 55%, transparent)"
          strokeWidth="1.5"
        />
      </svg>

      {cards.map((card) => (
        <div
          key={card.i}
          style={{
            position: "absolute",
            left: card.left,
            top: card.top + 4,
            width: 44,
            height: 68,
            transform: `rotate(${card.tilt}deg)`,
            transformOrigin: "50% 0%",
          }}
        >
          {/* Clip */}
          <div
            style={{
              position: "absolute",
              left: "38%",
              top: -6,
              width: 9,
              height: 13,
              background: "linear-gradient(180deg, #b8b2c4, #6b6478)",
              borderRadius: 2,
              boxShadow: "0 1px 3px rgba(0,0,0,0.6)",
            }}
          />
          {/* An out-of-focus print, not a real collection item — these are
              prints people clip up, not cards they'd file in a binder. */}
          <div
            className="m-photo-print"
            style={{
              ["--base" as string]: `color-mix(in oklab, ${accent} ${28 + card.i * 6}%, #efe6d6)`,
              position: "absolute",
              inset: 0,
              borderRadius: 2,
              boxShadow: "2px 4px 9px color-mix(in oklab, #000 50%, transparent)",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "22%",
                top: "18%",
                width: "56%",
                height: "48%",
                borderRadius: "46% 46% 38% 38%",
                background: `color-mix(in oklab, ${accent} 55%, #000)`,
                opacity: 0.5,
              }}
            />
          </div>
        </div>
      ))}
    </WorldNode>
  );
}

function StickyNote({
  x,
  y,
  z,
  rotate,
  ink,
  paper,
  text,
}: {
  x: number;
  y: number;
  z: number;
  rotate: number;
  ink: string;
  paper: string;
  text: string;
}) {
  return (
    <WorldNode x={x} y={y} z={z} w={72} h={72} rotateZ={rotate}>
      <div
        className="m-paper"
        style={{
          ["--base" as string]: paper,
          position: "absolute",
          inset: 0,
          boxShadow: "3px 5px 10px color-mix(in oklab, #000 38%, transparent)",
        }}
      >
        <span
          style={{
            position: "absolute",
            inset: 10,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 18,
            color: ink,
            lineHeight: 1.1,
          }}
        >
          {text}
        </span>
      </div>
    </WorldNode>
  );
}

function Polaroid({
  x,
  y,
  z,
  rotate,
  caption,
  wash,
}: {
  x: number;
  y: number;
  z: number;
  rotate: number;
  caption: string;
  wash: string;
}) {
  return (
    <WorldNode x={x} y={y} z={z} w={78} h={96} rotateZ={rotate}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#f4efe4",
          padding: "6px 6px 22px",
          boxShadow: "4px 7px 14px color-mix(in oklab, #000 42%, transparent)",
        }}
      >
        <div
          className="m-photo-print"
          style={{
            ["--base" as string]: `color-mix(in oklab, ${wash} 38%, #efe6d6)`,
            position: "absolute",
            left: 6,
            right: 6,
            top: 6,
            bottom: 22,
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 8,
            right: 8,
            bottom: 5,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 9,
            color: "#5a4a38",
          }}
        >
          {caption}
        </span>
      </div>
    </WorldNode>
  );
}

function Washi({
  x,
  y,
  z,
  rotate,
  color,
}: {
  x: number;
  y: number;
  z: number;
  rotate: number;
  color: string;
}) {
  return (
    <WorldNode x={x} y={y} z={z} w={120} h={14} rotateZ={rotate}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(90deg, ${color} 0 10px, color-mix(in oklab, ${color} 70%, #fff) 10px 14px)`,
          opacity: 0.78,
          boxShadow: "1px 2px 4px color-mix(in oklab, #000 22%, transparent)",
        }}
      />
    </WorldNode>
  );
}

function PinnedCard({
  x,
  y,
  z,
  rotate,
  wash,
}: {
  x: number;
  y: number;
  z: number;
  rotate: number;
  wash: string;
}) {
  return (
    <WorldNode x={x} y={y} z={z} w={44} h={68} rotateZ={rotate}>
      <div
        style={{
          position: "absolute",
          left: "38%",
          top: -5,
          width: 8,
          height: 8,
          borderRadius: 999,
          background: "#c9c2b4",
          boxShadow: "0 1px 2px rgba(0,0,0,0.45)",
        }}
      />
      <div
        className="m-photo-print"
        style={{
          ["--base" as string]: `color-mix(in oklab, ${wash} 40%, #efe6d6)`,
          position: "absolute",
          inset: 0,
          boxShadow: "2px 4px 8px color-mix(in oklab, #000 46%, transparent)",
        }}
      />
    </WorldNode>
  );
}

function Tote({
  x,
  y,
  z,
  body,
  strap,
}: {
  x: number;
  y: number;
  z: number;
  body: string;
  strap: string;
}) {
  return (
    <WorldNode x={x} y={y} z={z} w={110} h={128}>
      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          top: 4,
          height: 38,
          border: `5px solid ${strap}`,
          borderBottom: 0,
          borderRadius: "40px 40px 0 0",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 36,
          bottom: 0,
          background: `linear-gradient(180deg, color-mix(in oklab, ${body} 88%, #fff), ${body})`,
          boxShadow: "4px 10px 18px color-mix(in oklab, #000 40%, transparent)",
        }}
      />
    </WorldNode>
  );
}
