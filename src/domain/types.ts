/**
 * Seoully domain model.
 *
 * Three-way split that everything else depends on:
 *
 *   CATALOG   — canonical facts about the world, shared by every user.
 *               "Photocard #12 from ATE, Hyunjin, Version A" exists whether
 *               or not anyone owns one.
 *
 *   HOLDINGS  — a specific user's specific copy, with condition, provenance,
 *               and trade intent.
 *
 *   PLACEMENT — where that copy physically lives inside that user's room.
 *
 * Compatibility scoring, trade matching, and the activity feed are all derived
 * from set operations over catalog ids, which is why the split matters.
 */

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export type GroupId = string & { readonly __brand: "GroupId" };
export type MemberId = string & { readonly __brand: "MemberId" };
export type EraId = string & { readonly __brand: "EraId" };
export type ReleaseId = string & { readonly __brand: "ReleaseId" };
export type ReleaseVersionId = string & { readonly __brand: "ReleaseVersionId" };
export type TemplateId = string & { readonly __brand: "TemplateId" };
export type HoldingId = string & { readonly __brand: "HoldingId" };
export type UserId = string & { readonly __brand: "UserId" };
export type RoomId = string & { readonly __brand: "RoomId" };
export type ZoneId = string & { readonly __brand: "ZoneId" };
export type ActivityId = string & { readonly __brand: "ActivityId" };

/** ISO-8601 date string. */
export type IsoDate = string;

// ---------------------------------------------------------------------------
// CATALOG
// ---------------------------------------------------------------------------

