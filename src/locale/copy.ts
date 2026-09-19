import type { CollectionCompatibility, CollectibleKind, CollectorInterest, Condition, Notice, Rarity, TradeStatus, ZoneKind } from "@/domain/types";
import { en, type MessageKey } from "./en";
import type { Translate } from "./translate";

const KIND_KEY: Record<CollectibleKind, MessageKey> = {
  photocard: "kind.photocard",
  album: "kind.album",
  vinyl: "kind.vinyl",
  poster: "kind.poster",
  lightstick: "kind.lightstick",
  plushie: "kind.plushie",
  figure: "kind.figure",
  book: "kind.book",
  apparel: "kind.apparel",
  memorabilia: "kind.memorabilia",
};

const INTEREST_KEY: Record<CollectorInterest, MessageKey> = {
  photocards: "interest.photocards",
  albums: "interest.albums",
  merch: "interest.merch",
  vinyl: "interest.vinyl",
  posters: "interest.posters",
  lightsticks: "interest.lightsticks",
  everything: "interest.everything",
};

const TYPE_KEY: Record<string, MessageKey> = {
  Collector: "type.collector",
  "Collects everything": "type.everything",
  "Completionist · era-focused": "type.completionist",
  "Bias-focused · aesthetic curator": "type.biasCurator",
};

const RARITY_KEY: Record<Rarity, MessageKey> = {
  common: "rarity.common",
  uncommon: "rarity.uncommon",
  rare: "rarity.rare",
  grail: "rarity.grail",
};

const CONDITION_KEY: Record<Condition, MessageKey> = {
  mint: "condition.mint",
  "near-mint": "condition.near-mint",
  good: "condition.good",
  played: "condition.played",
  damaged: "condition.damaged",
};

const TRADE_KEY: Record<TradeStatus, MessageKey> = {
  "for-trade": "trade.for-trade",
  "open-to-offers": "trade.open-to-offers",
  "for-sale": "trade.for-sale",
  "not-for-trade": "trade.not-for-trade",
};

const HOME_KEY: Record<ZoneKind, MessageKey> = {
  binder: "home.inBinder",
  shelf: "home.onShelf",
  wall: "home.onWall",
  "display-case": "home.inCase",
  archive: "home.inArchive",
  desk: "home.onDesk",
};

const NOTICE_HEADLINE: Record<string, MessageKey> = {
  "liked your concert post": "notice.likedPost",
  "liked your post": "notice.likedPost",
  "commented on your post": "notice.commented",
  "started following you": "notice.followed",
  "reposted your post": "notice.reposted",
  "owns something on your wishlist": "notice.ownsWishlist",
  "completed the IVE SWITCH photocard set": "notice.completedSwitchSet",
};

const NOTICE_KIND: Record<Notice["kind"], MessageKey> = {
  like: "notice.likedPost",
  comment: "notice.commented",
  follow: "notice.followed",
  repost: "notice.reposted",
  trade: "notice.ownsWishlist",
  activity: "notice.activity",
};

const THEME_KEY: Record<string, MessageKey> = {
  paper: "theme.paper",
  "warm-cream": "theme.warm-cream",
  "soft-lavender": "theme.soft-lavender",
  "powder-pink": "theme.powder-pink",
  "baby-blue": "theme.baby-blue",
  mint: "theme.mint",
  peach: "theme.peach",
  "soft-gray": "theme.soft-gray",
  "deep-navy": "theme.deep-navy",
  "midnight-purple": "theme.midnight-purple",
  "dark-plum": "theme.dark-plum",
  charcoal: "theme.charcoal",
  lavender: "theme.lavender",
  lilac: "theme.lilac",
  rose: "theme.rose",
  periwinkle: "theme.periwinkle",
  plum: "theme.plum",
  "deep-blue": "theme.deep-blue",
  "soft-lilac": "theme.soft-lilac",
};

export function kindLabel(kind: CollectibleKind, t: Translate): string {
  return t(KIND_KEY[kind]);
}

export function interestLabel(id: CollectorInterest, t: Translate): string {
  return t(INTEREST_KEY[id]);
}

export function collectorTypeLabel(value: string, t: Translate): string {
  const key = TYPE_KEY[value];
  return key ? t(key) : value;
}

export function rarityLabel(value: Rarity, t: Translate): string {
  return t(RARITY_KEY[value]);
}

export function conditionLabel(value: Condition, t: Translate): string {
  return t(CONDITION_KEY[value]);
}

export function tradeLabel(value: TradeStatus, t: Translate): string {
  return t(TRADE_KEY[value]);
}

export function homeWhere(zone: ZoneKind, t: Translate): string {
  return t(HOME_KEY[zone]);
}

export function themePresetLabel(id: string, fallback: string, t: Translate): string {
  const key = THEME_KEY[id];
  return key ? t(key) : fallback;
}

export function noticeCopy(notice: Notice, t: Translate): string {
  const fromHeadline = NOTICE_HEADLINE[notice.headline];
  return t(fromHeadline ?? NOTICE_KIND[notice.kind]);
}

export function relationCopy(theyOwnYourWant: boolean, youOwnTheirWant: boolean, t: Translate): string {
  if (theyOwnYourWant && youOwnTheirWant) return t("compat.tradeMatchDot");
  if (theyOwnYourWant) return t("compat.theyOwnThisWishlist");
  if (youOwnTheirWant) return t("compat.youOwnThisWishlist");
  return "";
}

export function compatibilityLines(
  compat: CollectionCompatibility,
  names: { group: (id: string) => string | undefined; member: (id: string) => string | undefined; era: (id: string) => string | undefined },
  t: Translate,
): string[] {
  const lines: string[] = [];
  for (const id of compat.sharedGroupIds.slice(0, 2)) {
    const name = names.group(id);
    if (name) lines.push(t("compat.bothCollect", { name }));
  }
  for (const id of compat.sharedBiasIds.slice(0, 2)) {
    const name = names.member(id);
    if (name) lines.push(t("compat.bothCollect", { name }));
  }
  if (compat.theyOwnYourWants.length === 1) lines.push(t("compat.theyOwnWishlist"));
  else if (compat.theyOwnYourWants.length > 1) {
    lines.push(t("compat.theyOwnWishlistCount", { count: compat.theyOwnYourWants.length }));
  }
  if (compat.youOwnTheirWants.length === 1) lines.push(t("compat.youOwnWanted"));
  else if (compat.youOwnTheirWants.length > 1) {
    lines.push(t("compat.youOwnWantedCount", { count: compat.youOwnTheirWants.length }));
  }
  if (compat.potentialTradeMatches.length > 0) lines.push(t("compat.tradeMatch"));
  for (const id of compat.sharedInterestIds.slice(0, 2)) {
    lines.push(t("compat.bothCollect", { name: interestLabel(id, t) }));
  }
  for (const id of compat.sharedEraIds.slice(0, 2)) {
    const name = names.era(id);
    if (name) lines.push(t("compat.bothCollect", { name }));
  }
  return lines.slice(0, 6);
}

export function photoErrorKey(code: "too-large" | "not-image" | "unreadable"): MessageKey {
  if (code === "too-large") return "error.photoTooLarge";
  if (code === "not-image") return "error.photoNotImage";
  return "error.photoUnreadable";
}

export function localizeError(error: string, t: Translate): string {
  return error in en ? t(error as MessageKey) : error;
}
