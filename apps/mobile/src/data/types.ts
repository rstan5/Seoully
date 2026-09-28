import type {
  NativeCatalogTemplate,
  NativeCommentPage,
  NativeFeedPage,
  NativeFeedPost,
  NativeHolding,
  NativeIdentity,
  NativePostComment,
  NativeRoomDiscovery,
  NativeSearchUser,
  NativeWishlistEntry,
} from "../api";

export type FeedMode = "following" | "discover";

export type SocialSuggested = {
  user: NativeSearchUser;
  score: number;
  meta: string;
  avatarUrl?: string;
};

export type SocialEntity = {
  id: string;
  kind: "group" | "member";
  title: string;
  subtitle?: string;
  query: string;
};

export type SocialCollector = {
  user: { id: string; handle: string; displayName: string; joinedAt: string };
  profile: {
    tagline: string;
    bio: string;
    location?: string;
    collectorType?: string;
    collectorInterests: string[];
  };
  avatarUrl?: string;
  follow: { following: boolean; followers: number; followingCount: number };
  groups: { id: string; name: string }[];
  biases: { id: string; name: string }[];
  eras: { id: string; name: string }[];
  holdings: NativeHolding[];
  holdingCount: number;
  wishlist: NativeWishlistEntry[];
  posts: NativeFeedPost[];
  compatibility?: { score: number; reasons: string[] };
  roomAvailable: boolean;
};

export interface SocialRepository {
  kind: "production" | "demo";
  viewerId(): string | null;
  loadIdentity(): Promise<NativeIdentity | null>;
  loadFeed(mode: FeedMode, cursor?: string): Promise<NativeFeedPage>;
  loadSuggested(): Promise<SocialSuggested[]>;
  setPostLiked(postId: string, liked: boolean): Promise<void>;
  loadPostComments(postId: string, cursor?: string): Promise<NativeCommentPage>;
  addPostComment(postId: string, body: string): Promise<NativePostComment>;
  searchCollectors(query: string): Promise<NativeSearchUser[]>;
  searchCatalog(query: string): Promise<NativeCatalogTemplate[]>;
  searchPosts(query: string): Promise<NativeFeedPost[]>;
  searchEntities(query: string): Promise<SocialEntity[]>;
  searchRooms(query: string): Promise<NativeRoomDiscovery[]>;
  loadCollector(userId: string): Promise<SocialCollector>;
  setFollowing(userId: string, following: boolean): Promise<void>;
  loadCollectorPosts(userId: string, cursor?: string): Promise<NativeFeedPage>;
  loadMyHoldings(): Promise<NativeHolding[]>;
  loadMyWishlist(): Promise<NativeWishlistEntry[]>;
  setWishlist(templateId: string, wanted: boolean): Promise<void>;
  loadFollowCounts(): Promise<{ followers: number; followingCount: number }>;
}