export interface Group {
  id: GroupId;
  name: string;
  /** Hangul or native-script name, shown as editorial detail. */
  nativeName?: string;
  debutYear: number;
  memberIds: MemberId[];
  /** Colors the fandom actually associates with the group. Drives room theming. */
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export interface Member {
  id: MemberId;
  groupId: GroupId;
  stageName: string;
  nativeName?: string;
  birthYear?: number;
  /** Accent color used when this member is someone's bias. */
  color: string;
}

/** A comeback / promotional cycle. The unit collectors actually think in. */
export interface Era {
  id: EraId;
  groupId: GroupId;
  name: string;
  year: number;
  /** Short editorial descriptor, e.g. "industrial, chrome, high-contrast". */
  mood: string;
  color: string;
}

export type ReleaseFormat = "album" | "single" | "ep" | "vinyl" | "dvd" | "photobook";

export interface Release {
  id: ReleaseId;
  groupId: GroupId;
  eraId: EraId;
  title: string;
  format: ReleaseFormat;
  releasedAt: IsoDate;
  trackCount: number;
  versionIds: ReleaseVersionId[];
}

export interface ReleaseVersion {
  id: ReleaseVersionId;
  releaseId: ReleaseId;
  /** e.g. "Version A", "Platform Ver.", "Limited". */
  name: string;
  /** Spine + cover treatment. Drives how it renders on the shelf. */
  spineColor: string;
  coverColor: string;
  coverAccent: string;
  /** Physical thickness in mm — feeds shelf layout and animation mass. */
  thicknessMm: number;
}

export type CollectibleKind =
  | "photocard"
  | "album"
  | "vinyl"
  | "poster"
  | "lightstick"
  | "plushie"
  | "figure"
  | "book"
  | "apparel"
  | "memorabilia";

export type Rarity = "common" | "uncommon" | "rare" | "grail";

/**
 * The canonical definition of a collectible. Two users owning "the same card"
 * own two Holdings pointing at one CollectibleTemplate — that shared id is what
 * makes compatibility and trade matching possible.
 */
export interface CollectibleTemplate {
  id: TemplateId;
  kind: CollectibleKind;
  name: string;
  groupId: GroupId;
  memberId?: MemberId;
  eraId?: EraId;
  releaseId?: ReleaseId;
  releaseVersionId?: ReleaseVersionId;
  rarity: Rarity;
  /** Position within a numbered set, e.g. card 7 of 12. */
  setIndex?: number;
  setSize?: number;
  /** Material the object is rendered with. Part of the design system. */
  material: MaterialName;
  /** Dominant colors, used to generate artwork procedurally for the prototype. */
  colorway: { base: string; accent: string; ink: string };
}

/** A numbered set a collector can complete — the emotional core of the product. */
export interface CollectibleSet {
  id: string;
  name: string;
  groupId: GroupId;
  eraId: EraId;
  templateIds: TemplateId[];
}

// ---------------------------------------------------------------------------
// HOLDINGS
// ---------------------------------------------------------------------------

export type Condition = "mint" | "near-mint" | "good" | "played" | "damaged";

export type TradeStatus =
  | "not-for-trade"
  | "open-to-offers"
  | "for-trade"
  | "for-sale";

export interface Acquisition {
  acquiredAt: IsoDate;
  /** Free-text provenance: "traded with @yuna", "Seoul, Myeongdong". */
  source?: string;
  note?: string;
}

/** One physical object owned by one user. */
export interface Holding {
  id: HoldingId;
  ownerId: UserId;
  templateId: TemplateId;
  condition: Condition;
  tradeStatus: TradeStatus;
  acquisition: Acquisition;
  /** Owner marked this as personally significant. Rendered differently. */
  treasured?: boolean;
}

export interface WishlistItem {
  userId: UserId;
  templateId: TemplateId;
  addedAt: IsoDate;
  /** 1 = idle want, 5 = actively hunting. Drives "current hunt" on the profile. */
  intensity: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

// ---------------------------------------------------------------------------
// PLACEMENT — where objects live in the room
// ---------------------------------------------------------------------------

export type ZoneKind =
  | "shelf"
  | "binder"
  | "display-case"
  | "wall"
  | "desk"
  | "archive";

/**
 * World-space transform. The room is a single continuous 3D scene; every zone
 * and object is positioned in these coordinates and the camera moves through
 * them. Units are CSS pixels at the world's base scale.
 */
export interface Transform3D {
  x: number;
  y: number;
  z: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
}

/**
 * Where the camera parks when a zone is focused.
 *
 * (x, y, z) is the world point the camera centers on — not the camera's own
 * position. `dolly` is how far forward the camera sits from that point, which
 * is what actually controls apparent scale. Expressing it this way means a
 * zone author only has to say "look at this thing, from about this far" rather
 * than solving for a transform.
 */
export interface CameraDock {
  x: number;
  y: number;
  z: number;
  /** Distance forward from the look-at point. Larger = closer to the object. */
  dolly: number;
  rotateX?: number;
  rotateY?: number;
}

export interface RoomZone {
  id: ZoneId;
  roomId: RoomId;
  kind: ZoneKind;
  label: string;
  transform: Transform3D;
  dock: CameraDock;
  /** Width/height of the zone's footprint in world units. */
  size: { w: number; h: number };
}

/** Binds a holding to a physical slot inside a zone. */
export interface Placement {
  holdingId: HoldingId;
  zoneId: ZoneId;
  /** Ordinal slot within the zone (shelf position, binder pocket, wall cell). */
  slot: number;
  /** Per-object offset from the slot's default, for hand-arranged rooms. */
  offset?: Partial<Transform3D>;
}

export type RoomAesthetic = "warm-analog" | "editorial-gallery" | "maximalist" | "nocturne";

export interface Room {
  id: RoomId;
  ownerId: UserId;
  aesthetic: RoomAesthetic;
  /** Overrides the aesthetic's default theme. Set by the collector. */
  theme: RoomTheme;
  zones: RoomZone[];
}

/**
 * A room's full visual identity. Every surface color in the scene derives from
 * this, which is what makes two collectors' rooms feel genuinely different
 * rather than reskinned.
 */
export interface RoomTheme {
  name: string;
  /** Ambient environment. */
  wall: string;
  wallAccent: string;
  floor: string;
  /** The room's key light — position drives shading across every material. */
  light: {
    color: string;
    /** Normalized position of the light source within the room, 0..1. */
    x: number;
    y: number;
    intensity: number;
    /** Secondary colored fill, e.g. a red LED strip or a pink window. */
    fill: string;
  };
  /** Furniture surfaces. */
  furniture: string;
  furnitureEdge: string;
  /** Text and UI ink that sits inside the world. */
  ink: string;
  inkSoft: string;
  /** Overall grade applied to the scene. */
  grade: string;
}

// ---------------------------------------------------------------------------
// MATERIALS — part of the design system, referenced by domain data
// ---------------------------------------------------------------------------

export type MaterialName =
  | "paper"
  | "matte-card"
  | "glossy-card"
  | "holo-foil"
  | "vinyl"
  | "acrylic"
  | "brushed-metal"
  | "velvet"
  | "photo-print"
  | "plastic-sleeve"
  | "warm-wood"
  | "plush";

// ---------------------------------------------------------------------------
// SOCIAL
// ---------------------------------------------------------------------------

export interface User {
  id: UserId;
  handle: string;
  displayName: string;
  joinedAt: IsoDate;
}

export interface Profile {
  userId: UserId;
  /** One-line self-description shown under the name. */
  tagline: string;
  bio: string;
  location?: string;
  favoriteGroupIds: GroupId[];
  biasMemberIds: MemberId[];
  favoriteEraIds: EraId[];
  /** Editorial descriptor of collecting style, e.g. "completionist, era-focused". */
  collectorType: string;
  avatarColor: string;
  roomId: RoomId;
}

export interface Follow {
  followerId: UserId;
  followeeId: UserId;
  createdAt: IsoDate;
}

export type ActivityKind =
  | "collection-completed"
  | "items-added"
  | "room-redesigned"
  | "grail-acquired"
  | "hunting"
  | "joined";

/**
 * Feed entries are derived from holding/placement events rather than authored
 * posts, which is what keeps the feed tied to the collection graph.
 */
export interface Activity {
  id: ActivityId;
  actorId: UserId;
  kind: ActivityKind;
  createdAt: IsoDate;
  /** Templates involved, for rendering the actual objects in the feed. */
  templateIds: TemplateId[];
  setId?: string;
  headline: string;
  detail?: string;
}

/** Computed, never stored. Pure function of two users' holdings and wants. */
export interface CollectionCompatibility {
  userA: UserId;
  userB: UserId;
  /** 0..100 */
  score: number;
  sharedGroupIds: GroupId[];
  sharedMemberIds: MemberId[];
  sharedTemplateIds: TemplateId[];
  /** They own these, A wants them. */
  theyOwnYourWants: TemplateId[];
  /** A owns these, they want them. */
  youOwnTheirWants: TemplateId[];
  /** Short human-readable reasons, ordered by strength. */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Derived read models the UI consumes
// ---------------------------------------------------------------------------

/** A holding joined with its template — what components actually render. */
export interface HoldingView {
  holding: Holding;
  template: CollectibleTemplate;
  group: Group;
  member?: Member;
  era?: Era;
  release?: Release;
  version?: ReleaseVersion;
}

export interface SetProgress {
  set: CollectibleSet;
  ownedTemplateIds: TemplateId[];
  missingTemplateIds: TemplateId[];
  owned: number;
  total: number;
  complete: boolean;
}

export interface CollectionStats {
  totalItems: number;
  photocards: number;
  albums: number;
  vinyl: number;
  posters: number;
  memorabilia: number;
  grails: number;
  completedSets: number;
  trackedSets: number;
}
