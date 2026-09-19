import type {
  Activity,
  ActivityId,
  Condition,
  EraId,
  Follow,
  GroupId,
  Holding,
  HoldingId,
  MemberId,
  Placement,
  Profile,
  Room,
  RoomId,
  RoomTheme,
  RoomZone,
  TemplateId,
  TradeStatus,
  User,
  UserId,
  WishlistItem,
  ZoneId,
  ZoneKind,
} from "../types";

/**
 * Collector fixtures.
 *
 * Two collectors, built to be genuinely different rather than reskinned:
 * different groups, different biases, different collection depth, different
 * room geometry, and opposite ends of the aesthetic axis. Their compatibility
 * score is *computed* from the overlap below, never hardcoded — if the data
 * changes, the number changes, which is the only way to trust it.
 */

const id = <T extends string>(v: string): T => v as T;

export const SOO = id<UserId>("u-soo");
export const MINJI = id<UserId>("u-minji");

export const USERS: User[] = [
  { id: SOO, handle: "soo", displayName: "SOOMIN", joinedAt: "2023-02-11" },
  { id: MINJI, handle: "minji", displayName: "MINJI", joinedAt: "2023-08-04" },
];

// ---------------------------------------------------------------------------
// Room geometry
// ---------------------------------------------------------------------------

/**
 * World coordinates.
 *   x → right,  y → down,  z → toward the viewer.
 * The back wall sits at z = -900; the camera's neutral position looks into it.
 *
 * Both rooms use the same six zone kinds but arrange them differently, which
 * is most of why they read as different physical spaces rather than themes.
 */

/**
 * Room box dimensions in world units.
 *
 * Sized so the whole room can be framed at a natural-looking focal length. Go
 * much wider and the overview either clips or forces the camera so far back
 * that perspective flattens and the space stops reading as a room.
 */
export const ROOM_DEPTH = 900;
export const ROOM_WIDTH = 2200;
export const ROOM_HEIGHT = 1400;

/** The depth most zone content sits at. Used to compute overview framing. */
export const ROOM_FOCUS_PLANE = -760;

interface ZoneSeed {
  kind: ZoneKind;
  label: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  rotateY?: number;
  dolly: number;
}

function buildZones(roomId: string, seeds: ZoneSeed[]): RoomZone[] {
  return seeds.map((s) => {
    const zone: RoomZone = {
      id: id<ZoneId>(`${roomId}-${s.kind}`),
      roomId: id<RoomId>(roomId),
      kind: s.kind,
      label: s.label,
      transform: { x: s.x, y: s.y, z: s.z, ...(s.rotateY ? { rotateY: s.rotateY } : {}) },
      dock: { x: s.x, y: s.y, z: s.z, dolly: s.dolly },
      size: { w: s.w, h: s.h },
    };
    return zone;
  });
}

/** Height of the desktop surface. The binder stands on this. */
export const DESK_SURFACE_Y = 190;

/** Floor plane. Freestanding furniture is sized so its base lands here. */
export const FLOOR_Y = ROOM_HEIGHT / 2;

/**
 * SOOMIN — dense, dark, completionist. Furniture reaches the floor and the
 * archive crates sit well forward of everything else, so the room has real
 * front-to-back depth rather than being a single wall of objects.
 */
const SOO_ZONES = buildZones("room-soo", [
  { kind: "shelf", label: "Shelf", x: -700, y: 310, z: -800, w: 470, h: 780, dolly: 90 },
  { kind: "wall", label: "Wall", x: 430, y: -390, z: -885, w: 640, h: 400, dolly: 430 },
  { kind: "display-case", label: "Display Case", x: 820, y: 380, z: -770, w: 360, h: 640, dolly: 440 },
  { kind: "desk", label: "Desk", x: 140, y: 445, z: -620, w: 640, h: 510, dolly: 340 },
  { kind: "binder", label: "Binder", x: 236, y: 83, z: -560, w: 178, h: 214, dolly: 250 },
  { kind: "archive", label: "Archive", x: -380, y: 585, z: -320, w: 380, h: 230, dolly: 300 },
]);

