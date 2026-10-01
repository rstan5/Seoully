import type {
  NativeCatalogTemplate,
  NativeCollectibleSearchHit,
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
import type { SocialCapabilities } from "./capabilities";
import type { AskNavigationAction, AskSurfaceContext } from "seoully-domain/ask-context";

export type FeedMode = "following" | "discover";

export type SocialSuggested = {
  user: NativeSearchUser;
  score: number;
  meta: string;
  subtitle?: string;
  subtitleKind?: "reciprocal" | "wishlist";
  avatarUrl?: string;
};

export type SocialTheme = {
  scheme: "light" | "dark";
  paper: string;
  mist: string;
  ink: string;
  mute: string;
  line: string;
  primary: string;
  primaryDeep: string;
  primarySoft: string;
  action: string;
  onPrimary: string;
  secondary: string;
  secondarySoft: string;
  cream: string;
};

export type SocialEntity = {
  id: string;
  kind: "group" | "member";
  title: string;
  subtitle?: string;
  query: string;
};

export type SocialTradeItem = {
  templateId: string;
  name: string;
  kind: string;
  groupName?: string;
  memberName?: string | null;
  colorway?: { base: string; accent: string; ink: string };
  imageUrl?: string;
  onYourWishlist: boolean;
  theyWantThis: boolean;
  openToTrade: boolean;
};

export type SocialCompatibility = {
  score: number;
  /** `domain` = fixture computeCompatibility. `production` = computeCompatibilityPeople. Do not merge. */
  source: "domain" | "production";
  reasons: string[];
  theyOwnYourWants: SocialTradeItem[];
  youOwnTheirWants: SocialTradeItem[];
  reciprocal: boolean;
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
  visibility: { collectionPublic: boolean; wishlistPublic: boolean };
  posts: NativeFeedPost[];
  compatibility?: SocialCompatibility;
  roomAvailable: boolean;
  theme?: SocialTheme;
};

export type SocialNotice = {
  id: string;
  kind: "like" | "comment" | "follow" | "trade" | "activity" | "repost";
  actor: { userId: string; handle: string; displayName: string; avatarUrl?: string };
  headline: string;
  createdAt: string;
  read: boolean;
  postId?: string;
  templateIds?: string[];
};

export type SocialShareRecipient = NativeSearchUser;

export type SocialShareResult = { delivered: boolean };

export type SocialConversation = {
  id: string;
  peer: { userId: string; handle: string; displayName: string; avatarUrl?: string };
  lastMessage: {
    body: string;
    createdAt: string;
    mine: boolean;
    postId?: string;
    templateCount?: number;
  } | null;
  unread: boolean;
};

export type SocialMessagePost = {
  id: string;
  authorUserId: string;
  authorHandle: string;
  caption: string;
  mediaUrl?: string;
};

export type SocialMessageCollectible = {
  templateId: string;
  name: string;
  kind: string;
  colorway?: { base: string; accent: string; ink: string };
};

export type SocialMessage = {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  mine: boolean;
  post: SocialMessagePost | null;
  collectibles: SocialMessageCollectible[];
};

export type SocialSendMessageInput = {
  conversationId?: string;
  peerUserId: string;
  body: string;
  postId?: string;
  templateIds?: string[];
};

export type NativeAskCard = {
  kind: "collector" | "collectible" | "room" | "holding";
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  action?: AskNavigationAction;
};

export type NativeAskResult = {
  reply: string;
  cards: NativeAskCard[];
  navigation?: AskNavigationAction;
};

export type NativeAskContext = AskSurfaceContext;

export interface SocialRepository {
  kind: "production" | "demo";
  capabilities: SocialCapabilities;
  viewerId(): string | null;
  loadIdentity(): Promise<NativeIdentity | null>;
  loadFeed(mode: FeedMode, cursor?: string): Promise<NativeFeedPage>;
  loadSuggested(): Promise<SocialSuggested[]>;
  setPostLiked(postId: string, liked: boolean): Promise<void>;
  setPostReposted(postId: string, reposted: boolean): Promise<{ persisted: boolean }>;
  setPostSaved(postId: string, saved: boolean): Promise<{ persisted: boolean }>;
  loadPostComments(postId: string, cursor?: string): Promise<NativeCommentPage>;
  addPostComment(postId: string, body: string): Promise<NativePostComment>;
  searchCollectors(query: string): Promise<NativeSearchUser[]>;
  searchCatalog(query: string): Promise<NativeCatalogTemplate[]>;
  searchDiscoverCollectibles(query: string): Promise<NativeCollectibleSearchHit[]>;
  searchPosts(query: string): Promise<NativeFeedPost[]>;
  searchEntities(query: string): Promise<SocialEntity[]>;
  searchRooms(query: string): Promise<NativeRoomDiscovery[]>;
  loadCollector(userId: string): Promise<SocialCollector>;
  setFollowing(userId: string, following: boolean): Promise<void>;
  loadCollectorPosts(userId: string, cursor?: string): Promise<NativeFeedPage>;
  loadMyHoldings(offset?: number, limit?: number): Promise<NativeHolding[]>;
  loadMyWishlist(offset?: number, limit?: number): Promise<NativeWishlistEntry[]>;
  setWishlist(templateId: string, wanted: boolean): Promise<void>;
  setHoldingTradeStatus(holdingId: string, tradeStatus: NativeHolding["tradeStatus"]): Promise<NativeHolding>;
  removeHolding(holdingId: string): Promise<void>;
  loadFollowCounts(): Promise<{ followers: number; followingCount: number }>;
  loadNotices(): Promise<{ items: SocialNotice[]; persisted: boolean }>;
  unreadNoticeCount(): Promise<number>;
  markNoticesRead(): Promise<void>;
  searchShareRecipients(query: string): Promise<SocialShareRecipient[]>;
  sendShare(postId: string, peerUserId: string, body: string): Promise<SocialShareResult>;
  loadConversations(): Promise<SocialConversation[]>;
  loadMessages(conversationId: string): Promise<SocialMessage[]>;
  sendMessage(input: SocialSendMessageInput): Promise<SocialMessage>;
  markConversationRead(conversationId: string): Promise<void>;
  askSeoully(question: string, locale: "en" | "ko", history: { role: "user" | "assistant"; content: string }[], context?: NativeAskContext): Promise<NativeAskResult>;
}
