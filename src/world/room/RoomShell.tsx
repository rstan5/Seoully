import { ROOM_DEPTH, ROOM_HEIGHT, ROOM_WIDTH } from "@/domain/fixtures/collectors";
import { WorldNode } from "@/world/stage/WorldNode";

/**
 * The physical box: back wall, two side walls, and a floor.
 *
 * Built from geometry rather than art assets. That choice keeps the room fully
 * themeable per collector, costs nothing to download, and means art direction
 * iterates in milliseconds instead of round-tripping through an asset
 * pipeline — which matters enormously when the whole bet is on how it feels.
 *
 * The side walls are angled inward very slightly. A perfectly rectangular box
 * reads as a stage flat; a couple of degrees of convergence reads as a room.
 */
export function RoomShell() {
  const halfWidth = ROOM_WIDTH / 2;
  const backZ = -ROOM_DEPTH;
  const floorY = ROOM_HEIGHT / 2;

  return (
    <>
      {/* Back wall */}
      <WorldNode x={0} y={0} z={backZ} w={ROOM_WIDTH} h={ROOM_HEIGHT} className="room-wall" />

      {/* Side walls. Their local +x runs into the screen, so they span depth. */}
      <WorldNode
        x={-halfWidth}
        y={0}
        z={backZ / 2}
        w={ROOM_DEPTH}
        h={ROOM_HEIGHT}
        rotateY={88}
        className="room-wall"
        style={{ filter: undefined, opacity: 1 }}
      />
      <WorldNode
        x={halfWidth}
        y={0}
        z={backZ / 2}
        w={ROOM_DEPTH}
        h={ROOM_HEIGHT}
        rotateY={-88}
        className="room-wall"
      />

      {/* Floor */}
      <WorldNode
        x={0}
        y={floorY}
        z={backZ / 2}
        w={ROOM_WIDTH}
        h={ROOM_DEPTH}
        rotateX={90}
        className="room-floor"
      />

      {/* Ceiling. Barely seen, but its absence is felt immediately — without it
          the top of the frame is a black void and the room reads as a stage set
          rather than an enclosed space. */}
      <WorldNode
        x={0}
        y={-floorY}
        z={backZ / 2}
        w={ROOM_WIDTH}
        h={ROOM_DEPTH}
        rotateX={-90}
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, #000 62%, transparent), color-mix(in oklab, var(--room-wall) 74%, #000))",
        }}
      />

      {/* Baseboard. A small thing, but the seam where wall meets floor is the
          first place a CG room gives itself away as two flat planes. */}
      <WorldNode
        x={0}
        y={floorY - 26}
        z={backZ + 6}
        w={ROOM_WIDTH}
        h={52}
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklab, var(--room-furniture-edge) 40%, transparent), color-mix(in oklab, #000 40%, transparent))",
          boxShadow: "0 -10px 24px color-mix(in oklab, #000 34%, transparent)",
        }}
      />
    </>
  );
}
