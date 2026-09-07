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
  const mirrored = room.aesthetic === "maximalist";
  const sign = mirrored ? -1 : 1;

  return (
    <>
      <Garland
        x={sign * -620}
        y={-460}
        z={-878}
        width={640}
        accent={room.theme.light.fill}
      />

      {/* Floor rug, well forward of the furniture. */}
      <WorldNode
        x={sign * 120}
        y={ROOM_HEIGHT / 2 - 2}
        z={-300}
        w={900}
        h={480}
        rotateX={90}
        style={{
          background: `
            radial-gradient(70% 70% at 50% 40%, color-mix(in oklab, ${room.theme.light.fill} 20%, transparent), transparent 72%),
            repeating-linear-gradient(94deg,
              color-mix(in oklab, ${room.theme.furniture} 88%, #000) 0px,
              color-mix(in oklab, ${room.theme.furnitureEdge} 14%, ${room.theme.furniture}) 5px,
              color-mix(in oklab, ${room.theme.furniture} 92%, #000) 11px)`,
          borderRadius: 6,
          boxShadow: "0 0 46px color-mix(in oklab, #000 44%, transparent)",
          opacity: 0.9,
        }}
      />

      {/* Skirting-height LED strip washing the back wall from below. This is
          where the room's colored fill physically comes from. */}
      <WorldNode
        x={0}
        y={ROOM_HEIGHT / 2 - 56}
        z={-ROOM_DEPTH + 14}
        w={ROOM_WIDTH * 0.86}
        h={5}
        style={{
          background: `linear-gradient(90deg, transparent, ${room.theme.light.fill}, transparent)`,
          boxShadow: `0 0 40px 12px color-mix(in oklab, ${room.theme.light.fill} 34%, transparent)`,
          opacity: 0.8,
        }}
      />
    </>
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
}: {
  x: number;
  y: number;
  z: number;
  width: number;
  accent: string;
}) {
  const count = 7;
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
