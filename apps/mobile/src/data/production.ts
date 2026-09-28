import {
  addPostComment,
  loadCollectorPosts,
  loadCollectorProfile,
  loadFeed,
  loadMyHoldings,
  loadMyWishlist,
  loadPostComments,
  loadRoomDiscovery,
  resolveNativeIdentity,
  searchCatalog,
  searchCollectors,
  setCollectorFollowing,
  setPostLiked,
  setWishlistTemplate,
  type NativeIdentity,
} from "../api";
import type { SocialRepository } from "./types";

export const productionRepository: SocialRepository = {
  kind: "production",
  viewerId() {
    return null;
  },
  loadIdentity() {
    return resolveNativeIdentity<NativeIdentity>();
  },
  async loadFeed(mode, cursor) {
    if (mode === "discover") return { items: [], nextCursor: null };
    return loadFeed(cursor);
  },
  async loadSuggested() {
    return [];
  },
  async setPostLiked(postId, liked) {
    await setPostLiked(postId, liked);
  },
  loadPostComments,
  addPostComment,
  searchCollectors,
  searchCatalog,
  async searchPosts() {
    return [];
  },
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
  async searchRooms(query) {
    const [rooms, people] = await Promise.all([loadRoomDiscovery(), searchCollectors(query)]);
    const needle = query.trim().toLowerCase().replace(/^@+/, "");
    const matches = rooms.filter((room) => (
      room.collector.displayName.toLowerCase().includes(needle)
      || room.collector.handle.toLowerCase().includes(needle)
    ));
    const byUser = new Map(matches.map((room) => [room.collector.userId, room]));
    for (const person of people) {
      if (byUser.has(person.userId)) continue;
      byUser.set(person.userId, {
        roomId: person.userId,
        collector: person,
        rankScore: 0,
        displayedHoldingCount: 0,
        relevantDisplayedCount: 0,
        reasons: [],
      });
    }
    return [...byUser.values()];
  },
  async loadCollector(userId) {
    const [result, page] = await Promise.all([loadCollectorProfile(userId), loadCollectorPosts(userId)]);
    return {
      user: result.profile.user,
      profile: {
        tagline: result.profile.profile.tagline,
        bio: result.profile.profile.bio,
        location: result.profile.profile.location,
        collectorInterests: result.profile.profile.collectorInterests,
      },
      follow: result.follow,
      groups: [],
      biases: [],
      eras: [],
      holdings: [],
      holdingCount: result.profile.collectionSummary?.holdingCount ?? 0,
      wishlist: [],
      posts: page.items,
      roomAvailable: result.profile.roomAvailable,
    };
  },
  async setFollowing(userId, following) {
    await setCollectorFollowing(userId, following);
  },
  loadCollectorPosts,
  loadMyHoldings: () => loadMyHoldings(0, 100),
  loadMyWishlist: () => loadMyWishlist(0, 100),
  setWishlist: setWishlistTemplate,
  async loadFollowCounts() {
    const identity = await resolveNativeIdentity<NativeIdentity>();
    if (!identity?.user.id) return { followers: 0, followingCount: 0 };
    const result = await loadCollectorProfile(identity.user.id);
    return { followers: result.follow.followers, followingCount: result.follow.followingCount };
  },
};