/** MINJI — mirrored layout, airier spacing. Reads as a different apartment. */
const MINJI_ZONES = buildZones("room-minji", [
  { kind: "shelf", label: "Shelf", x: 700, y: 320, z: -805, w: 450, h: 760, dolly: 470 },
  { kind: "wall", label: "Wall", x: -420, y: -400, z: -885, w: 660, h: 400, dolly: 430 },
  { kind: "display-case", label: "Display Case", x: -810, y: 390, z: -770, w: 350, h: 620, dolly: 440 },
  { kind: "desk", label: "Desk", x: -120, y: 445, z: -620, w: 620, h: 510, dolly: 340 },
  { kind: "binder", label: "Binder", x: -216, y: 83, z: -560, w: 178, h: 214, dolly: 250 },
  { kind: "archive", label: "Archive", x: 420, y: 590, z: -320, w: 360, h: 220, dolly: 300 },
]);

// ---------------------------------------------------------------------------
// Room themes — the full visual identity of each space
// ---------------------------------------------------------------------------

/**
 * SOOMIN's room: a bedroom at night. Warm desk lamp as the key light, red LED
 * strip as the fill.
 *
 * The wall base is deliberately mid-tone rather than near-black. A genuinely
 * dark room renders as an unreadable void — real night photography holds a
 * wide tonal range and gets its darkness from contrast and grade, not from
 * crushing every value to zero.
 */
const NOCTURNE: RoomTheme = {
  name: "Nocturne",
  wall: "#2a2438",
  wallAccent: "#403656",
  floor: "#1a1624",
  light: { color: "#ffb86e", x: 0.46, y: 0.38, intensity: 1.02, fill: "#c1121f" },
  furniture: "#221c2c",
  furnitureEdge: "#6a5c82",
  ink: "#f2ebe0",
  inkSoft: "#9a90ae",
  grade: "linear-gradient(165deg, rgba(72,16,36,0.28), rgba(8,6,16,0.42))",
};

/** MINJI's room: full daylight, pastel, saturated. The opposite pole. */
const CONFETTI: RoomTheme = {
  name: "Confetti",
  wall: "#f7d0e2",
  wallAccent: "#fff0f6",
  floor: "#e8b4c6",
  light: { color: "#fff6e8", x: 0.1, y: 0.16, intensity: 1.38, fill: "#ff9ec8" },
  furniture: "#fff4f8",
  furnitureEdge: "#ffffff",
  ink: "#54203a",
  inkSoft: "#a06f88",
  grade: "linear-gradient(200deg, rgba(255,236,246,0.22), rgba(255,196,220,0.18))",
};

export const ROOMS: Room[] = [
  {
    id: id<RoomId>("room-soo"),
    ownerId: SOO,
    aesthetic: "nocturne",
    theme: NOCTURNE,
    zones: SOO_ZONES,
  },
  {
    id: id<RoomId>("room-minji"),
    ownerId: MINJI,
    aesthetic: "maximalist",
    theme: CONFETTI,
    zones: MINJI_ZONES,
  },
];

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

export const PROFILES: Profile[] = [
  {
    userId: SOO,
    tagline: "Stray Kids collector · Hyunjin bias",
    bio: "Completionist. I don't buy singles, I buy sets. Currently one card away from finishing ATE and it is ruining my life.",
    location: "Chicago",
    favoriteGroupIds: ["skz", "ive"].map(id<GroupId>),
    biasMemberIds: ["skz-hyunjin", "skz-felix", "ive-wonyoung"].map(id<MemberId>),
    favoriteEraIds: ["skz-ate", "skz-rockstar", "ive-lovedive"].map(id<EraId>),
    collectorType: "Completionist · era-focused",
    avatarColor: "#c1121f",
    avatarUrl: "/avatars/soo.png",
    roomId: id<RoomId>("room-soo"),
    appearance: { mode: "room-sync" },
  },
  {
    userId: MINJI,
    tagline: "IVE collector · Wonyoung bias",
    bio: "Pink everything. I collect by member, not by set — if Wonyoung is on it, it's coming home with me. Quietly also a Hyunjin girl.",
    location: "Seoul",
    favoriteGroupIds: ["ive", "skz", "aespa", "nwjns"].map(id<GroupId>),
    biasMemberIds: ["ive-wonyoung", "ive-rei", "skz-hyunjin"].map(id<MemberId>),
    favoriteEraIds: ["ive-switch", "ive-mine", "skz-ate"].map(id<EraId>),
    collectorType: "Bias-focused · aesthetic curator",
    avatarColor: "#e8567f",
    avatarUrl: "/avatars/minji.png",
    roomId: id<RoomId>("room-minji"),
    appearance: {
      mode: "custom",
      background: "warm-cream",
      primary: "powder-pink",
      secondary: "lavender",
      tint: "warm-cream",
    },
  },
];

