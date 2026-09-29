import { computeCompatibility, sharedInterestCount } from "seoully-domain/compatibility";
import {
  COLLECTIBLE_TEMPLATES,
  ERA_BY_ID,
  GROUP_BY_ID,
  GROUPS,
  MEMBER_BY_ID,
  MEMBERS,
  RELEASE_BY_ID,
  TEMPLATE_BY_ID,
} from "seoully-domain/fixtures/catalog";
import {
  FOLLOWS,
  HOLDINGS_FIXTURE,
  PROFILES,
  ROOMS,
  SOO,
  USERS,
  WISHLIST,
} from "seoully-domain/fixtures/collectors";
import { POST_COMMENTS, POST_LIKES, POSTS, NOTICES } from "seoully-domain/fixtures/social";
import { resolveProfileTheme } from "seoully-domain/profile-theme";
import type { CollectibleTemplate, Follow, Holding, Notice, Post, PostComment, PostLike, UserId, WishlistItem } from "seoully-domain/types";
import type { NativeCatalogTemplate, NativeFeedPost, NativeHolding, NativeIdentity, NativeWishlistEntry } from "../../api";
import { DEMO_CAPABILITIES } from "../capabilities";
import { isDemoWorldAllowed } from "../mode";
import type { FeedMode, NativeAskResult, SocialCollector, SocialNotice, SocialRepository, SocialShareRecipient, SocialSuggested, SocialTradeItem } from "../types";
import { demoAssetUri } from "./assets";

const VIEWER = SOO;

function copy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function needle(query: string) {
  return query.trim().toLowerCase().replace(/^@+/, "");
}

function matches(value: string | undefined, query: string) {
  return Boolean(value && value.toLowerCase().includes(query));
}

function tradeStatus(status: Holding["tradeStatus"]): NativeHolding["tradeStatus"] {
  return status === "not-for-trade" ? "not-for-trade" : "for-trade";
}

function nativeTemplate(template: CollectibleTemplate): NativeCatalogTemplate {
  return {
    id: template.id,
    groupId: template.groupId,
    memberId: template.memberId ?? null,
    releaseId: template.releaseId ?? null,
    kind: template.kind,
    name: template.name,
    descriptor: "",
    status: "published",
    groupName: GROUP_BY_ID.get(template.groupId)?.name ?? "",
    memberName: template.memberId ? MEMBER_BY_ID.get(template.memberId)?.stageName ?? null : null,
    releaseName: template.releaseId ? RELEASE_BY_ID.get(template.releaseId)?.title ?? null : null,
    colorway: template.colorway,
  };
}

export class DemoSocialRepository implements SocialRepository {
  kind = "demo" as const;
  capabilities = DEMO_CAPABILITIES;
  private follows: Follow[];
  private likes: PostLike[];
  private comments: PostComment[];
  private wishlist: WishlistItem[];
  private holdings: Holding[];
  private notices: Notice[];
  private shares: { postId: string; peerUserId: string; body: string; createdAt: string }[] = [];
  private reposts = new Set<string>();
  private commentSerial = 100;

  constructor() {
    this.follows = copy(FOLLOWS);
    this.likes = copy(POST_LIKES);
    this.comments = copy(POST_COMMENTS);
    this.wishlist = copy(WISHLIST);
    this.holdings = copy(HOLDINGS_FIXTURE);
    this.notices = copy(NOTICES);
  }

  viewerId() {
    return VIEWER;
  }

  async loadIdentity(): Promise<NativeIdentity | null> {
    const user = USERS.find((item) => item.id === VIEWER);
    const profile = PROFILES.find((item) => item.userId === VIEWER);
    if (!user || !profile) return null;
    return {
      user: { id: user.id, handle: user.handle, displayName: user.displayName, joinedAt: user.joinedAt },
      profile: {
        tagline: profile.tagline,
        bio: profile.bio,
        location: profile.location,
        favoriteGroupIds: [...profile.favoriteGroupIds],
        biasMemberIds: [...profile.biasMemberIds],
        favoriteEraIds: [...profile.favoriteEraIds],
        collectorInterests: [...(profile.collectorInterests ?? [])],
        collectorType: profile.collectorType,
      },
    };
  }

