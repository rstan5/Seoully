import type {
  Activity,
  CollectibleSet,
  CollectibleTemplate,
  CollectionCompatibility,
  CollectionStats,
  DecorAsset,
  DecorId,
  Era,
  Group,
  GroupCollectionSlice,
  Holding,
  HoldingId,
  HoldingView,
  Member,
  Message,
  Notice,
  Placement,
  Post,
  PostComment,
  Profile,
  Release,
  ReleaseVersion,
  Room,
  RoomId,
  RoomLayout,
  RoomMount,
  RoomObject,
  RoomObjectId,
  SearchHit,
  SetProgress,
  TemplateId,
  Thread,
  Transform3D,
  User,
  UserId,
  WishlistItem,
  ZoneId,
} from "./types";
import type { CatalogDraft, CatalogMatch } from "./catalog-match";
import type { MatchRelation } from "./compatibility";
import type { IdentityBeat, OnboardingProgress } from "./onboarding";
import type { IdentityProfileDTO } from "./identity";

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
  listGroups(): Group[];
  listMembers(groupId?: string): Member[];
  listEras(groupId?: string): Era[];
  listReleases(groupId?: string): Release[];
  listTemplates(): CollectibleTemplate[];
  searchCatalog(query: string): CollectibleTemplate[];
  adoptProductionCatalogTemplate(input: {
    id: string;
    name: string;
    kind: CollectibleTemplate["kind"];
    groupName: string;
    memberName?: string | null;
    releaseName?: string | null;
    descriptor?: string;
  }): TemplateId | undefined;
  findCatalogMatches(draft: CatalogDraft): CatalogMatch[];
  createCatalogItem(draft: CatalogDraft): CollectibleTemplate;

  // Identity
  createIdentity(input: {
    handle: string;
    displayName: string;
    userId?: UserId;
    allowHandleCollision?: boolean;
  }): { user: User; profile: Profile; room: Room } | { error: string };
  /** Transitional render projection; production identity data is server-authoritative. */
  adoptAuthenticatedIdentity(input: IdentityProfileDTO): void;
  updateProfile(
    userId: UserId,
    patch: Partial<
      Pick<
        Profile,
        | "bio"
        | "tagline"
        | "location"
        | "avatarUrl"
        | "avatarColor"
        | "favoriteGroupIds"
        | "biasMemberIds"
        | "favoriteEraIds"
        | "collectorInterests"
        | "collectorType"
        | "appearance"
      >
    > & { displayName?: string; handle?: string; joinedAt?: string },
  ): void;

  // Social
  getUser(id: UserId): User | undefined;
  getUserByHandle(handle: string): User | undefined;
  getProfile(userId: UserId): Profile | undefined;
  listUsers(): User[];
  listFollowing(userId: UserId): UserId[];
  listFollowers(userId: UserId): UserId[];
  isFollowing(followerId: UserId, followeeId: UserId): boolean;
  follow(followerId: UserId, followeeId: UserId): void;
  unfollow(followerId: UserId, followeeId: UserId): void;
  listPosts(authorId: UserId): Post[];
  listAllPosts(): Post[];
  getPost(postId: Post["id"]): Post | undefined;
  listPostsAbout(userId: UserId, templateId: TemplateId): Post[];
  likePost(userId: UserId, postId: Post["id"]): void;
  unlikePost(userId: UserId, postId: Post["id"]): void;
  isLiked(userId: UserId, postId: Post["id"]): boolean;
  likeCount(postId: Post["id"]): number;
  sharePost(userId: UserId, postId: Post["id"]): void;
  shareCount(postId: Post["id"]): number;
  listComments(postId: Post["id"]): PostComment[];
  addComment(input: { postId: Post["id"]; authorId: UserId; body: string }): PostComment;
  createPost(input: {
    authorId: UserId;
    body: string;
    kind?: Post["kind"];
    media?: Post["media"];
    templateIds?: TemplateId[];
    taggedUserIds?: UserId[];
    taggedTemplateIds?: TemplateId[];
    location?: string;
    repostOf?: Post["id"];
  }): Post;
  repostPost(userId: UserId, postId: Post["id"]): Post | undefined;
  unrepostPost(userId: UserId, postId: Post["id"]): void;
  hasReposted(userId: UserId, postId: Post["id"]): boolean;
  savePost(userId: UserId, postId: Post["id"]): void;
  unsavePost(userId: UserId, postId: Post["id"]): void;
  isSaved(userId: UserId, postId: Post["id"]): boolean;
  listCameraRoll(): NonNullable<Post["media"]>;
  isThreadUnread(threadId: Thread["id"], userId: UserId): boolean;
  markThreadRead(threadId: Thread["id"]): void;
  getThread(a: UserId, b: UserId): Thread | undefined;
  getOrCreateThread(a: UserId, b: UserId): Thread;
  listThreads(userId: UserId): Thread[];
  listMessages(threadId: Thread["id"]): Message[];
  sendMessage(input: {
    senderId: UserId;
    recipientId: UserId;
    body: string;
    templateIds?: TemplateId[];
    postId?: Post["id"];
  }): Message;
  setThreadAbout(threadId: Thread["id"], templateIds: TemplateId[]): void;
  search(query: string): SearchHit[];
  getCollectionIdentity(userId: UserId): GroupCollectionSlice[];
  listOwners(templateId: TemplateId): UserId[];
  listNotices(userId: UserId): Notice[];
  unreadNoticeCount(userId: UserId): number;
  markNoticesRead(userId: UserId): void;

  /** In-memory mutation signal. A networked implementation can no-op this. */
  subscribe(listener: () => void): () => void;
  revision(): number;

  // Holdings
  listHoldings(userId: UserId): Holding[];
  listHoldingViews(userId: UserId): HoldingView[];
  getHoldingView(holdingId: string): HoldingView | undefined;
  listWishlist(userId: UserId): WishlistItem[];
  replaceWishlist(userId: UserId, templateIds: TemplateId[]): void;
  addToWishlist(userId: UserId, templateId: TemplateId): void;
  removeFromWishlist(userId: UserId, templateId: TemplateId): void;
  isWanted(userId: UserId, templateId: TemplateId): boolean;
  removeHolding(holdingId: HoldingId): void;
  setHoldingTradeStatus(holdingId: HoldingId, tradeStatus: "not-for-trade" | "for-trade"): void;
  setHoldingPersonalMedia(holdingId: HoldingId, url?: string): void;

  // Placement
  getRoom(roomId: RoomId): Room | undefined;
  getRoomByOwner(userId: UserId): Room | undefined;
  listPlacements(roomId: RoomId): Placement[];
  listPlacementsInZone(roomId: RoomId, zoneId: ZoneId): Placement[];
  movePlacement(
    roomId: RoomId,
    holdingId: HoldingId,
    patch: {
      zoneId?: ZoneId;
      slot?: number;
      offset?: Partial<Transform3D>;
      transform?: Transform3D;
      surfaceId?: string;
    },
  ): void;
  storePlacement(roomId: RoomId, holdingId: HoldingId): void;
  restorePlacement(
    roomId: RoomId,
    holdingId: HoldingId,
    transform: Transform3D,
    surfaceId?: string,
  ): void;
  listStoredHoldings(userId: UserId): HoldingView[];

  // Room decor
  listDecorCatalog(): DecorAsset[];
  getDecorAsset(id: DecorId): DecorAsset | undefined;
  listRoomObjects(roomId: RoomId): RoomObject[];
  listStoredDecor(roomId: RoomId): RoomObject[];
  placeDecor(
    roomId: RoomId,
    assetId: DecorId,
    zone: RoomMount,
    transform: Transform3D,
    surfaceId?: string,
  ): RoomObject;
  moveRoomObject(
    id: RoomObjectId,
    patch: { zone?: RoomMount; transform?: Partial<Transform3D>; surfaceId?: string },
  ): void;
  storeRoomObject(id: RoomObjectId): void;
  restoreRoomObject(
    id: RoomObjectId,
    transform?: Transform3D,
    patch?: { zone?: RoomMount; surfaceId?: string },
  ): void;

  // Arrangement history
  canUndoRoom(roomId: RoomId): boolean;
  canRedoRoom(roomId: RoomId): boolean;
  undoRoom(roomId: RoomId): void;
  redoRoom(roomId: RoomId): void;
  /** Replaces only production-backed collectible placements after server hydration. */
  replaceProductionPlacements(roomId: RoomId, placements: Placement[]): void;
  exportRoomLayout(roomId: RoomId): RoomLayout;

  // Derived
  getSetProgress(userId: UserId, setId: string): SetProgress | undefined;
  listSetProgress(userId: UserId): SetProgress[];
  getStats(userId: UserId): CollectionStats;
  getCompatibility(a: UserId, b: UserId): CollectionCompatibility;
  getCollectionCompatibility(viewerId: UserId, otherId: UserId): CollectionCompatibility;
  getMatchRelation(viewerId: UserId, otherId: UserId, templateId: TemplateId): MatchRelation;

  // Feed
  listActivity(viewerId: UserId): Activity[];

  // Mutations the prototype needs (the flagship "add a photocard" flow)
  addHolding(input: {
    ownerId: UserId;
    templateId: TemplateId;
    productionId?: string;
    zoneId?: ZoneId;
    slot?: number;
    condition?: Holding["condition"];
  }): Holding;

  /** Live-user overlay plus fixture room layouts. */
  hydrate(): void;
  /** Re-read live persistence if the in-memory copy lost a local user. */
  rehydrateLive(): void;
  onboardingState(userId: UserId): OnboardingProgress;
  markIdentityBeat(userId: UserId, beat: IdentityBeat): void;
  markProfileComplete(userId: UserId): void;
  markFirstHoldingComplete(userId: UserId): void;
  markRoomIntroduced(userId: UserId): void;
  markFirstSessionComplete(userId: UserId): void;
}