export const FOLLOWS: Follow[] = [
  { followerId: MINJI, followeeId: SOO, createdAt: "2024-11-02" },
];

// ---------------------------------------------------------------------------
// Holdings
// ---------------------------------------------------------------------------

let holdingCounter = 0;

interface HoldingSeed {
  owner: UserId;
  templateId: string;
  zone: ZoneKind;
  slot: number;
  condition?: Condition;
  trade?: TradeStatus;
  acquiredAt?: string;
  source?: string;
  treasured?: boolean;
}

const HOLDINGS: Holding[] = [];
const PLACEMENTS = new Map<string, Placement[]>();

function own(seed: HoldingSeed): HoldingId {
  holdingCounter += 1;
  const hid = id<HoldingId>(`h-${holdingCounter}`);
  HOLDINGS.push({
    id: hid,
    ownerId: seed.owner,
    templateId: id<TemplateId>(seed.templateId),
    condition: seed.condition ?? "near-mint",
    tradeStatus: seed.trade ?? "not-for-trade",
    acquisition: {
      acquiredAt: seed.acquiredAt ?? "2024-08-01",
      ...(seed.source ? { source: seed.source } : {}),
    },
    ...(seed.treasured ? { treasured: true } : {}),
  });

  const roomId = seed.owner === SOO ? "room-soo" : "room-minji";
  const zoneId = `${roomId}-${seed.zone}`;
  const list = PLACEMENTS.get(roomId) ?? [];
  list.push({ holdingId: hid, zoneId: id<ZoneId>(zoneId), slot: seed.slot });
  PLACEMENTS.set(roomId, list);
  return hid;
}

/** Bulk helper for numbered photocard sets going into a binder. */
function ownCards(
  owner: UserId,
  setId: string,
  indices: number[],
  slotBase: number,
  opts?: { trade?: TradeStatus },
): void {
  indices.forEach((n, i) => {
    own({
      owner,
      templateId: `${setId}-pc-${n}`,
      zone: "binder",
      slot: slotBase + i,
      ...(opts?.trade ? { trade: opts.trade } : {}),
    });
  });
}

// --- SOOMIN ---------------------------------------------------------------
// Dense Stray Kids collection with a real IVE side-collection, which is what
// creates meaningful (not accidental) overlap with Minji.

// Shelf: albums, spine-out, left to right.
own({ owner: SOO, templateId: "t-v-ate-a", zone: "shelf", slot: 0, treasured: true, acquiredAt: "2024-07-22" });
own({ owner: SOO, templateId: "t-v-ate-b", zone: "shelf", slot: 1, acquiredAt: "2024-07-22" });
own({ owner: SOO, templateId: "t-v-rock-a", zone: "shelf", slot: 2, acquiredAt: "2023-11-14" });
own({ owner: SOO, templateId: "t-v-rock-b", zone: "shelf", slot: 3, acquiredAt: "2023-11-14" });
own({ owner: SOO, templateId: "t-v-max-a", zone: "shelf", slot: 4, acquiredAt: "2022-10-20" });
own({ owner: SOO, templateId: "t-v-odd-a", zone: "shelf", slot: 5, acquiredAt: "2022-04-02" });
own({ owner: SOO, templateId: "t-book-skz-photobook", zone: "shelf", slot: 6 });
own({ owner: SOO, templateId: "t-v-mine-a", zone: "shelf", slot: 7, acquiredAt: "2023-11-01" });
own({ owner: SOO, templateId: "t-v-dive-a", zone: "shelf", slot: 8, acquiredAt: "2024-01-18" });
own({ owner: SOO, templateId: "t-v-ate-vinyl", zone: "shelf", slot: 9, treasured: true, trade: "not-for-trade", acquiredAt: "2024-09-09" });