  async loadFeed(mode: FeedMode): Promise<{ items: NativeFeedPost[]; nextCursor: null }> {
    const following = new Set(this.followingIds(VIEWER));
    const items = POSTS
      .filter((post) => {
        if (post.authorId === VIEWER) return false;
        const friend = following.has(post.authorId);
        return mode === "following" ? friend : !friend;
      })
      .map((post) => this.toPost(post.id))
      .filter((post): post is NativeFeedPost => post !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { items, nextCursor: null };
  }

  async loadSuggested(): Promise<SocialSuggested[]> {
    return USERS.filter((user) => user.id !== VIEWER).map((user) => {
      const compat = this.compatibility(VIEWER, user.id);
      const following = this.follows.some((follow) => follow.followerId === VIEWER && follow.followeeId === user.id);
      const parts: string[] = [];
      if (compat) {
        const shared = sharedInterestCount(compat);
        if (shared > 0) parts.push(`${shared} in common`);
        if (compat.potentialTradeMatches.length > 0) parts.push(`${compat.potentialTradeMatches.length} to trade`);
      }
      if (following) parts.push("Following");
      return {
        user: { userId: user.id, handle: user.handle, displayName: user.displayName },
        score: compat?.score ?? 0,
        meta: compat ? `${compat.score}% match` : user.handle,
        subtitle: parts.join(" · ") || undefined,
        avatarUrl: demoAssetUri(PROFILES.find((profile) => profile.userId === user.id)?.avatarUrl),
      };
    });
  }

  async setPostLiked(postId: string, liked: boolean) {
    this.likes = this.likes.filter((like) => !(like.postId === postId && like.userId === VIEWER));
    if (liked) this.likes.push({ postId: postId as PostLike["postId"], userId: VIEWER });
  }

  async setPostReposted(postId: string, reposted: boolean) {
    if (reposted) this.reposts.add(postId);
    else this.reposts.delete(postId);
    return { persisted: true };
  }

  async setPostSaved(postId: string, saved: boolean) {
    const post = POSTS.find((item) => item.id === postId);
    const origin = post?.repostOf ? POSTS.find((item) => item.id === post.repostOf) ?? post : post;
    const templateIds = [...new Set([...(origin?.templateIds ?? []), ...(origin?.taggedTemplateIds ?? [])])];
    for (const templateId of templateIds) await this.setWishlist(templateId, saved);
    return { persisted: true };
  }

  async loadPostComments(postId: string) {
    const items = this.comments
      .filter((comment) => comment.postId === postId)
      .map((comment) => this.toComment(comment));
    return { items, nextCursor: null };
  }

  async addPostComment(postId: string, body: string) {
    this.commentSerial += 1;
    const comment: PostComment = {
      id: `c-demo-${this.commentSerial}` as PostComment["id"],
      postId: postId as PostComment["postId"],
      authorId: VIEWER,
      body,
      createdAt: new Date().toISOString().slice(0, 10) as PostComment["createdAt"],
    };
    this.comments.push(comment);
    return this.toComment(comment);
  }

  async searchCollectors(query: string) {
    const q = needle(query);
    if (!q) return [];
    return USERS.filter((user) => {
      const profile = PROFILES.find((item) => item.userId === user.id);
      return matches(user.handle, q) || matches(user.displayName, q) || matches(profile?.tagline, q) || matches(profile?.bio, q)
        || this.profileNames(user.id).some((name) => matches(name, q));
    }).map((user) => ({
      userId: user.id,
      handle: user.handle,
      displayName: user.displayName,
      ...(demoAssetUri(PROFILES.find((profile) => profile.userId === user.id)?.avatarUrl)
        ? { avatarUrl: demoAssetUri(PROFILES.find((profile) => profile.userId === user.id)?.avatarUrl) }
        : {}),
    }));
  }

  async searchCatalog(query: string) {
    const q = needle(query);
    if (!q) return [];
    return COLLECTIBLE_TEMPLATES.filter((template) => {
      const mapped = nativeTemplate(template);
      return [mapped.name, mapped.groupName, mapped.memberName, mapped.releaseName, mapped.kind]
        .some((value) => matches(value ?? undefined, q));
    }).slice(0, 24).map(nativeTemplate);
  }

  async searchPosts(query: string) {
    const q = needle(query);
    if (!q) return [];
    return POSTS.filter((post) => {
      const author = USERS.find((user) => user.id === post.authorId);
      const tagged = post.templateIds.some((id) => {
        const template = TEMPLATE_BY_ID.get(id);
        return matches(template?.name, q) || matches(GROUP_BY_ID.get(template?.groupId ?? "")?.name, q);
      });
      return matches(post.body, q) || matches(post.location, q) || matches(author?.displayName, q) || matches(author?.handle, q) || tagged;
    }).map((post) => this.toPost(post.id)).filter((post): post is NativeFeedPost => post !== null);
  }

  async searchEntities(query: string) {
    const q = needle(query);
    if (!q) return [];
    const groups = GROUPS.filter((group) => matches(group.name, q) || matches(group.nativeName, q))
      .map((group) => ({ id: group.id, kind: "group" as const, title: group.name, query: group.name }));
    const members = MEMBERS.filter((member) => matches(member.stageName, q) || matches(member.nativeName, q))
      .map((member) => ({
        id: member.id,
        kind: "member" as const,
        title: member.stageName,
        subtitle: GROUP_BY_ID.get(member.groupId)?.name,
        query: member.stageName,
      }));
    return [...groups, ...members].slice(0, 24);
  }

  async searchRooms(query: string) {
    const people = await this.searchCollectors(query);
    return people.map((person) => {
      const compat = person.userId === VIEWER ? undefined : this.compatibility(VIEWER, person.userId);
      const profile = PROFILES.find((item) => item.userId === person.userId);
      return {
        roomId: profile?.roomId ?? person.userId,
        collector: person,
        rankScore: compat?.score ?? 0,
        displayedHoldingCount: this.holdings.filter((holding) => holding.ownerId === person.userId).length,
        relevantDisplayedCount: 0,
        reasons: compat?.theyOwnYourWants.length ? [{ code: "wishlist" as const, label: "Contains items from your wishlist" }] : [],
      };
    });
  }

  async loadCollector(userId: string): Promise<SocialCollector> {
    const user = USERS.find((item) => item.id === userId);
    const profile = PROFILES.find((item) => item.userId === userId);
    if (!user || !profile) throw new Error("collector_unavailable");
    const holdings = this.holdingsFor(userId);
    const wishlist = this.wishlistFor(userId);
    const posts = POSTS.filter((post) => post.authorId === userId).map((post) => this.toPost(post.id)).filter((post): post is NativeFeedPost => post !== null);
    const compat = userId === VIEWER ? undefined : this.compatibility(VIEWER, userId);
    return {
      user: { id: user.id, handle: user.handle, displayName: user.displayName, joinedAt: user.joinedAt },
      profile: {
        tagline: profile.tagline,
        bio: profile.bio,
        location: profile.location,
        collectorType: profile.collectorType,
        collectorInterests: [...(profile.collectorInterests ?? [])],
      },
      avatarUrl: demoAssetUri(profile.avatarUrl),
      follow: {
        following: this.follows.some((follow) => follow.followerId === VIEWER && follow.followeeId === userId),
        followers: this.follows.filter((follow) => follow.followeeId === userId).length,
        followingCount: this.follows.filter((follow) => follow.followerId === userId).length,
      },
      groups: profile.favoriteGroupIds.map((id) => ({ id, name: GROUP_BY_ID.get(id)?.name ?? id })),
      biases: profile.biasMemberIds.map((id) => ({ id, name: MEMBER_BY_ID.get(id)?.stageName ?? id })),
      eras: profile.favoriteEraIds.map((id) => ({ id, name: ERA_BY_ID.get(id)?.name ?? id })),
      holdings,
      holdingCount: holdings.length,
      wishlist,
      posts,
      ...(compat ? {
        compatibility: {
          score: compat.score,
          source: "domain" as const,
          reasons: compat.reasons,
          theyOwnYourWants: this.tradeItems(compat.theyOwnYourWants, userId, compat.theyOwnYourWants, compat.youOwnTheirWants),
          youOwnTheirWants: this.tradeItems(compat.youOwnTheirWants, VIEWER, compat.theyOwnYourWants, compat.youOwnTheirWants),
          reciprocal: compat.theyOwnYourWants.length > 0 && compat.youOwnTheirWants.length > 0,
        },
      } : {}),
      roomAvailable: ROOMS.some((room) => room.ownerId === userId),
      theme: this.themeFor(profile),
    };
  }

  async setFollowing(userId: string, following: boolean) {
    this.follows = this.follows.filter((follow) => !(follow.followerId === VIEWER && follow.followeeId === userId));
    if (following) this.follows.push({ followerId: VIEWER, followeeId: userId as UserId, createdAt: "2026-09-27" });
  }

  async loadCollectorPosts(userId: string) {
    const items = POSTS.filter((post) => post.authorId === userId).map((post) => this.toPost(post.id)).filter((post): post is NativeFeedPost => post !== null);
    return { items, nextCursor: null };
  }

  async loadMyHoldings(offset = 0, limit = 100) {
    return this.holdingsFor(VIEWER).slice(offset, offset + limit);
  }

  async loadMyWishlist(offset = 0, limit = 100) {
    return this.wishlistFor(VIEWER).slice(offset, offset + limit);
  }

  async setWishlist(templateId: string, wanted: boolean) {
    this.wishlist = this.wishlist.filter((item) => !(item.userId === VIEWER && item.templateId === templateId));
    if (wanted) {
      this.wishlist.push({
        userId: VIEWER,
        templateId: templateId as WishlistItem["templateId"],
        addedAt: new Date().toISOString().slice(0, 10) as WishlistItem["addedAt"],
        intensity: 3,
      });
    }
  }

  async setHoldingTradeStatus(holdingId: string, tradeStatus: NativeHolding["tradeStatus"]) {
    const holding = this.holdings.find((item) => item.id === holdingId && item.ownerId === VIEWER);
    if (!holding) throw new Error("holding_not_found");
    holding.tradeStatus = tradeStatus;
    const native = this.holdingsFor(VIEWER).find((item) => item.id === holdingId);
    if (!native) throw new Error("holding_not_found");
    return native;
  }

  async removeHolding(holdingId: string) {
    this.holdings = this.holdings.filter((item) => !(item.id === holdingId && item.ownerId === VIEWER));
  }

  async loadFollowCounts() {
    return {
      followers: this.follows.filter((follow) => follow.followeeId === VIEWER).length,
      followingCount: this.follows.filter((follow) => follow.followerId === VIEWER).length,
    };
  }

  async loadNotices(): Promise<{ items: SocialNotice[]; persisted: boolean }> {
    return {
      items: this.notices.filter((notice) => notice.recipientId === VIEWER).map((notice) => this.toNotice(notice)),
      persisted: true,
    };
  }

  async unreadNoticeCount() {
    return this.notices.filter((notice) => notice.recipientId === VIEWER && !notice.read).length;
  }

  async markNoticesRead() {
    for (const notice of this.notices) {
      if (notice.recipientId === VIEWER) notice.read = true;
    }
  }

  async searchShareRecipients(query: string): Promise<SocialShareRecipient[]> {
    const q = needle(query);
    return USERS.filter((user) => {
      if (user.id === VIEWER) return false;
      if (!q) return true;
      const profile = PROFILES.find((item) => item.userId === user.id);
      return matches(user.handle, q) || matches(user.displayName, q) || matches(profile?.tagline, q);
    }).map((user) => ({
      userId: user.id,
      handle: user.handle,
      displayName: user.displayName,
      ...(demoAssetUri(PROFILES.find((profile) => profile.userId === user.id)?.avatarUrl)
        ? { avatarUrl: demoAssetUri(PROFILES.find((profile) => profile.userId === user.id)?.avatarUrl) }
        : {}),
    }));
  }

  async sendShare(postId: string, peerUserId: string, body: string) {
    this.shares.push({ postId, peerUserId, body, createdAt: new Date().toISOString() });
    return { delivered: true };
  }

  listDemoShares() {
    return [...this.shares];
  }

  async askSeoully(question: string, locale: "en" | "ko", history: { role: "user" | "assistant"; content: string }[]): Promise<NativeAskResult> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { askDemo } = require("./ask") as typeof import("./ask");
    return askDemo(question, locale, history);
  }

