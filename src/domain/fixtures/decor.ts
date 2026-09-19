import { FLOOR_Y } from "./collectors";
import type {
  DecorAsset,
  DecorId,
  RoomId,
  RoomObject,
  RoomObjectId,
} from "../types";

function decor(id: string, asset: Omit<DecorAsset, "id" | "owned" | "tier">): DecorAsset {
  return { id: id as DecorId, owned: true, tier: "foundation", ...asset };
}

/**
 * A small, physical catalog.
 *
 * Quality over quantity: each piece is a real object with thickness, a
 * material, and a place it belongs. The shop can grow this list later
 * without changing the room object model.
 */
export const DECOR_CATALOG: DecorAsset[] = [
  decor("floor-lamp", {
    name: "Floor lamp",
    category: "lighting",
    material: "brushed-metal",
    mount: "floor",
    size: { w: 86, h: 420, d: 86 },
    rarity: "common",
  }),
  decor("plant", {
    name: "Floor plant",
    category: "plant",
    material: "plush",
    mount: "floor",
    size: { w: 120, h: 210, d: 90 },
    rarity: "common",
  }),
  decor("speaker", {
    name: "Bookshelf speaker",
    category: "audio",
    material: "warm-wood",
    mount: "floor",
    size: { w: 78, h: 96, d: 70 },
    rarity: "uncommon",
  }),
  decor("storage-crate", {
    name: "Storage crate",
    category: "storage",
    material: "paper",
    mount: "floor",
    size: { w: 160, h: 110, d: 120 },
    rarity: "common",
  }),
  decor("chair", {
    name: "Lounge chair",
    category: "furniture",
    material: "warm-wood",
    mount: "floor",
    size: { w: 150, h: 176, d: 140 },
    rarity: "uncommon",
  }),
  decor("accent-rug", {
    name: "Accent rug",
    category: "floor",
    material: "velvet",
    mount: "floor",
    size: { w: 420, h: 8, d: 280 },
    rarity: "common",
  }),
  decor("wall-mirror", {
    name: "Wall mirror",
    category: "wall",
    material: "acrylic",
    mount: "wall",
    size: { w: 140, h: 220, d: 12 },
    rarity: "uncommon",
  }),
  decor("framed-print", {
    name: "Framed print",
    category: "wall",
    material: "photo-print",
    mount: "wall",
    size: { w: 150, h: 190, d: 10 },
    rarity: "common",
  }),
  decor("photo-string", {
    name: "Photo string",
    category: "wall",
    material: "paper",
    mount: "wall",
    size: { w: 280, h: 90, d: 8 },
    rarity: "common",
  }),
  decor("display-stand", {
    name: "Acrylic stand",
    category: "display",
    material: "acrylic",
    mount: "surface",
    size: { w: 70, h: 54, d: 50 },
    rarity: "uncommon",
  }),
];

export const DECOR_BY_ID = new Map(DECOR_CATALOG.map((a) => [a.id as string, a]));

function obj(
  id: string,
  roomId: string,
  assetId: string,
  zone: RoomObject["zone"],
  transform: RoomObject["transform"],
  layer?: number,
): RoomObject {
  return {
    id: id as RoomObjectId,
    roomId: roomId as RoomId,
    assetId: assetId as DecorId,
    zone,
    transform,
    ...(layer !== undefined ? { layer } : {}),
  };
}

/**
 * Default furniture for each collector.
 *
 * Soomin's room stays sparse: a lamp, a plant, a speaker. Minji's is staged —
 * chair, mirror, print, string. Visiting either should feel like walking into
 * a different apartment, not a reskin of the same layout.
 */
export const ROOM_OBJECTS_FIXTURE: RoomObject[] = [
  obj("ro-soo-lamp", "room-soo", "floor-lamp", "floor", {
    x: -1040,
    y: FLOOR_Y - 210,
    z: -500,
  }),
  obj("ro-soo-plant", "room-soo", "plant", "floor", {
    x: -980,
    y: FLOOR_Y - 105,
    z: -180,
  }),
  obj("ro-soo-speaker", "room-soo", "speaker", "floor", {
    x: -520,
    y: FLOOR_Y - 48,
    z: -560,
  }),
  obj("ro-soo-crate", "room-soo", "storage-crate", "floor", {
    x: -200,
    y: FLOOR_Y - 55,
    z: -200,
    rotateY: 4,
  }),
  obj("ro-soo-stand", "room-soo", "display-stand", "floor", {
    x: 420,
    y: FLOOR_Y - 27,
    z: -240,
  }),

  obj("ro-minji-plant", "room-minji", "plant", "floor", {
    x: 980,
    y: FLOOR_Y - 105,
    z: -230,
  }),
  obj("ro-minji-plant-2", "room-minji", "plant", "floor", {
    x: -920,
    y: FLOOR_Y - 105,
    z: -160,
  }),
  obj("ro-minji-chair", "room-minji", "chair", "floor", {
    x: 340,
    y: FLOOR_Y - 88,
    z: -170,
    rotateY: -22,
  }),
  obj("ro-minji-rug", "room-minji", "accent-rug", "floor", {
    x: 80,
    y: FLOOR_Y - 3,
    z: -200,
    rotateY: 8,
  }),
  obj("ro-minji-speaker", "room-minji", "speaker", "floor", {
    x: -40,
    y: FLOOR_Y - 48,
    z: -280,
    rotateY: 18,
  }),
  obj("ro-minji-mirror", "room-minji", "wall-mirror", "wall", {
    x: 40,
    y: -40,
    z: -888,
  }),
  obj("ro-minji-print", "room-minji", "framed-print", "wall", {
    x: 260,
    y: -90,
    z: -886,
    rotateZ: 5,
  }),
  obj("ro-minji-string", "room-minji", "photo-string", "wall", {
    x: -70,
    y: -250,
    z: -882,
    rotateZ: -3,
  }),
];