// Binder: 11 of 12 ATE cards. Card 12 is deliberately absent — it is the
// object the entire flagship interaction is built around.
ownCards(SOO, "set-ate", [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 0);
// A completed set, so the room already contains one example of what "done" looks like.
ownCards(SOO, "set-rockstar", [1, 2, 3, 4, 5, 6, 7, 8], 12);
// IVE cards — the overlap with Minji.
ownCards(SOO, "set-lovedive", [2, 4], 20, { trade: "for-trade" });
ownCards(SOO, "set-switch", [1, 3], 22, { trade: "open-to-offers" });

// Wall
own({ owner: SOO, templateId: "t-poster-ate", zone: "wall", slot: 0 });
own({ owner: SOO, templateId: "t-poster-rockstar", zone: "wall", slot: 1 });
own({ owner: SOO, templateId: "t-poster-hyunjin", zone: "wall", slot: 2, treasured: true, acquiredAt: "2023-12-24", source: "Fansign, Seoul" });

// Display case
own({ owner: SOO, templateId: "t-ls-skz", zone: "display-case", slot: 0, treasured: true });
own({ owner: SOO, templateId: "t-figure-hyunjin", zone: "display-case", slot: 1 });
own({ owner: SOO, templateId: "t-plush-skzoo-jiniret", zone: "display-case", slot: 2 });
own({ owner: SOO, templateId: "t-plush-skzoo-bbokari", zone: "display-case", slot: 3 });

// Desk
own({ owner: SOO, templateId: "t-mem-ate-ticket", zone: "desk", slot: 0 });
own({ owner: SOO, templateId: "t-mem-ate-band", zone: "desk", slot: 1 });

// Archive
own({ owner: SOO, templateId: "t-mem-fanclub", zone: "archive", slot: 0, trade: "not-for-trade" });
own({ owner: SOO, templateId: "t-apparel-skz-tour", zone: "archive", slot: 1 });

// --- MINJI ----------------------------------------------------------------
// Broader, shallower, bias-driven. Owns things Soo is hunting.

own({ owner: MINJI, templateId: "t-v-switch-a", zone: "shelf", slot: 0, acquiredAt: "2024-05-02" });
own({ owner: MINJI, templateId: "t-v-switch-b", zone: "shelf", slot: 1, treasured: true, acquiredAt: "2024-05-02" });
own({ owner: MINJI, templateId: "t-v-mine-a", zone: "shelf", slot: 2, acquiredAt: "2023-10-20" });
own({ owner: MINJI, templateId: "t-v-dive-a", zone: "shelf", slot: 3, acquiredAt: "2022-05-11" });
own({ owner: MINJI, templateId: "t-v-after-a", zone: "shelf", slot: 4, acquiredAt: "2022-09-03" });
own({ owner: MINJI, templateId: "t-book-ive-photobook", zone: "shelf", slot: 5 });
own({ owner: MINJI, templateId: "t-v-arma-a", zone: "shelf", slot: 6, acquiredAt: "2024-06-14" });
own({ owner: MINJI, templateId: "t-v-getup-a", zone: "shelf", slot: 7, acquiredAt: "2023-08-08" });
own({ owner: MINJI, templateId: "t-v-ate-a", zone: "shelf", slot: 8, acquiredAt: "2024-08-30" });

ownCards(MINJI, "set-switch", [1, 2, 3, 4, 5, 6], 0);
ownCards(MINJI, "set-lovedive", [1, 2, 3], 8, { trade: "for-trade" });
// Her Hyunjin soft spot. This is the overlap that makes the trade with Soo real
// rather than a coincidence, and it includes the card he's been hunting.
ownCards(MINJI, "set-ate", [1, 4, 12], 12, { trade: "open-to-offers" });
ownCards(MINJI, "set-rockstar", [1, 2], 16, { trade: "open-to-offers" });

own({ owner: MINJI, templateId: "t-poster-switch", zone: "wall", slot: 0 });
own({ owner: MINJI, templateId: "t-poster-wonyoung", zone: "wall", slot: 1, treasured: true });
own({ owner: MINJI, templateId: "t-poster-armageddon", zone: "wall", slot: 2 });

own({ owner: MINJI, templateId: "t-ls-ive", zone: "display-case", slot: 0, treasured: true });
own({ owner: MINJI, templateId: "t-figure-wonyoung", zone: "display-case", slot: 1 });
own({ owner: MINJI, templateId: "t-plush-ive-minive", zone: "display-case", slot: 2 });
own({ owner: MINJI, templateId: "t-plush-ive-rei", zone: "display-case", slot: 3 });
own({ owner: MINJI, templateId: "t-plush-skzoo-jiniret", zone: "display-case", slot: 4 });

own({ owner: MINJI, templateId: "t-mem-ive-ticket", zone: "desk", slot: 0 });
own({ owner: MINJI, templateId: "t-mem-ive-fanclub", zone: "archive", slot: 0 });
own({ owner: MINJI, templateId: "t-apparel-ive-hoodie", zone: "archive", slot: 1 });

export const HOLDINGS_FIXTURE = HOLDINGS;
export const PLACEMENTS_FIXTURE = PLACEMENTS;

// ---------------------------------------------------------------------------
// Wishlists — "hunting lists"
// ---------------------------------------------------------------------------

function want(
  userId: UserId,
  templateId: string,
  intensity: WishlistItem["intensity"],
  note?: string,
): WishlistItem {
  return {
    userId,
    templateId: id<TemplateId>(templateId),
    addedAt: "2025-01-12",
    intensity,
    ...(note ? { note } : {}),
  };
}

export const WISHLIST: WishlistItem[] = [
  // Soo is one card from finishing ATE. This is the emotional center of the demo.
  want(SOO, "set-ate-pc-12", 5, "Last card. Twelve of twelve. Please."),
  want(SOO, "set-switch-pc-6", 3, "Wonyoung blush foil"),
  want(SOO, "set-lovedive-pc-1", 2),
  want(SOO, "t-poster-switch", 2),
  want(SOO, "t-ls-ive", 1),

  // Minji wants things Soo actually owns, which is what makes the trade real.
  want(MINJI, "set-lovedive-pc-4", 5, "Venus POB — hunting for a year"),
  want(MINJI, "t-poster-hyunjin", 3),
  want(MINJI, "set-rockstar-pc-8", 2),
  want(MINJI, "t-v-ate-vinyl", 2),
];

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

function activity(
  aid: string,
  actorId: UserId,
  kind: Activity["kind"],
  createdAt: string,
  headline: string,
  templateIds: string[],
  detail?: string,
  setId?: string,
): Activity {
  return {
    id: id<ActivityId>(aid),
    actorId,
    kind,
    createdAt,
    headline,
    templateIds: templateIds.map(id<TemplateId>),
    ...(detail ? { detail } : {}),
    ...(setId ? { setId } : {}),
  };
}

export const ACTIVITY: Activity[] = [
  activity(
    "a-1",
    MINJI,
    "collection-completed",
    "2025-02-18",
    "completed the IVE SWITCH photocard set",
    ["set-switch-pc-6", "set-switch-pc-5", "set-switch-pc-4"],
    "6 of 6 — finished with the Wonyoung blush foil",
    "set-switch",
  ),
  activity(
    "a-2",
    MINJI,
    "grail-acquired",
    "2025-02-11",
    "found a grail",
    ["set-ate-pc-12"],
    "Hyunjin gold foil — open to offers",
  ),
  activity(
    "a-3",
    SOO,
    "items-added",
    "2025-02-04",
    "added 4 photocards",
    ["set-ate-pc-9", "set-ate-pc-10", "set-ate-pc-11", "set-lovedive-pc-2"],
    "ATE is at 11 of 12",
  ),
  activity(
    "a-4",
    MINJI,
    "room-redesigned",
    "2025-01-28",
    "redesigned their room",
    ["t-poster-wonyoung", "t-ls-ive"],
    "Moved the display case under the window",
  ),
  activity(
    "a-5",
    SOO,
    "hunting",
    "2025-01-20",
    "is hunting",
    ["set-ate-pc-12"],
    "One card from completing ATE",
  ),
  activity(
    "a-6",
    MINJI,
    "followed",
    "2024-11-02",
    "followed SOOMIN",
    [],
  ),
  activity(
    "a-7",
    SOO,
    "wishlist-updated",
    "2025-01-12",
    "updated their wishlist",
    ["set-ate-pc-12"],
    "Last card. Twelve of twelve.",
  ),
  activity(
    "a-8",
    MINJI,
    "furniture-added",
    "2025-01-28",
    "added furniture to their room",
    ["t-poster-wonyoung"],
    "Chair under the window, rug, photo string",
  ),
];
