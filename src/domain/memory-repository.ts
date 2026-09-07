import { computeCompatibility, type CompatibilityInput } from "./compatibility";
import {
  ERA_BY_ID,
  GROUP_BY_ID,
  MEMBER_BY_ID,
  RELEASE_BY_ID,
  SETS,
  SET_BY_ID,
  TEMPLATE_BY_ID,
  VERSION_BY_ID,
} from "./fixtures/catalog";
import {
  ACTIVITY,
  FOLLOWS,
  HOLDINGS_FIXTURE,
  PLACEMENTS_FIXTURE,
  PROFILES,
  ROOMS,
  USERS,
  WISHLIST,
} from "./fixtures/collectors";
import type { CollectionRepository } from "./repository";
import type {
  Activity,
  CollectibleSet,
  CollectibleTemplate,
  CollectionCompatibility,
  CollectionStats,
  Era,
  Group,
  GroupId,
  Holding,
  HoldingId,
  HoldingView,
  Member,
  MemberId,
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
 * In-memory repository over the fixtures.
 *
 * Methods are synchronous, which is a deliberate simplification for the
 * prototype. When this is replaced by a real backend, the intended migration
 * is to keep this class as the client-side cache and make the *loading* async
 * at the route boundary, so components keep reading synchronously from a
 * hydrated store. That avoids sprinkling `await` and loading states through a
 * scene graph where a spinner would break the illusion of a physical room.
 */
export class MemoryCollectionRepository implements CollectionRepository {
  private holdings: Holding[] = [...HOLDINGS_FIXTURE];
  private placements = new Map<string, Placement[]>(
    [...PLACEMENTS_FIXTURE].map(([k, v]) => [k, [...v]]),
  );
  private wishlist: WishlistItem[] = [...WISHLIST];
  private nextHoldingId = HOLDINGS_FIXTURE.length + 1;

  // --- Catalog ------------------------------------------------------------

  getGroup(id: string): Group | undefined {
    return GROUP_BY_ID.get(id);
  }
  getMember(id: string): Member | undefined {
    return MEMBER_BY_ID.get(id);
  }
  getEra(id: string): Era | undefined {
    return ERA_BY_ID.get(id);
  }
  getRelease(id: string): Release | undefined {
    return RELEASE_BY_ID.get(id);
  }
  getReleaseVersion(id: string): ReleaseVersion | undefined {
    return VERSION_BY_ID.get(id);
  }
  getTemplate(id: string): CollectibleTemplate | undefined {
    return TEMPLATE_BY_ID.get(id);
  }
  getSet(id: string): CollectibleSet | undefined {
    return SET_BY_ID.get(id);
  }

  // --- Social -------------------------------------------------------------

  getUser(id: UserId): User | undefined {
    return USERS.find((u) => u.id === id);
  }
  getUserByHandle(handle: string): User | undefined {
    return USERS.find((u) => u.handle === handle);
  }
  getProfile(userId: UserId): Profile | undefined {
    return PROFILES.find((p) => p.userId === userId);
  }
  listUsers(): User[] {
    return USERS;
  }
  listFollowing(userId: UserId): UserId[] {
    return FOLLOWS.filter((f) => f.followerId === userId).map((f) => f.followeeId);
  }

  // --- Holdings -----------------------------------------------------------

  listHoldings(userId: UserId): Holding[] {
    return this.holdings.filter((h) => h.ownerId === userId);
  }

  listHoldingViews(userId: UserId): HoldingView[] {
    return this.listHoldings(userId)
      .map((h) => this.toView(h))
      .filter((v): v is HoldingView => v !== undefined);
  }

  getHoldingView(holdingId: string): HoldingView | undefined {
    const holding = this.holdings.find((h) => h.id === holdingId);
    return holding ? this.toView(holding) : undefined;
  }

  private toView(holding: Holding): HoldingView | undefined {
    const template = TEMPLATE_BY_ID.get(holding.templateId);
    if (!template) return undefined;
    const group = GROUP_BY_ID.get(template.groupId);
    if (!group) return undefined;

    const view: HoldingView = { holding, template, group };
    const member = template.memberId ? MEMBER_BY_ID.get(template.memberId) : undefined;
    const era = template.eraId ? ERA_BY_ID.get(template.eraId) : undefined;
    const release = template.releaseId ? RELEASE_BY_ID.get(template.releaseId) : undefined;
    const version = template.releaseVersionId
      ? VERSION_BY_ID.get(template.releaseVersionId)
      : undefined;
    if (member) view.member = member;
    if (era) view.era = era;
    if (release) view.release = release;
    if (version) view.version = version;
    return view;
  }

  listWishlist(userId: UserId): WishlistItem[] {
    return this.wishlist
      .filter((w) => w.userId === userId)
      .sort((a, b) => b.intensity - a.intensity);
  }

  // --- Placement ----------------------------------------------------------

  getRoom(roomId: RoomId): Room | undefined {
    return ROOMS.find((r) => r.id === roomId);
  }
  getRoomByOwner(userId: UserId): Room | undefined {
    return ROOMS.find((r) => r.ownerId === userId);
  }
  listPlacements(roomId: RoomId): Placement[] {
    return this.placements.get(roomId) ?? [];
  }
  listPlacementsInZone(roomId: RoomId, zoneId: ZoneId): Placement[] {
    return this.listPlacements(roomId)
      .filter((p) => p.zoneId === zoneId)
      .sort((a, b) => a.slot - b.slot);
  }

  // --- Derived ------------------------------------------------------------

  getSetProgress(userId: UserId, setId: string): SetProgress | undefined {
    const set = SET_BY_ID.get(setId);
    if (!set) return undefined;
    const owned = new Set(this.listHoldings(userId).map((h) => h.templateId as string));
    const ownedTemplateIds = set.templateIds.filter((t) => owned.has(t));
    const missingTemplateIds = set.templateIds.filter((t) => !owned.has(t));
    return {
      set,
      ownedTemplateIds,
      missingTemplateIds,
      owned: ownedTemplateIds.length,
      total: set.templateIds.length,
      complete: missingTemplateIds.length === 0,
    };
  }

  listSetProgress(userId: UserId): SetProgress[] {
    return SETS.map((s) => this.getSetProgress(userId, s.id))
      .filter((p): p is SetProgress => p !== undefined && p.owned > 0)
      .sort((a, b) => b.owned / b.total - a.owned / a.total);
  }

  getStats(userId: UserId): CollectionStats {
    const views = this.listHoldingViews(userId);
    const count = (kind: CollectibleTemplate["kind"]) =>
      views.filter((v) => v.template.kind === kind).length;
    const progress = this.listSetProgress(userId);
    return {
      totalItems: views.length,
      photocards: count("photocard"),
      albums: count("album"),
      vinyl: count("vinyl"),
      posters: count("poster"),
      memorabilia: count("memorabilia"),
      grails: views.filter((v) => v.template.rarity === "grail").length,
      completedSets: progress.filter((p) => p.complete).length,
      trackedSets: progress.length,
    };
  }

  getCompatibility(a: UserId, b: UserId): CollectionCompatibility {
    return computeCompatibility(this.compatInput(a), this.compatInput(b), {
      template: (id) => TEMPLATE_BY_ID.get(id),
      groupName: (id: GroupId) => GROUP_BY_ID.get(id)?.name ?? "—",
      memberName: (id: MemberId) => MEMBER_BY_ID.get(id)?.stageName ?? "—",
    });
  }

  private compatInput(userId: UserId): CompatibilityInput {
    const profile = this.getProfile(userId);
    return {
      userId,
      holdings: this.listHoldings(userId),
      wishlist: this.listWishlist(userId),
      favoriteGroupIds: profile?.favoriteGroupIds ?? [],
      biasMemberIds: profile?.biasMemberIds ?? [],
      favoriteEraIds: profile?.favoriteEraIds ?? [],
    };
  }

  // --- Feed ---------------------------------------------------------------

  listActivity(viewerId: UserId): Activity[] {
    const following = new Set<string>([...this.listFollowing(viewerId), viewerId]);
    return ACTIVITY.filter((a) => following.has(a.actorId)).sort((x, y) =>
      y.createdAt.localeCompare(x.createdAt),
    );
  }

  // --- Mutations ----------------------------------------------------------

  addHolding(input: {
    ownerId: UserId;
    templateId: TemplateId;
    zoneId: ZoneId;
    slot: number;
  }): Holding {
    const holding: Holding = {
      id: `h-${this.nextHoldingId++}` as HoldingId,
      ownerId: input.ownerId,
      templateId: input.templateId,
      condition: "mint",
      tradeStatus: "not-for-trade",
      acquisition: { acquiredAt: new Date().toISOString().slice(0, 10) },
    };
    this.holdings.push(holding);

    const room = this.getRoomByOwner(input.ownerId);
    if (room) {
      const list = this.placements.get(room.id) ?? [];
      list.push({ holdingId: holding.id, zoneId: input.zoneId, slot: input.slot });
      this.placements.set(room.id, list);
    }

    // The wishlist entry is satisfied the moment the item is owned.
    this.wishlist = this.wishlist.filter(
      (w) => !(w.userId === input.ownerId && w.templateId === input.templateId),
    );

    return holding;
  }
}

/**
 * Single shared instance. This is the only place components reach for data,
 * and swapping it for a network-backed implementation is a one-line change.
 */
export const repository: CollectionRepository = new MemoryCollectionRepository();
