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
export type PostId = string & { readonly __brand: "PostId" };
export type CommentId = string & { readonly __brand: "CommentId" };
export type MessageId = string & { readonly __brand: "MessageId" };
export type ThreadId = string & { readonly __brand: "ThreadId" };
export type NoticeId = string & { readonly __brand: "NoticeId" };
export type DecorId = string & { readonly __brand: "DecorId" };
export type RoomObjectId = string & { readonly __brand: "RoomObjectId" };

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
  /**
   * Local photo from add-collectible. Existing fixture art stays procedural.
   * Cloud storage can replace this URL later without changing callers.
   */
  imageUrl?: string;
  /**
   * Optional catalog estimate. Never shown as a hard fact — ownership and
   * value stay separate, and this remains fixture data until a real source exists.
   */
  estimatedValue?: { amount: number; currency: "USD"; asOf: IsoDate };
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
  /** Durable production Holding id for authenticated-user projections. */
  productionId?: string;
  ownerId: UserId;
  templateId: TemplateId;
  condition: Condition;
  tradeStatus: TradeStatus;
  acquisition: Acquisition;
  /** Owner marked this as personally significant. Rendered differently. */
  treasured?: boolean;
  notes?: string;
  acquisitionPrice?: number;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
  /** Signed URL for the owner's current personal media, when hydrated. */
  personalMediaUrl?: string;
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

/** Binds a holding to a physical slot inside a zone — or frees it into the room. */
export interface Placement {
  holdingId: HoldingId;
  zoneId: ZoneId;
  /** Ordinal slot within the zone (shelf position, binder pocket, wall cell). */
  slot: number;
  /** Per-object offset from the slot's default, used until the item is freed. */
  offset?: Partial<Transform3D>;
  /**
   * World-space pose. When set, the holding is no longer packed into a zone —
   * it lives on the room canvas like furniture.
   */
  transform?: Transform3D;
  /** Nearby landing plane at last settle. Context, not a lock. */
  surfaceId?: string;
}

/**
 * Where a room object can sit. Collection zones plus the floor plane —
 * rugs, chairs, plants, and lamps live on the floor, not in a collection bay.
 */
export type RoomMount = ZoneKind | "floor";

export type DecorCategory =
  | "lighting"
  | "furniture"
  | "plant"
  | "wall"
  | "floor"
  | "audio"
  | "storage"
  | "display";

export type DecorMount = "floor" | "wall" | "surface";

/**
 * A catalog asset that can live in a room.
 *
 * Shop-shaped on purpose: rarity, price, and owned are here so a store can
 * attach later without a second object model. The prototype treats every
 * asset as owned.
 */
export interface DecorAsset {
  id: DecorId;
  name: string;
  category: DecorCategory;
  material: MaterialName;
  mount: DecorMount;
  size: { w: number; h: number; d?: number };
  rarity: Rarity;
  /** Starter catalog vs future themed/premium packs. */
  tier: "foundation" | "premium";
  /** Optional collection key for future themed packs. */
  theme?: string;
  /** Future shop. Unused in this phase. */
  price?: number;
  currency?: "coin";
  owned: boolean;
}

/**
 * One placed (or stored) instance of a decor asset in a specific room.
 *
 * Distinct from Placement: a holding is a collectible that happens to occupy
 * space; a RoomObject is furniture. Storing either removes it from the room
 * without destroying ownership.
 */
export interface RoomObject {
  id: RoomObjectId;
  roomId: RoomId;
  assetId: DecorId;
  zone: RoomMount;
  transform: Transform3D;
  layer?: number;
  stored?: boolean;
  /** Nearby landing plane at last settle. Context, not a lock. */
  surfaceId?: string;
}

