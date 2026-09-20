import { matchCatalog, normalizeCatalogName, type CatalogDraft, type CatalogMatch } from "./catalog-match";
import {
  computeCompatibility,
  describeMatch,
  type CompatibilityInput,
  type MatchRelation,
} from "./compatibility";
import {
  COLLECTIBLE_TEMPLATES,
  ERAS,
  ERA_BY_ID,
  GROUPS,
  GROUP_BY_ID,
  MEMBER_BY_ID,
  MEMBERS,
  RELEASE_BY_ID,
  RELEASES,
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
import { DECOR_BY_ID, DECOR_CATALOG, ROOM_OBJECTS_FIXTURE } from "./fixtures/decor";
import {
  EMPTY_ONBOARDING,
  normalizeOnboarding,
  type IdentityBeat,
  type OnboardingProgress,
} from "./onboarding";
import { isLocale, type Locale } from "@/locale/translate";
import { handleError, isFixtureUser, normalizeHandle } from "./session";
import { homeForTemplate, slotForHome } from "./homes";
import { createStarterFurniture, createStarterRoom } from "./starter-room";
import { CAMERA_ROLL, MESSAGES, NOTICES, POST_COMMENTS, POST_LIKES, POSTS, THREADS } from "./fixtures/social";
import type { CollectionRepository } from "./repository";
import type {
  Activity,
  CollectibleKind,
  CollectibleSet,
  CollectibleTemplate,
  CollectionCompatibility,
  CollectionStats,
  DecorAsset,
  DecorId,
  Era,
  EraId,
  Follow,
  CommentId,
  Group,
  GroupCollectionSlice,
  GroupId,
  Holding,
  HoldingId,
  HoldingView,
  MaterialName,
  Member,
  MemberId,
  Message,
  MessageId,
  Notice,
  NoticeId,
  Placement,
  Post,
  PostComment,
  PostId,
  PostLike,
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
  SearchKind,
  SetProgress,
  TemplateId,
  Thread,
  ThreadId,
  Transform3D,
  User,
  UserId,
  WishlistItem,
  ZoneId,
} from "./types";

const LAYOUT_KEY = "seoully.roomLayout.v1";
const LIVE_KEY = "seoully.live.v1";
const UNDO_LIMIT = 40;

interface LiveSnapshot {
  v: 1;
  locale?: Locale;
  users: User[];
  profiles: Profile[];
  rooms: Room[];
  holdings: Holding[];
  placements: [string, Placement[]][];
  wishlist: WishlistItem[];
  roomObjects: RoomObject[];
  onboarding: Record<string, OnboardingProgress>;
  follows: Follow[];
  threads?: Thread[];
  messages?: Message[];
  posts?: Post[];
  templates?: CollectibleTemplate[];
}

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
  private follows: Follow[] = FOLLOWS.map((f) => ({ ...f }));
  private posts: Post[] = POSTS.map((p) => ({
    ...p,
    templateIds: [...p.templateIds],
    ...(p.media ? { media: p.media.map((m) => ({ ...m })) } : {}),
    ...(p.taggedUserIds ? { taggedUserIds: [...p.taggedUserIds] } : {}),
    ...(p.taggedTemplateIds ? { taggedTemplateIds: [...p.taggedTemplateIds] } : {}),
  }));
  private likes: PostLike[] = POST_LIKES.map((l) => ({ ...l }));
  private comments: PostComment[] = POST_COMMENTS.map((c) => ({ ...c }));
  private shares: PostLike[] = [];
  private saved: PostLike[] = [];
  private readThreads = new Set<string>();
  private notices: Notice[] = NOTICES.map((n) => ({
    ...n,
    ...(n.templateIds ? { templateIds: [...n.templateIds] } : {}),
  }));
  private threads: Thread[] = THREADS.map((t) => ({
    ...t,
    participantIds: [...t.participantIds] as Thread["participantIds"],
  }));
  private messages: Message[] = MESSAGES.map((m) => ({
    ...m,
    ...(m.templateIds ? { templateIds: [...m.templateIds] } : {}),
  }));
  private users: User[] = USERS.map((u) => ({ ...u }));
  private profiles: Profile[] = PROFILES.map((p) => ({
    ...p,
    favoriteGroupIds: [...p.favoriteGroupIds],
    biasMemberIds: [...p.biasMemberIds],
    favoriteEraIds: [...p.favoriteEraIds],
    ...(p.collectorInterests ? { collectorInterests: [...p.collectorInterests] } : {}),
  }));
  private rooms: Room[] = ROOMS.map((r) => ({
    ...r,
    theme: { ...r.theme, light: { ...r.theme.light } },
    zones: r.zones.map((z) => ({
      ...z,
      transform: { ...z.transform },
      dock: { ...z.dock },
      size: { ...z.size },
    })),
  }));
  private onboarding: Record<string, OnboardingProgress> = {};
  private nextHoldingId = HOLDINGS_FIXTURE.length + 1;
  private nextMessageId = MESSAGES.length + 1;
  private nextThreadId = THREADS.length + 1;
  private nextCommentId = POST_COMMENTS.length + 1;
  private nextNoticeId = NOTICES.length + 1;
  private nextPostId = POSTS.length + 1;
  private nextObjectId = ROOM_OBJECTS_FIXTURE.length + 1;
  private roomObjects: RoomObject[] = ROOM_OBJECTS_FIXTURE.map((o) => ({
    ...o,
    transform: { ...o.transform },
  }));
  private history = new Map<string, { past: RoomLayout[]; future: RoomLayout[] }>();
  private listeners = new Set<() => void>();
  private rev = 0;
  private hydrated = false;
  private locale: Locale = "en";
  private userTemplates: CollectibleTemplate[] = [];
  /** Transitional entities needed to render production catalog records in the frozen local UI. */
  private productionGroups = new Map<GroupId, Group>();
  private productionMembers = new Map<MemberId, Member>();

  getLocale(): Locale {
    return this.locale;
  }

  setLocale(locale: Locale) {
    this.locale = locale === "ko" ? "ko" : "en";
    this.persistLive();
  }

  // --- Catalog ------------------------------------------------------------

  getGroup(id: string): Group | undefined {
    return GROUP_BY_ID.get(id) ?? this.productionGroups.get(id as GroupId);
  }
  getMember(id: string): Member | undefined {
    return MEMBER_BY_ID.get(id) ?? this.productionMembers.get(id as MemberId);
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
    return this.userTemplates.find((template) => template.id === id) ?? TEMPLATE_BY_ID.get(id);
  }
  getSet(id: string): CollectibleSet | undefined {
    return SET_BY_ID.get(id);
  }
  listGroups(): Group[] {
    return GROUPS;
  }
  listMembers(groupId?: string): Member[] {
    return groupId ? MEMBERS.filter((m) => m.groupId === groupId) : MEMBERS;
  }
  listEras(groupId?: string): Era[] {
    return groupId ? ERAS.filter((e) => e.groupId === groupId) : ERAS;
  }
  listReleases(groupId?: string): Release[] {
    return groupId ? RELEASES.filter((release) => release.groupId === groupId) : RELEASES;
  }
  listTemplates(): CollectibleTemplate[] {
    return [...COLLECTIBLE_TEMPLATES, ...this.userTemplates];
  }
  searchCatalog(query: string): CollectibleTemplate[] {
    const q = query.trim().toLowerCase();
    const catalog = this.listTemplates();
    if (!q) return catalog.slice(0, 12);
    return catalog
      .filter((template) => {
        const group = this.getGroup(template.groupId);
        const member = template.memberId ? this.getMember(template.memberId) : undefined;
        const release = template.releaseId ? this.getRelease(template.releaseId) : undefined;
        return [template.name, group?.name, group?.nativeName, member?.stageName, release?.title]
          .filter(Boolean)
          .some((value) => (value as string).toLowerCase().includes(q));
      })
      .slice(0, 24);
  }
  adoptProductionCatalogTemplate(input: {
    id: string;
    name: string;
    kind: CollectibleTemplate["kind"];
    groupName: string;
    memberName?: string | null;
    releaseName?: string | null;
    descriptor?: string;
  }): TemplateId | undefined {
    const id = input.id as TemplateId;
    if (this.getTemplate(id)) return id;
    let group = GROUPS.find((item) => normalizeCatalogName(item.name) === normalizeCatalogName(input.groupName));
    if (!group) {
      const id = `production-group-${normalizeCatalogName(input.groupName).replace(/[^a-z0-9_-]/g, "-").slice(0, 48)}` as GroupId;
      group = this.productionGroups.get(id) ?? {
        id,
        name: input.groupName.trim(),
        debutYear: 0,
        memberIds: [],
        palette: { primary: "#e8567f", secondary: "#fbe3ec", accent: "#ff8fb1" },
      };
      this.productionGroups.set(group.id, group);
    }
    let member = input.memberName
      ? MEMBERS.find((item) => item.groupId === group!.id && normalizeCatalogName(item.stageName) === normalizeCatalogName(input.memberName!))
      : undefined;
    if (input.memberName && !member) {
      const id = `production-member-${group.id}-${normalizeCatalogName(input.memberName).replace(/[^a-z0-9_-]/g, "-").slice(0, 40)}` as MemberId;
      member = this.productionMembers.get(id) ?? {
        id,
        groupId: group.id,
        stageName: input.memberName.trim(),
        color: group.palette.primary,
      };
      this.productionMembers.set(member.id, member);
      if (!group.memberIds.includes(member.id)) group.memberIds.push(member.id);
    }
    const release = input.releaseName ? RELEASES.find((item) => item.groupId === group.id && normalizeCatalogName(item.title) === normalizeCatalogName(input.releaseName!)) : undefined;
    const template: CollectibleTemplate = {
      id,
      kind: input.kind,
      name: input.name,
      groupId: group.id,
      rarity: "common",
      material: materialForKind(input.kind),
      colorway: { base: member?.color ?? group.palette.primary, accent: group.palette.secondary, ink: group.palette.accent },
      ...(member ? { memberId: member.id } : {}),
      ...(release ? { releaseId: release.id } : {}),
    };
    this.userTemplates.push(template);
    this.persistLive();
    this.notify();
    return id;
  }
  findCatalogMatches(draft: CatalogDraft): CatalogMatch[] {
    return matchCatalog(draft, this.listTemplates());
  }
  createCatalogItem(draft: CatalogDraft): CollectibleTemplate {
    const group = this.getGroup(draft.groupId);
    const member = draft.memberId ? this.getMember(draft.memberId) : undefined;
    const template: CollectibleTemplate = {
      id: `t-live-${Date.now().toString(36)}` as TemplateId,
      kind: draft.kind,
      name: draft.name.trim(),
      groupId: draft.groupId,
      rarity: "common",
      material: materialForKind(draft.kind),
      colorway: {
        base: member?.color ?? group?.palette.primary ?? "#f6aebf",
        accent: group?.palette.secondary ?? "#ffe8ee",
        ink: group?.palette.accent ?? "#2c2e4c",
      },
    };
    if (draft.memberId) template.memberId = draft.memberId;
    if (draft.eraId) template.eraId = draft.eraId;
    if (draft.releaseId) template.releaseId = draft.releaseId;
    if (draft.releaseVersionId) template.releaseVersionId = draft.releaseVersionId;
    if (draft.imageUrl) template.imageUrl = draft.imageUrl;
    this.userTemplates.push(template);
    this.persistLive();
    this.notify();
    return template;
  }

  createIdentity(input: {
    handle: string;
    displayName: string;
    userId?: UserId;
    allowHandleCollision?: boolean;
  }): { user: User; profile: Profile; room: Room } | { error: string } {
    const handle = normalizeHandle(input.handle);
    const displayName = input.displayName.trim();
    const invalid = handleError(handle);
    if (invalid) return { error: invalid };
    if (!displayName) return { error: "error.needName" };
    if (!input.allowHandleCollision && this.getUserByHandle(handle)) return { error: "error.handleTaken" };

    const userId = input.userId ?? (`u-live-${Date.now().toString(36)}` as UserId);
    const user: User = {
      id: userId,
      handle,
      displayName,
      joinedAt: new Date().toISOString().slice(0, 10),
    };
    const room = createStarterRoom(userId);
    const profile: Profile = {
      userId,
      tagline: "",
      bio: "",
      favoriteGroupIds: [],
      biasMemberIds: [],
      favoriteEraIds: [],
      collectorInterests: [],
      collectorType: "Collector",
      avatarColor: "#f6aebf",
      roomId: room.id,
      appearance: { mode: "room-sync" },
    };
    this.users.push(user);
    this.profiles.push(profile);
    this.rooms.push(room);
    this.roomObjects.push(...createStarterFurniture(room.id));
    this.placements.set(room.id, []);
    this.onboarding[userId] = { ...EMPTY_ONBOARDING };
    this.persistLive();
    this.notify();
    return { user, profile, room };
  }

  /** Transitional UI projection only; authenticated identity/profile is authoritative on the server. */
  adoptAuthenticatedIdentity(input: import("./identity").IdentityProfileDTO): void {
    const existing = this.getUser(input.user.id);
    if (!existing) {
      const created = this.createIdentity({
        handle: input.user.handle,
        displayName: input.user.displayName,
        userId: input.user.id,
        allowHandleCollision: true,
      });
      if ("error" in created) return;
    }
    // Auth/Profile may be restored from production while the transitional
    // prototype snapshot is stale or incomplete. Keep the authenticated
    // identity usable by ensuring its local Room projection exists; otherwise
    // callers can silently remain on a fixture viewer and auth-scoped UI
    // actions (Profile edit/sign-out) are incorrectly unavailable.
    if (!this.getRoomByOwner(input.user.id)) {
      const room = createStarterRoom(input.user.id);
      this.rooms.push(room);
      this.roomObjects.push(...createStarterFurniture(room.id));
      this.placements.set(room.id, []);
    }
    const user = this.users.find((candidate) => candidate.id === input.user.id);
    const profile = this.profiles.find((candidate) => candidate.userId === input.user.id);
    if (!user || !profile) return;
    Object.assign(user, { handle: input.user.handle, displayName: input.user.displayName, joinedAt: input.user.joinedAt });
    Object.assign(profile, input.profile);
    this.persistLive();
    this.notify();
  }

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
  ): void {
    const profile = this.profiles.find((p) => p.userId === userId);
    const user = this.users.find((u) => u.id === userId);
    if (!profile || !user) return;
    if (patch.displayName !== undefined) user.displayName = patch.displayName.trim() || user.displayName;
    if (patch.handle !== undefined) {
      const handle = normalizeHandle(patch.handle);
      const invalid = handleError(handle);
      const taken = this.getUserByHandle(handle);
      if (!invalid && (!taken || taken.id === userId)) user.handle = handle;
    }
    if (patch.joinedAt !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(patch.joinedAt)) {
      user.joinedAt = patch.joinedAt;
    }
    if (patch.bio !== undefined) profile.bio = patch.bio;
    if (patch.tagline !== undefined) profile.tagline = patch.tagline;
    if (patch.location !== undefined) {
      const location = patch.location.trim();
      if (location) profile.location = location;
      else delete profile.location;
    }
    if (patch.avatarUrl !== undefined) profile.avatarUrl = patch.avatarUrl;
    if (patch.avatarColor !== undefined) profile.avatarColor = patch.avatarColor;
    if (patch.favoriteGroupIds) profile.favoriteGroupIds = [...patch.favoriteGroupIds];
    if (patch.biasMemberIds) profile.biasMemberIds = [...patch.biasMemberIds];
    if (patch.favoriteEraIds) profile.favoriteEraIds = [...patch.favoriteEraIds];
    if (patch.collectorInterests) profile.collectorInterests = [...patch.collectorInterests];
    if (patch.collectorType !== undefined) profile.collectorType = patch.collectorType;
    if (patch.appearance !== undefined) profile.appearance = patch.appearance;
    const groups = profile.favoriteGroupIds.map((id) => GROUP_BY_ID.get(id)?.name).filter(Boolean);
    const bias = profile.biasMemberIds.map((id) => MEMBER_BY_ID.get(id)?.stageName).filter(Boolean);
    if (patch.tagline === undefined) {
      profile.tagline = [groups[0] ? `${groups[0]} collector` : null, bias[0] ? `${bias[0]} bias` : null]
        .filter(Boolean)
        .join(" · ");
    }
    this.persistLive();
    this.notify();
  }

  onboardingState(userId: UserId): OnboardingProgress {
    return normalizeOnboarding(this.onboarding[userId]);
  }

  markIdentityBeat(userId: UserId, beat: IdentityBeat): void {
    const prev = this.onboardingState(userId);
    this.onboarding[userId] = { ...prev, identityBeat: beat };
    this.persistLive();
  }

  markProfileComplete(userId: UserId): void {
    const prev = this.onboardingState(userId);
    this.onboarding[userId] = { ...prev, profileComplete: true, identityBeat: "done" };
    this.persistLive();
    this.notify();
  }

  markFirstHoldingComplete(userId: UserId): void {
    const prev = this.onboardingState(userId);
    this.onboarding[userId] = { ...prev, profileComplete: true, firstHoldingComplete: true };
    this.persistLive();
  }

  markRoomIntroduced(userId: UserId): void {
    const prev = this.onboardingState(userId);
    this.onboarding[userId] = { ...prev, roomIntroduced: true };
    this.persistLive();
  }

  markFirstSessionComplete(userId: UserId): void {
    const prev = this.onboardingState(userId);
    this.onboarding[userId] = {
      ...prev,
      profileComplete: true,
      firstHoldingComplete: true,
      roomIntroduced: true,
      firstSessionComplete: true,
      identityBeat: "done",
    };
    this.persistLive();
    this.notify();
  }

  // --- Social -------------------------------------------------------------

  getUser(id: UserId): User | undefined {
    return this.users.find((u) => u.id === id);
  }
  getUserByHandle(handle: string): User | undefined {
    const needle = handle.trim().toLowerCase().replace(/^@/, "");
    return this.users.find((u) => u.handle === needle);
  }
  getProfile(userId: UserId): Profile | undefined {
    return this.profiles.find((p) => p.userId === userId);
  }
  listUsers(): User[] {
    return this.users;
  }
  listFollowing(userId: UserId): UserId[] {
    return this.follows.filter((f) => f.followerId === userId).map((f) => f.followeeId);
  }

  listFollowers(userId: UserId): UserId[] {
    return this.follows.filter((f) => f.followeeId === userId).map((f) => f.followerId);
  }

  isFollowing(followerId: UserId, followeeId: UserId): boolean {
    return this.follows.some((f) => f.followerId === followerId && f.followeeId === followeeId);
  }

  follow(followerId: UserId, followeeId: UserId): void {
    if (followerId === followeeId || this.isFollowing(followerId, followeeId)) return;
    this.follows.push({
      followerId,
      followeeId,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    this.pushNotice({
      recipientId: followeeId,
      kind: "follow",
      actorId: followerId,
      headline: "started following you",
    });
    this.persistLive();
    this.notify();
  }

  unfollow(followerId: UserId, followeeId: UserId): void {
    const next = this.follows.filter(
      (f) => !(f.followerId === followerId && f.followeeId === followeeId),
    );
    if (next.length === this.follows.length) return;
    this.follows = next;
    this.persistLive();
    this.notify();
  }

  listPosts(authorId: UserId): Post[] {
    return this.posts
      .filter((p) => p.authorId === authorId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  listAllPosts(): Post[] {
    return [...this.posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getPost(postId: PostId): Post | undefined {
    return this.posts.find((p) => p.id === postId);
  }

  listPostsAbout(userId: UserId, templateId: TemplateId): Post[] {
    return this.listPosts(userId).filter((p) => p.templateIds.includes(templateId));
  }

  likePost(userId: UserId, postId: PostId): void {
    if (this.isLiked(userId, postId)) return;
    this.likes.push({ postId, userId });
    const post = this.posts.find((p) => p.id === postId);
    if (post && post.authorId !== userId) {
      this.pushNotice({
        recipientId: post.authorId,
        kind: "like",
        actorId: userId,
        headline: "liked your post",
        postId,
      });
    }
    this.notify();
  }

  unlikePost(userId: UserId, postId: PostId): void {
    const next = this.likes.filter((l) => !(l.postId === postId && l.userId === userId));
    if (next.length === this.likes.length) return;
    this.likes = next;
    this.notify();
  }

  isLiked(userId: UserId, postId: PostId): boolean {
    return this.likes.some((l) => l.postId === postId && l.userId === userId);
  }

  likeCount(postId: PostId): number {
    return this.likes.filter((l) => l.postId === postId).length;
  }

  sharePost(userId: UserId, postId: PostId): void {
    if (this.shares.some((s) => s.postId === postId && s.userId === userId)) return;
    this.shares.push({ postId, userId });
    this.notify();
  }

  shareCount(postId: PostId): number {
    return this.shares.filter((s) => s.postId === postId).length;
  }

  listComments(postId: PostId): PostComment[] {
    return this.comments
      .filter((c) => c.postId === postId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  addComment(input: { postId: PostId; authorId: UserId; body: string }): PostComment {
    const comment: PostComment = {
      id: `c-${this.nextCommentId++}` as CommentId,
      postId: input.postId,
      authorId: input.authorId,
      body: input.body,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    this.comments.push(comment);
    const post = this.posts.find((p) => p.id === input.postId);
    if (post && post.authorId !== input.authorId) {
      this.pushNotice({
        recipientId: post.authorId,
        kind: "comment",
        actorId: input.authorId,
        headline: "commented on your post",
        postId: input.postId,
      });
    }
    this.notify();
    return comment;
  }

  createPost(input: {
    authorId: UserId;
    body: string;
    kind?: Post["kind"];
    media?: Post["media"];
    templateIds?: TemplateId[];
    taggedUserIds?: UserId[];
    taggedTemplateIds?: TemplateId[];
    location?: string;
    repostOf?: PostId;
  }): Post {
    const media = (input.media ?? []).filter(
      (item) => (item.kind === "photo" || item.kind === "video") && item.url.trim().length > 0,
    );
    if (!input.repostOf && media.length === 0) {
      throw new Error("A photo or video is required to create a post.");
    }
    const post: Post = {
      id: `p-new-${this.nextPostId++}` as PostId,
      authorId: input.authorId,
      kind: input.kind ?? (input.templateIds && input.templateIds.length > 0 ? "note" : "life"),
      createdAt: new Date().toISOString().slice(0, 10),
      body: input.body,
      templateIds: input.templateIds ? [...input.templateIds] : [],
      ...(media.length > 0 ? { media: media.map((m) => ({ ...m })) } : {}),
      ...(input.location ? { location: input.location } : {}),
      ...(input.taggedUserIds?.length
        ? { taggedUserIds: [...new Set(input.taggedUserIds)].filter((id) => !!this.getUser(id)) }
        : {}),
      ...(input.taggedTemplateIds?.length
        ? {
            taggedTemplateIds: [...new Set(input.taggedTemplateIds)].filter(
              (id) => !!this.getTemplate(id),
            ),
          }
        : {}),
      ...(input.repostOf ? { repostOf: input.repostOf } : {}),
    };
    this.posts.unshift(post);
    this.persistLive();
    this.notify();
    return post;
  }

  repostPost(userId: UserId, postId: PostId): Post | undefined {
    const post = this.getPost(postId);
    if (!post) return undefined;
    const origin = this.originPost(post);
    if (origin.authorId === userId) return undefined;
    const existing = this.posts.find((item) => item.authorId === userId && item.repostOf === origin.id);
    if (existing) return existing;
    const created = this.createPost({
      authorId: userId,
      body: origin.body,
      kind: origin.kind,
      ...(origin.media ? { media: origin.media } : {}),
      ...(origin.templateIds.length > 0 ? { templateIds: origin.templateIds } : {}),
      ...(origin.taggedUserIds?.length ? { taggedUserIds: origin.taggedUserIds } : {}),
      ...(origin.taggedTemplateIds?.length ? { taggedTemplateIds: origin.taggedTemplateIds } : {}),
      ...(origin.location ? { location: origin.location } : {}),
      repostOf: origin.id,
    });
    this.pushNotice({
      recipientId: origin.authorId,
      kind: "repost",
      actorId: userId,
      headline: "reposted your post",
      postId: origin.id,
    });
    return created;
  }

  unrepostPost(userId: UserId, postId: PostId): void {
    const post = this.getPost(postId);
    if (!post) return;
    const origin = this.originPost(post);
    const next = this.posts.filter((item) => !(item.authorId === userId && item.repostOf === origin.id));
    if (next.length === this.posts.length) return;
    this.posts = next;
    this.persistLive();
    this.notify();
  }

  hasReposted(userId: UserId, postId: PostId): boolean {
    const post = this.getPost(postId);
    if (!post) return false;
    const origin = this.originPost(post);
    return this.posts.some((item) => item.authorId === userId && item.repostOf === origin.id);
  }

  private originPost(post: Post): Post {
    let current = post;
    const seen = new Set<PostId>();
    while (current.repostOf && !seen.has(current.id)) {
      seen.add(current.id);
      const next = this.getPost(current.repostOf);
      if (!next) break;
      current = next;
    }
    return current;
  }

  savePost(userId: UserId, postId: PostId): void {
    if (this.isSaved(userId, postId)) return;
    this.saved.push({ postId, userId });
    this.notify();
  }

  unsavePost(userId: UserId, postId: PostId): void {
    const next = this.saved.filter((s) => !(s.postId === postId && s.userId === userId));
    if (next.length === this.saved.length) return;
    this.saved = next;
    this.notify();
  }

  isSaved(userId: UserId, postId: PostId): boolean {
    return this.saved.some((s) => s.postId === postId && s.userId === userId);
  }

  listCameraRoll(): NonNullable<Post["media"]> {
    return CAMERA_ROLL.map((m) => ({ ...m }));
  }

  isThreadUnread(threadId: ThreadId, userId: UserId): boolean {
    if (this.readThreads.has(threadId)) return false;
    const last = this.listMessages(threadId).at(-1);
    return !!last && last.senderId !== userId;
  }

  markThreadRead(threadId: ThreadId): void {
    if (this.readThreads.has(threadId)) return;
    this.readThreads.add(threadId);
    this.notify();
  }

  getThread(a: UserId, b: UserId): Thread | undefined {
    return this.threads.find((thread) => samePair(thread.participantIds, a, b));
  }

  getOrCreateThread(a: UserId, b: UserId): Thread {
    const existing = this.getThread(a, b);
    if (existing) return existing;
    const thread: Thread = {
      id: `th-${this.nextThreadId++}` as ThreadId,
      participantIds: [a, b] as [UserId, UserId],
    };
    this.threads.push(thread);
    this.persistLive();
    this.notify();
    return thread;
  }

  setThreadAbout(threadId: ThreadId, templateIds: TemplateId[]): void {
    const thread = this.threads.find((item) => item.id === threadId);
    if (!thread) return;
    const next = [...new Set(templateIds)];
    const prev = thread.pendingTemplateIds ?? [];
    if (prev.length === next.length && prev.every((id, i) => id === next[i])) return;
    if (next.length === 0) delete thread.pendingTemplateIds;
    else thread.pendingTemplateIds = next;
    this.persistLive();
    this.notify();
  }

  listMessages(threadId: Thread["id"]): Message[] {
    return this.messages
      .filter((m) => m.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }

  sendMessage(input: {
    senderId: UserId;
    recipientId: UserId;
    body: string;
    templateIds?: TemplateId[];
    postId?: PostId;
  }): Message {
    const thread = this.getOrCreateThread(input.senderId, input.recipientId);
    const message: Message = {
      id: `m-${this.nextMessageId++}` as MessageId,
      threadId: thread.id,
      senderId: input.senderId,
      createdAt: new Date().toISOString(),
      body: input.body,
      ...(input.templateIds && input.templateIds.length > 0
        ? { templateIds: input.templateIds }
        : {}),
      ...(input.postId ? { postId: input.postId } : {}),
    };
    this.messages.push(message);
    if (input.postId) this.sharePost(input.senderId, input.postId);
    this.persistLive();
    this.notify();
    return message;
  }

  listThreads(userId: UserId): Thread[] {
    return this.threads
      .filter((t) => t.participantIds.includes(userId))
      .sort((a, b) => {
        const lastA = this.listMessages(a.id).at(-1)?.createdAt ?? "";
        const lastB = this.listMessages(b.id).at(-1)?.createdAt ?? "";
        return lastB.localeCompare(lastA);
      });
  }

  search(query: string): SearchHit[] {
    const q = query.trim().toLowerCase();
    const hits: SearchHit[] = [];
    const take = (kind: SearchKind, limit = 6) => {
      const ofKind = hits.filter((h) => h.kind === kind);
      return ofKind.length < limit;
    };

    const match = (value: string | undefined) =>
      !q || (value ?? "").toLowerCase().includes(q);

    for (const user of this.users) {
      const profile = this.getProfile(user.id);
      if (!match(user.handle) && !match(user.displayName) && !match(profile?.tagline)) continue;
      if (!take("collector")) continue;
      hits.push({
        kind: "collector",
        id: user.id,
        title: user.displayName,
        subtitle: `@${user.handle}${profile?.tagline ? ` · ${profile.tagline}` : ""}`,
        userId: user.id,
      });
    }

    for (const group of GROUPS) {
      if (!match(group.name) && !match(group.nativeName)) continue;
      if (!take("group")) continue;
      hits.push({
        kind: "group",
        id: group.id,
        title: group.name,
        subtitle: group.nativeName,
      });
    }

    for (const member of MEMBERS) {
      if (!match(member.stageName) && !match(member.nativeName)) continue;
      if (!take("member")) continue;
      const group = GROUP_BY_ID.get(member.groupId);
      hits.push({
        kind: "member",
        id: member.id,
        title: member.stageName,
        subtitle: group?.name,
      });
    }

    for (const release of RELEASES) {
      if (!match(release.title)) continue;
      if (!take("album")) continue;
      const group = GROUP_BY_ID.get(release.groupId);
      hits.push({
        kind: "album",
        id: release.id,
        title: release.title,
        subtitle: group?.name,
      });
    }

    for (const template of this.listTemplates()) {
      if (template.kind !== "photocard") continue;
      if (!match(template.name)) continue;
      if (!take("photocard")) continue;
      const group = GROUP_BY_ID.get(template.groupId);
      const member = template.memberId ? MEMBER_BY_ID.get(template.memberId) : undefined;
      hits.push({
        kind: "photocard",
        id: template.id,
        title: template.name,
        subtitle: [group?.name, member?.stageName].filter(Boolean).join(" · "),
        templateId: template.id,
      });
    }

    for (const room of this.rooms) {
      const owner = this.getUser(room.ownerId);
      if (!match(room.theme.name) && !match(owner?.displayName) && !match(owner?.handle)) continue;
      if (!take("room")) continue;
      hits.push({
        kind: "room",
        id: room.id,
        title: room.theme.name,
        subtitle: owner ? `${owner.displayName}'s room` : undefined,
        userId: room.ownerId,
      });
    }

    return hits;
  }

  getCollectionIdentity(userId: UserId): GroupCollectionSlice[] {
    const views = this.listHoldingViews(userId);
    const buckets = new Map<string, GroupCollectionSlice>();
    for (const view of views) {
      const existing = buckets.get(view.group.id);
      if (existing) {
        existing.count += 1;
        if (existing.sampleIds.length < 4) existing.sampleIds.push(view.template.id);
      } else {
        buckets.set(view.group.id, {
          groupId: view.group.id,
          name: view.group.name,
          count: 1,
          sampleIds: [view.template.id],
        });
      }
    }
    return [...buckets.values()].sort((a, b) => b.count - a.count);
  }

  listOwners(templateId: TemplateId): UserId[] {
    const seen = new Set<UserId>();
    const owners: UserId[] = [];
    for (const holding of this.holdings) {
      if (holding.templateId !== templateId || seen.has(holding.ownerId)) continue;
      seen.add(holding.ownerId);
      owners.push(holding.ownerId);
    }
    return owners;
  }

  listNotices(userId: UserId): Notice[] {
    return this.notices
      .filter((n) => n.recipientId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  }

  unreadNoticeCount(userId: UserId): number {
    return this.notices.filter((n) => n.recipientId === userId && !n.read).length;
  }

  markNoticesRead(userId: UserId): void {
    let changed = false;
    this.notices = this.notices.map((n) => {
      if (n.recipientId !== userId || n.read) return n;
      changed = true;
      return { ...n, read: true };
    });
    if (changed) this.notify();
  }

  private pushNotice(input: Omit<Notice, "id" | "createdAt"> & { createdAt?: string }): void {
    this.notices.unshift({
      id: `n-${this.nextNoticeId++}` as NoticeId,
      createdAt: input.createdAt ?? new Date().toISOString().slice(0, 10),
      recipientId: input.recipientId,
      kind: input.kind,
      actorId: input.actorId,
      headline: input.headline,
      ...(input.postId ? { postId: input.postId } : {}),
      ...(input.templateIds ? { templateIds: input.templateIds } : {}),
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  revision(): number {
    return this.rev;
  }

  private notify() {
    this.rev += 1;
    for (const listener of this.listeners) listener();
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
    const template = this.getTemplate(holding.templateId);
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

  replaceWishlist(userId: UserId, templateIds: TemplateId[]): void {
    const wanted = new Set(templateIds);
    const next = this.wishlist.filter((item) => item.userId !== userId || wanted.has(item.templateId));
    const existing = new Set(next.filter((item) => item.userId === userId).map((item) => item.templateId));
    for (const templateId of wanted) {
      if (existing.has(templateId)) continue;
      next.push({ userId, templateId, addedAt: new Date().toISOString().slice(0, 10), intensity: 3 });
    }
    this.wishlist = next;
    this.persistLive();
    this.notify();
  }

  addToWishlist(userId: UserId, templateId: TemplateId): void {
    if (this.isWanted(userId, templateId)) return;
    this.wishlist.push({
      userId,
      templateId,
      addedAt: new Date().toISOString().slice(0, 10),
      intensity: 3,
    });
    this.persistLive();
    this.notify();
  }

  removeFromWishlist(userId: UserId, templateId: TemplateId): void {
    const next = this.wishlist.filter((w) => !(w.userId === userId && w.templateId === templateId));
    if (next.length === this.wishlist.length) return;
    this.wishlist = next;
    this.persistLive();
    this.notify();
  }

  isWanted(userId: UserId, templateId: TemplateId): boolean {
    return this.wishlist.some((w) => w.userId === userId && w.templateId === templateId);
  }

  removeHolding(holdingId: HoldingId): void {
    const holding = this.holdings.find((h) => h.id === holdingId);
    if (!holding) return;
    this.holdings = this.holdings.filter((h) => h.id !== holdingId);
    for (const [roomId, list] of this.placements) {
      const next = list.filter((placement) => placement.holdingId !== holdingId);
      if (next.length === list.length) continue;
      this.placements.set(roomId, next);
      this.persist(roomId as RoomId);
    }
    this.persistLive();
    this.notify();
  }

  setHoldingTradeStatus(holdingId: HoldingId, tradeStatus: "not-for-trade" | "for-trade"): void {
    const holding = this.holdings.find((h) => h.id === holdingId);
    if (!holding || holding.tradeStatus === tradeStatus) return;
    holding.tradeStatus = tradeStatus;
    holding.updatedAt = new Date().toISOString().slice(0, 10);
    this.persistLive();
    this.notify();
  }

  setHoldingPersonalMedia(holdingId: HoldingId, url?: string): void {
    const holding = this.holdings.find((item) => item.id === holdingId);
    if (!holding || holding.personalMediaUrl === url) return;
    if (url) holding.personalMediaUrl = url;
    else delete holding.personalMediaUrl;
    this.notify();
  }

  // --- Placement ----------------------------------------------------------

  getRoom(roomId: RoomId): Room | undefined {
    return this.rooms.find((r) => r.id === roomId);
  }
  getRoomByOwner(userId: UserId): Room | undefined {
    return this.rooms.find((r) => r.ownerId === userId);
  }
  listPlacements(roomId: RoomId): Placement[] {
    return this.placements.get(roomId) ?? [];
  }
  listPlacementsInZone(roomId: RoomId, zoneId: ZoneId): Placement[] {
    return this.listPlacements(roomId)
      .filter((p) => p.zoneId === zoneId && !p.transform)
      .sort((a, b) => a.slot - b.slot);
  }

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
  ): void {
    this.pushUndo(roomId);
    const list = this.placements.get(roomId);
    if (!list) return;
    const index = list.findIndex((p) => p.holdingId === holdingId);
    if (index < 0) return;
    const prev = list[index]!;
    list[index] = {
      ...prev,
      ...(patch.zoneId ? { zoneId: patch.zoneId } : {}),
      ...(patch.slot !== undefined ? { slot: patch.slot } : {}),
      offset: patch.offset ? { ...prev.offset, ...patch.offset } : prev.offset,
      ...(patch.transform ? { transform: { ...patch.transform } } : {}),
      ...(patch.surfaceId !== undefined ? { surfaceId: patch.surfaceId } : {}),
    };
    this.persist(roomId);
    this.persistLive();
    this.notify();
  }

  storePlacement(roomId: RoomId, holdingId: HoldingId): void {
    this.pushUndo(roomId);
    const list = this.placements.get(roomId);
    if (!list) return;
    this.placements.set(
      roomId,
      list.filter((p) => p.holdingId !== holdingId),
    );
    this.persist(roomId);
    this.persistLive();
    this.notify();
  }

  restorePlacement(
    roomId: RoomId,
    holdingId: HoldingId,
    transform: Transform3D,
    surfaceId?: string,
  ): void {
    const existing = this.listPlacements(roomId).find((p) => p.holdingId === holdingId);
    if (existing) return;
    this.pushUndo(roomId);
    const room = this.getRoom(roomId);
    const zoneId = room?.zones[0]?.id;
    if (!zoneId) return;
    const list = this.placements.get(roomId) ?? [];
    list.push({
      holdingId,
      zoneId,
      slot: list.length,
      transform: { ...transform },
      ...(surfaceId ? { surfaceId } : {}),
    });
    this.placements.set(roomId, list);
    this.persist(roomId);
    this.persistLive();
    this.notify();
  }

  listStoredHoldings(userId: UserId): HoldingView[] {
    const room = this.getRoomByOwner(userId);
    if (!room) return [];
    const placed = new Set(this.listPlacements(room.id).map((p) => p.holdingId as string));
    return this.listHoldingViews(userId).filter((v) => !placed.has(v.holding.id));
  }

  // --- Decor --------------------------------------------------------------

  listDecorCatalog(): DecorAsset[] {
    return DECOR_CATALOG;
  }

  getDecorAsset(id: DecorId): DecorAsset | undefined {
    return DECOR_BY_ID.get(id);
  }

  listRoomObjects(roomId: RoomId): RoomObject[] {
    return this.roomObjects.filter((o) => o.roomId === roomId && !o.stored);
  }

  listStoredDecor(roomId: RoomId): RoomObject[] {
    return this.roomObjects.filter((o) => o.roomId === roomId && o.stored);
  }

  placeDecor(
    roomId: RoomId,
    assetId: DecorId,
    zone: RoomMount,
    transform: Transform3D,
    surfaceId?: string,
  ): RoomObject {
    this.pushUndo(roomId);
    const object: RoomObject = {
      id: `ro-${this.nextObjectId++}` as RoomObjectId,
      roomId,
      assetId,
      zone,
      transform: { ...transform },
      ...(surfaceId ? { surfaceId } : {}),
    };
    this.roomObjects.push(object);
    this.persist(roomId);
    this.notify();
    return object;
  }

  moveRoomObject(
    id: RoomObjectId,
    patch: { zone?: RoomMount; transform?: Partial<Transform3D>; surfaceId?: string },
  ): void {
    const object = this.roomObjects.find((o) => o.id === id);
    if (!object) return;
    this.pushUndo(object.roomId);
    if (patch.zone) object.zone = patch.zone;
    if (patch.transform) object.transform = { ...object.transform, ...patch.transform };
    if (patch.surfaceId !== undefined) object.surfaceId = patch.surfaceId;
    this.persist(object.roomId);
    this.notify();
  }

  storeRoomObject(id: RoomObjectId): void {
    const object = this.roomObjects.find((o) => o.id === id);
    if (!object || object.stored) return;
    this.pushUndo(object.roomId);
    object.stored = true;
    this.persist(object.roomId);
    this.notify();
  }

  restoreRoomObject(
    id: RoomObjectId,
    transform?: Transform3D,
    patch?: { zone?: RoomMount; surfaceId?: string },
  ): void {
    const object = this.roomObjects.find((o) => o.id === id);
    if (!object || !object.stored) return;
    this.pushUndo(object.roomId);
    object.stored = false;
    if (transform) object.transform = { ...transform };
    if (patch?.zone) object.zone = patch.zone;
    if (patch?.surfaceId !== undefined) object.surfaceId = patch.surfaceId;
    this.persist(object.roomId);
    this.notify();
  }

  canUndoRoom(roomId: RoomId): boolean {
    return (this.history.get(roomId)?.past.length ?? 0) > 0;
  }

  canRedoRoom(roomId: RoomId): boolean {
    return (this.history.get(roomId)?.future.length ?? 0) > 0;
  }

  undoRoom(roomId: RoomId): void {
    const hist = this.history.get(roomId);
    if (!hist || hist.past.length === 0) return;
    hist.future.push(this.snapshot(roomId));
    const prev = hist.past.pop()!;
    this.applyLayout(roomId, prev);
    this.persist(roomId);
    this.notify();
  }

  redoRoom(roomId: RoomId): void {
    const hist = this.history.get(roomId);
    if (!hist || hist.future.length === 0) return;
    hist.past.push(this.snapshot(roomId));
    const next = hist.future.pop()!;
    this.applyLayout(roomId, next);
    this.persist(roomId);
    this.notify();
  }

  replaceProductionPlacements(roomId: RoomId, placements: Placement[]): void {
    const productionHoldingIds = new Set(
      this.holdings.filter((holding) => holding.productionId).map((holding) => holding.id),
    );
    const current = this.placements.get(roomId) ?? [];
    const localOnly = current.filter((placement) => !productionHoldingIds.has(placement.holdingId));
    const hydrated = placements.filter((placement) => productionHoldingIds.has(placement.holdingId));
    this.placements.set(roomId, [...localOnly, ...hydrated.map((placement) => ({ ...placement }))]);
    this.persist(roomId);
    this.persistLive();
    this.notify();
  }

  exportRoomLayout(roomId: RoomId): RoomLayout {
    return this.snapshot(roomId);
  }

  private snapshot(roomId: RoomId): RoomLayout {
    return {
      placements: this.listPlacements(roomId).map((p) => ({
        ...p,
        ...(p.offset ? { offset: { ...p.offset } } : {}),
      })),
      objects: this.roomObjects
        .filter((o) => o.roomId === roomId)
        .map((o) => ({ ...o, transform: { ...o.transform } })),
    };
  }

  private applyLayout(roomId: RoomId, layout: RoomLayout) {
    this.placements.set(
      roomId,
      layout.placements.map((p) => ({
        ...p,
        ...(p.offset ? { offset: { ...p.offset } } : {}),
      })),
    );
    const seen = new Set<string>();
    const unique = layout.objects.flatMap((object) => {
      if (seen.has(object.id)) return [];
      seen.add(object.id);
      return [{ ...object, transform: { ...object.transform } }];
    });
    const newcomers = ROOM_OBJECTS_FIXTURE.filter(
      (object) => object.roomId === roomId && !seen.has(object.id),
    ).map((object) => ({ ...object, transform: { ...object.transform } }));
    this.roomObjects = [
      ...this.roomObjects.filter((o) => o.roomId !== roomId),
      ...unique,
      ...newcomers,
    ];
    this.advanceObjectId();
  }

  private advanceObjectId() {
    for (const object of this.roomObjects) {
      const match = /^ro-(\d+)$/.exec(object.id);
      if (match) this.nextObjectId = Math.max(this.nextObjectId, Number(match[1]) + 1);
    }
  }

  private pushUndo(roomId: RoomId) {
    const hist = this.history.get(roomId) ?? { past: [], future: [] };
    hist.past.push(this.snapshot(roomId));
    if (hist.past.length > UNDO_LIMIT) hist.past.shift();
    hist.future = [];
    this.history.set(roomId, hist);
  }

  private persist(roomId: RoomId) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(`${LAYOUT_KEY}.${roomId}`, JSON.stringify(this.snapshot(roomId)));
    } catch {
      // Private browsing / quota — the in-memory copy is still the source of truth.
    }
  }

  hydrateFromStorage() {
    this.hydrate();
  }

  /** Merge persisted live data again after a remount emptied the in-memory copy. */
  rehydrateLive() {
    if (typeof window === "undefined") return;
    this.hydrated = false;
    this.hydrate();
  }

  hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.hydrated = true;
    this.hydrateLive();
    this.hydrateLayouts();
    this.settleDumpedHoldings();
    this.notify();
  }

  private hydrateLayouts() {
    if (typeof window === "undefined") return;
    for (const room of this.rooms) {
      try {
        const raw = window.localStorage.getItem(`${LAYOUT_KEY}.${room.id}`);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as RoomLayout;
        if (!Array.isArray(parsed.placements) || !Array.isArray(parsed.objects)) continue;
        this.applyLayout(room.id, parsed);
      } catch {
        // Corrupt payload — keep the fixture arrangement.
      }
    }
  }

  /** Move leftover first-add dumps off the floor and into their real home. */
  private settleDumpedHoldings() {
    for (const room of this.rooms) {
      if (isFixtureUser(room.ownerId)) continue;
      const list = this.placements.get(room.id);
      if (!list) continue;
      let dirty = false;
      for (let i = 0; i < list.length; i += 1) {
        const placement = list[i]!;
        if (!placement.transform) continue;
        const view = this.getHoldingView(placement.holdingId);
        if (!view) continue;
        const home = homeForTemplate(view.template);
        const current = room.zones.find((z) => z.id === placement.zoneId);
        // A card someone pulled out of the binder still has the binder zone.
        // The old add-flow dumped items onto the first zone with a free pose.
        if (current?.kind === home.zone) continue;
        const zone = room.zones.find((z) => z.kind === home.zone);
        if (!zone) continue;
        const used = list
          .filter((item) => item.zoneId === zone.id && !item.transform && item.holdingId !== placement.holdingId)
          .map((item) => item.slot);
        list[i] = {
          holdingId: placement.holdingId,
          zoneId: zone.id,
          slot: slotForHome(view.template, home.zone, used),
        };
        dirty = true;
      }
      if (dirty) {
        this.placements.set(room.id, list);
        this.persist(room.id);
        this.persistLive();
      }
    }
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
    return this.getCollectionCompatibility(a, b);
  }

  getCollectionCompatibility(viewerId: UserId, otherId: UserId): CollectionCompatibility {
    return computeCompatibility(this.compatInput(viewerId), this.compatInput(otherId), {
      template: (id) => this.getTemplate(id),
      groupName: (id: GroupId) => GROUP_BY_ID.get(id)?.name ?? "—",
      memberName: (id: MemberId) => MEMBER_BY_ID.get(id)?.stageName ?? "—",
      eraName: (id: EraId) => ERA_BY_ID.get(id)?.name ?? "—",
    });
  }

  getMatchRelation(viewerId: UserId, otherId: UserId, templateId: TemplateId): MatchRelation {
    const compat = this.getCollectionCompatibility(viewerId, otherId);
    return describeMatch(
      this.compatInput(viewerId),
      this.compatInput(otherId),
      templateId,
      compat.potentialTradeMatches.length > 0,
    );
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
      collectorInterests: profile?.collectorInterests ?? [],
    };
  }

  // --- Feed ---------------------------------------------------------------

  listActivity(viewerId: UserId): Activity[] {
    const following = new Set<string>([...this.listFollowing(viewerId), viewerId]);
    const known = ACTIVITY.filter((a) => following.has(a.actorId));
    // Discovery still surfaces the rest of the graph so an unfollowed collector
    // can be found. A networked implementation would paginate this separately.
    const rest = ACTIVITY.filter((a) => !following.has(a.actorId));
    return [...known, ...rest].sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  }

  // --- Mutations ----------------------------------------------------------

  addHolding(input: {
    ownerId: UserId;
    templateId: TemplateId;
    productionId?: string;
    zoneId?: ZoneId;
    slot?: number;
    condition?: Holding["condition"];
  }): Holding {
    const now = new Date().toISOString().slice(0, 10);
    const holding: Holding = {
      id: `h-${this.nextHoldingId++}` as HoldingId,
      ...(input.productionId ? { productionId: input.productionId } : {}),
      ownerId: input.ownerId,
      templateId: input.templateId,
      condition: input.condition ?? "mint",
      tradeStatus: "not-for-trade",
      acquisition: { acquiredAt: now },
      createdAt: now,
      updatedAt: now,
    };
    this.holdings.push(holding);

    const room = this.getRoomByOwner(input.ownerId);
    if (room && input.zoneId !== undefined && input.slot !== undefined) {
      const list = this.placements.get(room.id) ?? [];
      list.push({ holdingId: holding.id, zoneId: input.zoneId, slot: input.slot });
      this.placements.set(room.id, list);
      this.persist(room.id);
    }

    this.wishlist = this.wishlist.filter(
      (w) => !(w.userId === input.ownerId && w.templateId === input.templateId),
    );

    if (!isFixtureUser(input.ownerId)) {
      const prev = this.onboardingState(input.ownerId);
      this.onboarding[input.ownerId] = { ...prev, profileComplete: true, firstHoldingComplete: true };
    }

    this.persistLive();
    this.notify();
    return holding;
  }

  private persistLive() {
    if (typeof window === "undefined") return;
    const liveUsers = this.users.filter((u) => !isFixtureUser(u.id));
    if (liveUsers.length === 0) {
      try {
        const raw = window.localStorage.getItem(LIVE_KEY);
        const prev = raw ? (JSON.parse(raw) as LiveSnapshot) : null;
        if (prev && Array.isArray(prev.users) && prev.users.length > 0) {
          window.localStorage.setItem(
            LIVE_KEY,
            JSON.stringify({ ...prev, locale: this.locale, templates: this.userTemplates }),
          );
          return;
        }
        window.localStorage.setItem(
          LIVE_KEY,
          JSON.stringify({
            v: 1,
            locale: this.locale,
            users: [],
            profiles: [],
            rooms: [],
            holdings: [],
            placements: [],
            wishlist: [],
            roomObjects: [],
            onboarding: {},
            follows: [],
            templates: this.userTemplates,
          } satisfies LiveSnapshot),
        );
      } catch {
        /* ignore */
      }
      return;
    }
    const liveIds = new Set(liveUsers.map((u) => u.id as string));
    const threads = this.threads.filter((thread) =>
      thread.participantIds.some((id) => liveIds.has(id)),
    );
    const threadIds = new Set(threads.map((thread) => thread.id));
    const snapshot: LiveSnapshot = {
      v: 1,
      locale: this.locale,
      users: liveUsers,
      profiles: this.profiles.filter((p) => liveIds.has(p.userId)),
      rooms: this.rooms.filter((r) => liveIds.has(r.ownerId)),
      holdings: this.holdings.filter((h) => liveIds.has(h.ownerId)),
      placements: [...this.placements.entries()].filter(([roomId]) =>
        this.rooms.some((r) => r.id === roomId && liveIds.has(r.ownerId)),
      ),
      wishlist: this.wishlist.filter((w) => liveIds.has(w.userId)),
      roomObjects: this.roomObjects.filter((o) =>
        this.rooms.some((r) => r.id === o.roomId && liveIds.has(r.ownerId)),
      ),
      onboarding: this.onboarding,
      follows: this.follows.filter((f) => liveIds.has(f.followerId)),
      threads,
      messages: this.messages.filter((message) => threadIds.has(message.threadId)),
      posts: this.posts.filter((post) => liveIds.has(post.authorId)),
      templates: this.userTemplates,
    };
    try {
      window.localStorage.setItem(LIVE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota — in-memory remains the source of truth for this tab.
    }
  }

  private hydrateLive() {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(LIVE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LiveSnapshot;
      if (parsed.v !== 1 || !Array.isArray(parsed.users)) return;
      if (isLocale(parsed.locale)) this.locale = parsed.locale;
      for (const user of parsed.users) {
        if (this.users.some((u) => u.id === user.id)) continue;
        this.users.push(user);
      }
      for (const profile of parsed.profiles ?? []) {
        if (this.profiles.some((p) => p.userId === profile.userId)) continue;
        this.profiles.push(profile);
      }
      for (const room of parsed.rooms ?? []) {
        if (this.rooms.some((r) => r.id === room.id)) continue;
        this.rooms.push(room);
      }
      for (const holding of parsed.holdings ?? []) {
        if (this.holdings.some((h) => h.id === holding.id)) continue;
        this.holdings.push(holding);
        const match = /^h-(\d+)$/.exec(holding.id);
        if (match) this.nextHoldingId = Math.max(this.nextHoldingId, Number(match[1]) + 1);
      }
      for (const [roomId, list] of parsed.placements ?? []) {
        this.placements.set(roomId, list);
      }
      for (const item of parsed.wishlist ?? []) {
        if (this.wishlist.some((w) => w.userId === item.userId && w.templateId === item.templateId)) continue;
        this.wishlist.push(item);
      }
      for (const object of parsed.roomObjects ?? []) {
        if (this.roomObjects.some((o) => o.id === object.id)) continue;
        this.roomObjects.push(object);
      }
      const incoming = parsed.onboarding ?? {};
      const next: Record<string, OnboardingProgress> = { ...this.onboarding };
      for (const [id, progress] of Object.entries(incoming)) {
        next[id] = normalizeOnboarding(progress);
      }
      this.onboarding = next;
      for (const follow of parsed.follows ?? []) {
        if (this.isFollowing(follow.followerId, follow.followeeId)) continue;
        this.follows.push(follow);
      }
      for (const thread of parsed.threads ?? []) {
        const existing = this.threads.find((item) => item.id === thread.id);
        if (existing) {
          if (thread.pendingTemplateIds?.length) {
            existing.pendingTemplateIds = [...thread.pendingTemplateIds];
          }
          continue;
        }
        this.threads.push({
          ...thread,
          participantIds: [...thread.participantIds] as Thread["participantIds"],
          ...(thread.pendingTemplateIds ? { pendingTemplateIds: [...thread.pendingTemplateIds] } : {}),
        });
        const match = /^th-(\d+)$/.exec(thread.id);
        if (match) this.nextThreadId = Math.max(this.nextThreadId, Number(match[1]) + 1);
      }
      for (const message of parsed.messages ?? []) {
        if (this.messages.some((item) => item.id === message.id)) continue;
        this.messages.push({
          ...message,
          ...(message.templateIds ? { templateIds: [...message.templateIds] } : {}),
        });
        const match = /^m-(\d+)$/.exec(message.id);
        if (match) this.nextMessageId = Math.max(this.nextMessageId, Number(match[1]) + 1);
      }
      for (const template of parsed.templates ?? []) {
        if (TEMPLATE_BY_ID.has(template.id)) continue;
        if (this.userTemplates.some((item) => item.id === template.id)) continue;
        this.userTemplates.push(template);
      }
      for (const post of parsed.posts ?? []) {
        if (this.posts.some((item) => item.id === post.id)) continue;
        this.posts.unshift({
          ...post,
          templateIds: [...post.templateIds],
          ...(post.media ? { media: post.media.map((item) => ({ ...item })) } : {}),
          ...(post.taggedUserIds ? { taggedUserIds: [...post.taggedUserIds] } : {}),
          ...(post.taggedTemplateIds ? { taggedTemplateIds: [...post.taggedTemplateIds] } : {}),
        });
        const match = /^p-new-(\d+)$/.exec(post.id);
        if (match) this.nextPostId = Math.max(this.nextPostId, Number(match[1]) + 1);
      }
    } catch {
      // Corrupt live payload — stay on fixtures.
    }
  }
}

function materialForKind(kind: CollectibleKind): MaterialName {
  switch (kind) {
    case "photocard":
      return "glossy-card";
    case "album":
    case "book":
      return "paper";
    case "vinyl":
      return "vinyl";
    case "poster":
      return "photo-print";
    case "lightstick":
    case "figure":
      return "acrylic";
    case "plushie":
      return "plush";
    case "apparel":
      return "velvet";
    case "memorabilia":
      return "matte-card";
  }
}

function samePair(pair: readonly UserId[], a: UserId, b: UserId): boolean {
  return (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a);
}

/**
 * Single shared instance. This is the only place components reach for data,
 * and swapping it for a network-backed implementation is a one-line change.
 */
export const repository: CollectionRepository = new MemoryCollectionRepository();

const live = repository as MemoryCollectionRepository;

export function getPersistedLocale(): Locale {
  return live.getLocale();
}

export function setPersistedLocale(locale: Locale) {
  live.setLocale(locale);
}

export function hydrateRoomLayouts() {
  live.hydrateFromStorage();
}