  private followingIds(userId: string) {
    return this.follows.filter((follow) => follow.followerId === userId).map((follow) => follow.followeeId);
  }

  private holdingsFor(userId: string): NativeHolding[] {
    return this.holdings.filter((holding) => holding.ownerId === userId).flatMap((holding) => {
      const template = TEMPLATE_BY_ID.get(holding.templateId);
      if (!template) return [];
      return [{
        id: holding.id,
        templateId: holding.templateId,
        acquiredAt: holding.acquisition.acquiredAt,
        tradeStatus: tradeStatus(holding.tradeStatus),
        ...(holding.personalMediaUrl ? { personalMediaUrl: demoAssetUri(holding.personalMediaUrl) } : {}),
        template: nativeTemplate(template),
      }];
    });
  }

  private wishlistFor(userId: string): NativeWishlistEntry[] {
    return this.wishlist.flatMap((item) => {
      if (item.userId !== userId) return [];
      const template = TEMPLATE_BY_ID.get(item.templateId);
      if (!template) return [];
      return [{ id: `${item.userId}:${item.templateId}`, templateId: item.templateId, template: nativeTemplate(template) }];
    });
  }

  private compatibility(viewerId: string, otherId: string) {
    const viewer = PROFILES.find((profile) => profile.userId === viewerId);
    const other = PROFILES.find((profile) => profile.userId === otherId);
    if (!viewer || !other) return undefined;
    return computeCompatibility(
      {
        userId: viewerId as UserId,
        holdings: this.holdings.filter((holding) => holding.ownerId === viewerId),
        wishlist: this.wishlist.filter((item) => item.userId === viewerId),
        favoriteGroupIds: viewer.favoriteGroupIds,
        biasMemberIds: viewer.biasMemberIds,
        favoriteEraIds: viewer.favoriteEraIds,
        collectorInterests: viewer.collectorInterests,
      },
      {
        userId: otherId as UserId,
        holdings: this.holdings.filter((holding) => holding.ownerId === otherId),
        wishlist: this.wishlist.filter((item) => item.userId === otherId),
        favoriteGroupIds: other.favoriteGroupIds,
        biasMemberIds: other.biasMemberIds,
        favoriteEraIds: other.favoriteEraIds,
        collectorInterests: other.collectorInterests,
      },
      {
        template: (id) => TEMPLATE_BY_ID.get(id),
        groupName: (id) => GROUP_BY_ID.get(id)?.name ?? id,
        memberName: (id) => MEMBER_BY_ID.get(id)?.stageName ?? id,
        eraName: (id) => ERA_BY_ID.get(id)?.name ?? id,
      },
    );
  }

