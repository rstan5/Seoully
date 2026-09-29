export type SocialCapabilities = {
  discoverFeed: boolean;
  persistRepost: boolean;
  persistSave: boolean;
  deliverShare: boolean;
  persistMessages: boolean;
  persistNotices: boolean;
  publicCollectionRows: boolean;
  searchPosts: boolean;
  persistRoom: boolean;
  persistRoomTheme: boolean;
};

/** Live production: only claim capabilities that have a real contract today. */
export const LIVE_CAPABILITIES: SocialCapabilities = {
  discoverFeed: false,
  persistRepost: false,
  persistSave: false,
  deliverShare: false,
  persistMessages: false,
  persistNotices: false,
  publicCollectionRows: false,
  searchPosts: false,
  persistRoom: true,
  persistRoomTheme: false,
};

/** Demo fixtures: local-only. Messages and Room stay honestly unavailable. */
export const DEMO_CAPABILITIES: SocialCapabilities = {
  discoverFeed: true,
  persistRepost: true,
  persistSave: true,
  deliverShare: true,
  persistMessages: false,
  persistNotices: true,
  publicCollectionRows: true,
  searchPosts: true,
  persistRoom: false,
  persistRoomTheme: false,
};
