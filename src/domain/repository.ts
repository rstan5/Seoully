import type {
  Activity,
  CollectibleSet,
  CollectibleTemplate,
  CollectionCompatibility,
  CollectionStats,
  Era,
  Group,
  Holding,
  HoldingView,
  Member,
  Placement,
  Profile,
  Release,
  ReleaseVersion,
  Room,
  RoomId,
  SetProgress,
  TemplateId,
  User,
  UserId,
  WishlistItem,
  ZoneId,
} from "./types";

/**
 * Every read the UI performs goes through this interface. The prototype backs
 * it with in-memory fixtures; swapping in Postgres later should not require
 * touching a single component.
 *
 * Methods are synchronous here deliberately — see MemoryCollectionRepository
 * for the note on how this evolves to async without a UI rewrite.
 */
export interface CollectionRepository {
  // Catalog
  getGroup(id: string): Group | undefined;
  getMember(id: string): Member | undefined;
  getEra(id: string): Era | undefined;
  getRelease(id: string): Release | undefined;
  getReleaseVersion(id: string): ReleaseVersion | undefined;
  getTemplate(id: string): CollectibleTemplate | undefined;
  getSet(id: string): CollectibleSet | undefined;

  // Social
  getUser(id: UserId): User | undefined;
  getUserByHandle(handle: string): User | undefined;
  getProfile(userId: UserId): Profile | undefined;
  listUsers(): User[];
  listFollowing(userId: UserId): UserId[];

  // Holdings
  listHoldings(userId: UserId): Holding[];
  listHoldingViews(userId: UserId): HoldingView[];
  getHoldingView(holdingId: string): HoldingView | undefined;
  listWishlist(userId: UserId): WishlistItem[];

  // Placement
  getRoom(roomId: RoomId): Room | undefined;
  getRoomByOwner(userId: UserId): Room | undefined;
  listPlacements(roomId: RoomId): Placement[];
  listPlacementsInZone(roomId: RoomId, zoneId: ZoneId): Placement[];

  // Derived
  getSetProgress(userId: UserId, setId: string): SetProgress | undefined;
  listSetProgress(userId: UserId): SetProgress[];
  getStats(userId: UserId): CollectionStats;
  getCompatibility(a: UserId, b: UserId): CollectionCompatibility;

  // Feed
  listActivity(viewerId: UserId): Activity[];

  // Mutations the prototype needs (the flagship "add a photocard" flow)
  addHolding(input: {
    ownerId: UserId;
    templateId: TemplateId;
    zoneId: ZoneId;
    slot: number;
  }): Holding;
}