  private tradeItems(
    templateIds: string[],
    ownerId: string,
    theyOwnYourWants: string[],
    youOwnTheirWants: string[],
  ): SocialTradeItem[] {
    const theyWant = new Set(theyOwnYourWants);
    const youHave = new Set(youOwnTheirWants);
    return templateIds.flatMap((templateId) => {
      const template = TEMPLATE_BY_ID.get(templateId as CollectibleTemplate["id"]);
      if (!template) return [];
      const openToTrade = this.holdings.some((holding) => (
        holding.ownerId === ownerId
        && holding.templateId === templateId
        && holding.tradeStatus !== "not-for-trade"
      ));
      return [{
        templateId,
        name: template.name,
        kind: template.kind,
        groupName: GROUP_BY_ID.get(template.groupId)?.name,
        memberName: template.memberId ? MEMBER_BY_ID.get(template.memberId)?.stageName ?? null : null,
        colorway: template.colorway,
        onYourWishlist: theyWant.has(templateId),
        theyWantThis: youHave.has(templateId),
        openToTrade,
      }];
    });
  }

  private profileNames(userId: string) {
    const profile = PROFILES.find((item) => item.userId === userId);
    if (!profile) return [];
    return [
      ...profile.favoriteGroupIds.map((id) => GROUP_BY_ID.get(id)?.name),
      ...profile.biasMemberIds.map((id) => MEMBER_BY_ID.get(id)?.stageName),
      ...profile.favoriteEraIds.map((id) => ERA_BY_ID.get(id)?.name),
    ].filter((name): name is string => Boolean(name));
  }

