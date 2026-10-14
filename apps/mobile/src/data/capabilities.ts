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
  discoverFeed: true,
  persistRepost: true,
  persistSave: false,
  deliverShare: true,
  persistMessages: true,
  persistNotices: true,
  publicCollectionRows: true,
  searchPosts: true,
  persistRoom: true,
  persistRoomTheme: false,
};

/** Demo fixtures: local-only. Room stays honestly unavailable. Messages stay on this device. */
export const DEMO_CAPABILITIES: SocialCapabilities = {
  discoverFeed: true,
  persistRepost: true,
  persistSave: true,
  deliverShare: true,
  persistMessages: true,
  persistNotices: true,
  publicCollectionRows: true,
  searchPosts: true,
  persistRoom: false,
  persistRoomTheme: false,
};
