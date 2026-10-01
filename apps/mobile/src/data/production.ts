import {
  addPostComment,
  askSeoullyNative,
  loadCollectorDiscovery,
  loadCollectorMatch,
  loadCollectorPosts,
  loadCollectorProfile,
  loadCollectorCollection,
  loadConversations as loadProductionConversations,
  loadDirectMessages,
  loadFeed,
  loadMyHoldings,
  loadProductionNotices,
  loadMyWishlist,
  loadNativeOnboarding,
  loadPostComments,
  markConversationRead as markProductionConversationRead,
  markProductionNoticesRead,
  removeHolding,
  resolveNativeIdentity,
  searchCatalog,
  searchCollectors,
  searchDiscoverCollectibles,
  searchPosts,
  searchRooms,
  sendDirectMessage as sendProductionDirectMessage,
  setCollectorFollowing,
  setPostLiked,
  setWishlistTemplate,
  updateHoldingTradeStatus,
  type NativeCollectorMatch,
  type NativeIdentity,
} from "../api";
import { parseAskResult } from "seoully-domain/ask-result";
import { LIVE_CAPABILITIES } from "./capabilities";
import { liveNoticePage, liveRepostResult, liveSaveResult, liveShareResult } from "./honesty";
import type { NativeAskContext, NativeAskResult, SocialCompatibility, SocialConversation, SocialMessage, SocialNotice, SocialRepository, SocialSendMessageInput, SocialShareRecipient, SocialTradeItem } from "./types";

function matchItems(items: NativeCollectorMatch["trade"]["theyOwnYourWants"], side: "they" | "you"): SocialTradeItem[] {
  return items.map((item) => ({
    templateId: item.templateId,
    name: item.name,
    kind: "",
    onYourWishlist: side === "they",
    theyWantThis: side === "you",
    openToTrade: item.openToTrade,
  }));
}

function toCompatibility(match: NativeCollectorMatch): SocialCompatibility {
  return {
    score: match.compatibility.score,
    source: "production",
    reasons: match.compatibility.reasons
      .filter((reason) => reason.count > 0)
      .map((reason) => `${reason.code}:${reason.count}`),
    theyOwnYourWants: matchItems(match.trade.theyOwnYourWants, "they"),
    youOwnTheirWants: matchItems(match.trade.youOwnTheirWants, "you"),
    reciprocal: match.trade.reciprocal,
  };
}