/** Serializable room arrangement — placements + decor. Shareable later. */
export interface RoomLayout {
  placements: Placement[];
  objects: RoomObject[];
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

export type CollectorInterest =
  | "albums"
  | "photocards"
  | "merch"
  | "vinyl"
  | "posters"
  | "lightsticks"
  | "everything";

export type ProfileThemeMode = "default" | "custom" | "room-sync";

export type ProfileBackgroundPreset =
  | "paper"
  | "warm-cream"
  | "soft-lavender"
  | "powder-pink"
  | "baby-blue"
  | "mint"
  | "peach"
  | "soft-gray"
  | "deep-navy"
  | "midnight-purple"
  | "dark-plum"
  | "charcoal";

export type ProfileAccentPreset =
  | "lavender"
  | "lilac"
  | "powder-pink"
  | "baby-blue"
  | "mint"
  | "peach"
  | "rose"
  | "periwinkle"
  | "plum"
  | "deep-blue"
  | "warm-cream"
  | "soft-lilac";

/** Saved appearance. Missing means Seoully Default. */
export interface ProfileThemeChoice {
  mode: ProfileThemeMode;
  background?: ProfileBackgroundPreset;
  primary?: ProfileAccentPreset;
  secondary?: ProfileAccentPreset;
  /** @deprecated Prefer `background`. Still read for older live snapshots. */
  tint?: ProfileAccentPreset;
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
  collectorInterests?: CollectorInterest[];
  /** Editorial descriptor of collecting style, e.g. "completionist, era-focused". */
  collectorType: string;
  avatarColor: string;
  /**
   * Portrait. A URL now (fixture, local blob, or later CDN). The profile never
   * generates this itself, so swapping storage is a data change only.
   */
  avatarUrl?: string;
  roomId: RoomId;
  appearance?: ProfileThemeChoice;
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
  | "joined"
  | "followed"
  | "wishlist-updated"
  | "furniture-added";

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
  /** Declared biases both collectors named. */
  sharedBiasIds: MemberId[];
  /** Members both actually own. Not the same as a declared bias. */
  sharedMemberIds: MemberId[];
  sharedInterestIds: CollectorInterest[];
  sharedTemplateIds: TemplateId[];
  /** They own these, A wants them. */
  theyOwnYourWants: TemplateId[];
  /** A owns these, they want them. */
  youOwnTheirWants: TemplateId[];
  /** Same as theyOwnYourWants — they own something on your wishlist. */
  wishlistMatches: TemplateId[];
  /** Same as youOwnTheirWants — you own something they want. */
  reciprocalMatches: TemplateId[];
  sharedEraIds: EraId[];
  /**
   * Collectibles involved when both directions are true.
   * Not created by trade status or room placement.
   */
  potentialTradeMatches: TemplateId[];
  /** Alias of potentialTradeMatches for existing callers. */
  potentialTrades: TemplateId[];
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

export type PostKind =
  | "note"
  | "haul"
  | "completion"
  | "room"
  | "hunt"
  | "life"
  | "concert"
  | "travel"
  | "event";

export type PostMediaKind = "photo" | "video";

/** A photo or video on a post. URLs are local fixtures now, CDN later. */
export interface PostMedia {
  kind: PostMediaKind;
  url: string;
  /** Poster frame for video posts. */
  poster?: string;
  alt?: string;
  duration?: string;
}

/**
 * Authored expression, as opposed to Activity which is derived from collection
 * events. A post can still *show* objects — that's what keeps it from becoming
 * a caption under a selfie.
 */
export interface Post {
  id: PostId;
  authorId: UserId;
  kind: PostKind;
  createdAt: IsoDate;
  body: string;
  templateIds: TemplateId[];
  media?: PostMedia[];
  location?: string;
  taggedUserIds?: UserId[];
  /** Shared catalog references mentioned in the post; independent of holdings. */
  taggedTemplateIds?: TemplateId[];
  /** Present when this post is a repost of someone else's. */
  repostOf?: PostId;
}

export interface PostLike {
  postId: PostId;
  userId: UserId;
}

export interface PostComment {
  id: CommentId;
  postId: PostId;
  authorId: UserId;
  body: string;
  createdAt: IsoDate;
}

export type NoticeKind = "like" | "comment" | "follow" | "trade" | "activity" | "repost";

/** Local, in-app notices — not a push-notification product. */
export interface Notice {
  id: NoticeId;
  recipientId: UserId;
  kind: NoticeKind;
  actorId: UserId;
  createdAt: IsoDate;
  headline: string;
  postId?: PostId;
  templateIds?: TemplateId[];
  read?: boolean;
}

export type SearchKind = "collector" | "group" | "member" | "album" | "photocard" | "room";

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle?: string;
  userId?: UserId;
  templateId?: TemplateId;
}

export interface GroupCollectionSlice {
  groupId: GroupId;
  name: string;
  count: number;
  sampleIds: TemplateId[];
}

export interface Message {
  id: MessageId;
  threadId: ThreadId;
  senderId: UserId;
  createdAt: IsoDate;
  body: string;
  templateIds?: TemplateId[];
  postId?: PostId;
}

export interface Thread {
  id: ThreadId;
  participantIds: [UserId, UserId];
  /** Collectibles the composer should attach until the conversation changes. */
  pendingTemplateIds?: TemplateId[];
}

// ---------------------------------------------------------------------------
// Session, media, identification — product foundation
// ---------------------------------------------------------------------------

/** Auth sessions are resolved server-side; only demo fixture identity is persisted locally. */
export type Session =
  | { kind: "none" }
  | { kind: "demo"; userId: UserId }
  | { kind: "local"; userId: UserId }
  | { kind: "auth"; userId: UserId };

export interface MediaRef {
  id: string;
  kind: "image" | "video";
  url: string;
  source: "fixture" | "local" | "remote";
}

export interface IdentificationCandidate {
  templateId: TemplateId;
  /** Server-resolved catalog id; never supplied by the vision model. */
  productionTemplateId?: string;
  confidence: number;
  groupId: GroupId;
  memberId?: MemberId;
  eraId?: EraId;
  releaseId?: ReleaseId;
  releaseVersionId?: ReleaseVersionId;
  kind: CollectibleKind;
  reason: string;
}

export interface IdentificationInput {
  image?: MediaRef;
  filename?: string;
  favoriteGroupIds?: GroupId[];
}