  private themeFor(profile: (typeof PROFILES)[number]) {
    const room = ROOMS.find((item) => item.id === profile.roomId);
    const tokens = resolveProfileTheme(profile.appearance, room);
    return {
      scheme: tokens.scheme,
      paper: tokens.paper,
      mist: tokens.mist,
      ink: tokens.ink,
      mute: tokens.mute,
      line: tokens.line,
      primary: tokens.primary,
      primaryDeep: tokens.primaryDeep,
      primarySoft: tokens.primarySoft,
      action: tokens.action,
      cream: tokens.tint,
    };
  }

  private originOf(post: Post): Post {
    if (!post.repostOf) return post;
    return POSTS.find((item) => item.id === post.repostOf) ?? post;
  }

  private toPost(postId: string): NativeFeedPost | null {
    const post = POSTS.find((item) => item.id === postId);
    const author = USERS.find((user) => user.id === post?.authorId);
    if (!post || !author) return null;
    const origin = this.originOf(post);
    const originAuthor = USERS.find((user) => user.id === origin.authorId) ?? author;
    const taggedUsers = (origin.taggedUserIds ?? []).flatMap((id) => {
      const user = USERS.find((item) => item.id === id);
      return user ? [{ userId: user.id, displayName: user.displayName, handle: user.handle }] : [];
    });
    const taggedCollectibles = [...origin.templateIds, ...(origin.taggedTemplateIds ?? [])].flatMap((id) => {
      const template = TEMPLATE_BY_ID.get(id);
      return template ? [{
        templateId: template.id,
        name: template.name,
        kind: template.kind,
        colorway: template.colorway,
      }] : [];
    });
    const savedByMe = taggedCollectibles.length > 0
      && taggedCollectibles.every((tag) => this.wishlist.some((item) => item.userId === VIEWER && item.templateId === tag.templateId));
    return {
      id: post.id,
      caption: origin.body,
      createdAt: post.createdAt,
      location: post.repostOf ? undefined : post.location,
      author: { userId: author.id, displayName: author.displayName, handle: author.handle },
      likeCount: this.likes.filter((like) => like.postId === origin.id).length,
      commentCount: this.comments.filter((comment) => comment.postId === origin.id).length,
      likedByMe: this.likes.some((like) => like.postId === origin.id && like.userId === VIEWER),
      repostedByMe: this.reposts.has(origin.id),
      savedByMe,
      ...(post.repostOf ? { repostOf: post.repostOf, originAuthor: { userId: originAuthor.id, displayName: originAuthor.displayName, handle: originAuthor.handle } } : {}),
      media: (origin.media ?? []).flatMap((media) => {
        const url = demoAssetUri(media.kind === "video" ? media.poster ?? media.url : media.url);
        return url ? [{
          url,
          mediaType: media.kind === "video" ? "video" : "image",
          ...(media.kind === "video" && media.duration ? { duration: media.duration } : {}),
        }] : [];
      }),
      ...(demoAssetUri(PROFILES.find((profile) => profile.userId === author.id)?.avatarUrl)
        ? { authorAvatarUrl: demoAssetUri(PROFILES.find((profile) => profile.userId === author.id)?.avatarUrl) }
        : {}),
      taggedUsers,
      taggedCollectibles,
    };
  }