export const productionRepository: SocialRepository = {
  kind: "production",
  capabilities: LIVE_CAPABILITIES,
  viewerId() {
    return null;
  },
  loadIdentity() {
    return resolveNativeIdentity<NativeIdentity>();
  },
  async loadFeed(mode, cursor) {
    return loadFeed(cursor, mode);
  },
  async loadSuggested() {
    try {
      const items = await loadCollectorDiscovery();
      return items.map((item) => ({
        user: {
          userId: item.collector.userId,
          handle: item.collector.handle,
          displayName: item.collector.displayName,
        },
        score: item.compatibilityScore,
        meta: `${item.compatibilityScore}% match`,
        subtitleKind: item.reciprocal ? "reciprocal" as const : item.wishlistItemsOwnedCount ? "wishlist" as const : undefined,
      }));
    } catch {
      return [];
    }
  },
  async setPostLiked(postId, liked) {
    await setPostLiked(postId, liked);
  },
  async setPostReposted() {
    return liveRepostResult();
  },
  async setPostSaved() {
    return liveSaveResult();
  },
  loadPostComments,
  addPostComment,
  searchCollectors,
  searchCatalog,
  searchDiscoverCollectibles,
  searchPosts,
  searchRooms,
  async searchEntities(query) {
    const catalog = await searchCatalog(query);
    const groups = new Map<string, { id: string; kind: "group"; title: string; query: string }>();
    const members = new Map<string, { id: string; kind: "member"; title: string; subtitle?: string; query: string }>();
    for (const item of catalog) {
      if (item.groupId && item.groupName && !groups.has(item.groupId)) {
        groups.set(item.groupId, { id: item.groupId, kind: "group", title: item.groupName, query: item.groupName });
      }
      if (item.memberId && item.memberName && !members.has(item.memberId)) {
        members.set(item.memberId, {
          id: item.memberId,
          kind: "member",
          title: item.memberName,
          subtitle: item.groupName,
          query: item.memberName,
        });
      }
    }
    return [...groups.values(), ...members.values()].slice(0, 24);
  },
  async loadCollector(userId) {
    const [result, page, tastes, match, collection] = await Promise.all([
      loadCollectorProfile(userId),
      loadCollectorPosts(userId),
      loadNativeOnboarding().catch(() => null),
      loadCollectorMatch(userId).catch(() => null),
      loadCollectorCollection(userId),
    ]);
    const groupIds = result.profile.profile.favoriteGroupIds ?? [];
    const biasIds = result.profile.profile.biasMemberIds ?? [];
    const holdings = collection.collectionPublic ? collection.holdings.map((holding) => ({
      id: holding.id,
      templateId: holding.templateId,
      acquiredAt: holding.acquiredAt,
      tradeStatus: holding.tradeStatus,
      template: holding.template,
    })) : [];
    const wishlist = collection.wishlistPublic ? collection.wishlist : [];
    return {
      user: result.profile.user,
      profile: {
        tagline: result.profile.profile.tagline,
        bio: result.profile.profile.bio,
        location: result.profile.profile.location,
        collectorType: result.profile.profile.collectorType,
        collectorInterests: result.profile.profile.collectorInterests,
      },
      follow: result.follow,
      groups: (tastes?.groups ?? []).filter((group) => groupIds.includes(group.id)).map((group) => ({ id: group.id, name: group.name })),
      biases: (tastes?.members ?? []).filter((member) => biasIds.includes(member.id)).map((member) => ({ id: member.id, name: member.stageName })),
      eras: [],
      holdings,
      holdingCount: holdings.length,
      wishlist,
      visibility: {
        collectionPublic: collection.collectionPublic,
        wishlistPublic: collection.wishlistPublic,
      },
      posts: page.items,
      ...(match ? { compatibility: toCompatibility(match) } : {}),
      roomAvailable: result.profile.roomAvailable,
    };
  },
  async setFollowing(userId, following) {
    await setCollectorFollowing(userId, following);
  },
  loadCollectorPosts,
  loadMyHoldings: (offset = 0, limit = 100) => loadMyHoldings(offset, limit),
  loadMyWishlist: (offset = 0, limit = 100) => loadMyWishlist(offset, limit),
  setWishlist: setWishlistTemplate,
  setHoldingTradeStatus: updateHoldingTradeStatus,
  removeHolding,
  async loadFollowCounts() {
    const identity = await resolveNativeIdentity<NativeIdentity>();
    if (!identity?.user.id) return { followers: 0, followingCount: 0 };
    const result = await loadCollectorProfile(identity.user.id);
    return { followers: result.follow.followers, followingCount: result.follow.followingCount };
  },
  async loadNotices(): Promise<{ items: SocialNotice[]; persisted: boolean }> {
    if (!LIVE_CAPABILITIES.persistNotices) return liveNoticePage();
    const page = await loadProductionNotices();
    return {
      items: page.items.map((item) => ({
        ...item,
        headline: item.kind,
      })),
      persisted: true,
    };
  },
  async unreadNoticeCount() {
    if (!LIVE_CAPABILITIES.persistNotices) return 0;
    const page = await loadProductionNotices();
    return page.unreadCount;
  },
  async markNoticesRead() {
    if (!LIVE_CAPABILITIES.persistNotices) return;
    await markProductionNoticesRead();
  },
  async searchShareRecipients(query: string): Promise<SocialShareRecipient[]> {
    const needle = query.trim();
    if (!needle) return [];
    return searchCollectors(needle);
  },
  async sendShare(postId: string, peerUserId: string, body: string) {
    if (!LIVE_CAPABILITIES.deliverShare || !LIVE_CAPABILITIES.persistMessages) return liveShareResult();
    await sendProductionDirectMessage({ peerUserId, postId, body });
    return { delivered: true };
  },
  async loadConversations(): Promise<SocialConversation[]> {
    if (!LIVE_CAPABILITIES.persistMessages) return [];
    const items = await loadProductionConversations();
    return items.map((item) => ({ ...item, unread: Boolean(item.unread) }));
  },
  async loadMessages(conversationId: string): Promise<SocialMessage[]> {
    if (!LIVE_CAPABILITIES.persistMessages) return [];
    const items = await loadDirectMessages(conversationId);
    return items.map((item) => ({
      id: item.id,
      conversationId: item.conversationId,
      body: item.body,
      createdAt: item.createdAt,
      mine: item.mine,
      post: item.post ?? null,
      collectibles: item.collectibles ?? [],
    }));
  },
  async sendMessage(input: SocialSendMessageInput): Promise<SocialMessage> {
    if (!LIVE_CAPABILITIES.persistMessages) throw new Error("messages_unavailable");
    const item = await sendProductionDirectMessage(input);
    return {
      id: item.id,
      conversationId: item.conversationId,
      body: item.body,
      createdAt: item.createdAt,
      mine: item.mine,
      post: item.post ?? null,
      collectibles: item.collectibles ?? [],
    };
  },
  async markConversationRead(conversationId: string) {
    if (!LIVE_CAPABILITIES.persistMessages) return;
    await markProductionConversationRead(conversationId);
  },
  async askSeoully(question: string, locale: "en" | "ko", history: { role: "user" | "assistant"; content: string }[], context?: NativeAskContext): Promise<NativeAskResult> {
    const payload = await askSeoullyNative({ locale, question, history, context: context ?? { surface: "home" } });
    const parsed = parseAskResult(payload);
    if (!parsed.reply && !parsed.cards.length) throw new Error("assistant_unavailable");
    return {
      reply: parsed.reply,
      cards: parsed.cards,
      ...(parsed.navigation ? { navigation: parsed.navigation } : {}),
    };
  },
};
