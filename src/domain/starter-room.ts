import { FLOOR_Y } from "./fixtures/collectors";
import type {
  CameraDock,
  DecorId,
  Room,
  RoomId,
  RoomObject,
  RoomObjectId,
  RoomTheme,
  RoomZone,
  Transform3D,
  UserId,
  ZoneId,
  ZoneKind,
} from "./types";

/**
 * A furnished starter apartment for a new collector.
 *
 * Same zone kinds as the fixture rooms so the existing scene graph can host it
 * without a second editor. Empty of collectibles on purpose — the first holding
 * is what turns furniture into a collection.
 */

const HEARTH: RoomTheme = {
  name: "Hearth",
  wall: "#3a2f38",
  wallAccent: "#53444c",
  floor: "#241c22",
  light: { color: "#ffc48a", x: 0.42, y: 0.34, intensity: 1.08, fill: "#c9b6dc" },
  furniture: "#2c242a",
  furnitureEdge: "#7a6a74",
  ink: "#f4efe8",
  inkSoft: "#b5a8b0",
  grade: "linear-gradient(165deg, rgba(90,40,56,0.22), rgba(12,8,14,0.4))",
};

interface ZoneSeed {
  kind: ZoneKind;
  label: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  dolly: number;
}

const STARTER_ZONES: ZoneSeed[] = [
  { kind: "shelf", label: "Shelf", x: -700, y: 310, z: -800, w: 470, h: 780, dolly: 90 },
  { kind: "wall", label: "Wall", x: 430, y: -390, z: -885, w: 640, h: 400, dolly: 430 },
  { kind: "display-case", label: "Display Case", x: 820, y: 380, z: -770, w: 360, h: 640, dolly: 440 },
  { kind: "desk", label: "Desk", x: 140, y: 445, z: -620, w: 640, h: 510, dolly: 340 },
  { kind: "binder", label: "Binder", x: 236, y: 83, z: -560, w: 178, h: 214, dolly: 250 },
  { kind: "archive", label: "Archive", x: -380, y: 585, z: -320, w: 380, h: 230, dolly: 300 },
];

function zonesFor(roomId: RoomId): RoomZone[] {
  return STARTER_ZONES.map((s) => {
    const dock: CameraDock = { x: s.x, y: s.y, z: s.z, dolly: s.dolly };
    return {
      id: `${roomId}-${s.kind}` as ZoneId,
      roomId,
      kind: s.kind,
      label: s.label,
      transform: { x: s.x, y: s.y, z: s.z },
      dock,
      size: { w: s.w, h: s.h },
    };
  });
}

export function starterRoomId(userId: UserId): RoomId {
  return `room-${userId}` as RoomId;
}

export function createStarterRoom(userId: UserId): Room {
  const id = starterRoomId(userId);
  return {
    id,
    ownerId: userId,
    aesthetic: "warm-analog",
    theme: { ...HEARTH, light: { ...HEARTH.light } },
    zones: zonesFor(id),
  };
}

export function createStarterFurniture(roomId: RoomId): RoomObject[] {
  const pose = (assetId: string, transform: Transform3D, zone: RoomObject["zone"] = "floor"): RoomObject => ({
    id: `ro-${roomId}-${assetId}` as RoomObjectId,
    roomId,
    assetId: assetId as DecorId,
    zone,
    transform,
  });

  return [
    pose("floor-lamp", { x: -1040, y: FLOOR_Y - 210, z: -500 }),
    pose("plant", { x: -980, y: FLOOR_Y - 105, z: -180 }),
    pose("speaker", { x: -520, y: FLOOR_Y - 48, z: -560 }),
    pose("storage-crate", { x: -200, y: FLOOR_Y - 55, z: -200, rotateY: 4 }),
    pose("display-stand", { x: 420, y: FLOOR_Y - 27, z: -240 }),
    pose("accent-rug", { x: 40, y: FLOOR_Y - 3, z: -220, rotateY: 6 }),
  ];
}