  private toComment(comment: PostComment) {
    const author = USERS.find((user) => user.id === comment.authorId) ?? USERS[0]!;
    return {
      id: comment.id,
      postId: comment.postId,
      body: comment.body,
      createdAt: comment.createdAt,
      author: { userId: author.id, displayName: author.displayName, handle: author.handle },
    };
  }

  private toNotice(notice: Notice): SocialNotice {
    const actor = USERS.find((user) => user.id === notice.actorId) ?? USERS[0]!;
    const avatarUrl = demoAssetUri(PROFILES.find((profile) => profile.userId === actor.id)?.avatarUrl);
    return {
      id: notice.id,
      kind: notice.kind,
      actor: {
        userId: actor.id,
        handle: actor.handle,
        displayName: actor.displayName,
        ...(avatarUrl ? { avatarUrl } : {}),
      },
      headline: notice.headline,
      createdAt: notice.createdAt,
      read: Boolean(notice.read),
      ...(notice.postId ? { postId: notice.postId } : {}),
      ...(notice.templateIds ? { templateIds: [...notice.templateIds] } : {}),
    };
  }
}

let demoRepository: DemoSocialRepository | null = null;

export function getDemoRepository(): SocialRepository {
  if (!isDemoWorldAllowed()) throw new Error("demo_world_forbidden");
  demoRepository ??= new DemoSocialRepository();
  return demoRepository;
}
