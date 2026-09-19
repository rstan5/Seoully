import type {
  CollectibleTemplate,
  CollectionCompatibility,
  CollectorInterest,
  EraId,
  GroupId,
  Holding,
  MemberId,
  TemplateId,
  TradeStatus,
  UserId,
  WishlistItem,
} from "./types";

/**
 * Collection compatibility — the collection graph as a number and a few reasons.
 *
 * Pure function over sets so it can run client-side against fixtures now and
 * move to a materialized view later without changing meaning.
 *
 * Two modeling decisions worth defending, because both are easy to get wrong:
 *
 * 1. **Overlap coefficient, not Jaccard.** Jaccard divides by the union, which
 *    punishes people for owning a lot. A collector with 400 items and one with
 *    40 who share 35 of the smaller collection are extremely compatible, but
 *    Jaccard scores them near zero. Overlap coefficient — intersection over the
 *    *smaller* set — asks the question we actually mean: "of the narrower
 *    taste here, how much is shared?"
 *
 * 2. **Declared taste and demonstrated taste are separate signals.** Owning a
 *    card of a member is not the same as that member being your bias; you get
 *    cards you didn't choose in every album. So declared biases and favorite
 *    groups (from the profile) are weighted separately from what the holdings
 *    reveal.
 *
 * Wishlist/ownership matches use actual wishlist rows and actual holdings.
 * Placement and trade status never create a match. "Open to trade" is a label
 * the UI may attach to a specific owned copy — it is not a trade.
 */

const WEIGHTS = {
  groups: 0.2,
  bias: 0.18,
  members: 0.12,
  items: 0.16,
  eras: 0.08,
  interests: 0.08,
  complement: 0.18,
} as const;

const INTEREST_LABEL: Record<CollectorInterest, string> = {
  photocards: "photocards",
  albums: "albums",
  merch: "merch",
  vinyl: "vinyl",
  posters: "posters",
  lightsticks: "lightsticks",
  everything: "everything",
};

/** Intersection over the smaller set. See note 1 above. */
function overlap<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const value of a) if (b.has(value)) hits += 1;
  return hits / Math.min(a.size, b.size);
}

function intersect<T>(a: Set<T>, b: Set<T>): T[] {
  const out: T[] = [];
  for (const value of a) if (b.has(value)) out.push(value);
  return out;
}

export interface CompatibilityInput {
  userId: UserId;
  holdings: Holding[];
  wishlist: WishlistItem[];
  favoriteGroupIds: GroupId[];
  biasMemberIds: MemberId[];
  favoriteEraIds: EraId[];
  collectorInterests?: CollectorInterest[];
}

export interface CompatibilityResolvers {
  template: (id: TemplateId) => CollectibleTemplate | undefined;
  groupName: (id: GroupId) => string;
  memberName: (id: MemberId) => string;
  eraName?: (id: EraId) => string;
}

export function computeCompatibility(
  a: CompatibilityInput,
  b: CompatibilityInput,
  resolve: CompatibilityResolvers,
): CollectionCompatibility {
  const aOwned = new Set(a.holdings.map((h) => h.templateId));
  const bOwned = new Set(b.holdings.map((h) => h.templateId));
  const aWants = new Set(a.wishlist.map((w) => w.templateId));
  const bWants = new Set(b.wishlist.map((w) => w.templateId));

  const demonstratedMembers = (owned: Set<TemplateId>) => {
    const members = new Set<MemberId>();
    for (const templateId of owned) {
      const template = resolve.template(templateId);
      if (template?.memberId) members.add(template.memberId);
    }
    return members;
  };

  const aGroups = new Set(a.favoriteGroupIds);
  const bGroups = new Set(b.favoriteGroupIds);
  const aBias = new Set(a.biasMemberIds);
  const bBias = new Set(b.biasMemberIds);
  const aEras = new Set(a.favoriteEraIds);
  const bEras = new Set(b.favoriteEraIds);
  const aInterests = new Set(a.collectorInterests ?? []);
  const bInterests = new Set(b.collectorInterests ?? []);

  const sharedGroupIds = intersect(aGroups, bGroups);
  const sharedBiasIds = intersect(aBias, bBias);
  const sharedMemberIds = intersect(demonstratedMembers(aOwned), demonstratedMembers(bOwned));
  const sharedTemplateIds = intersect(aOwned, bOwned);
  const sharedEraIds = intersect(aEras, bEras);
  const sharedInterestIds = intersect(aInterests, bInterests);

  const theyOwnYourWants = intersect(aWants, bOwned);
  const youOwnTheirWants = intersect(bWants, aOwned);
  const reciprocal = theyOwnYourWants.length > 0 && youOwnTheirWants.length > 0;
  const potentialTradeMatches = reciprocal
    ? uniqueIds([...theyOwnYourWants, ...youOwnTheirWants])
    : [];

  const complementCount = theyOwnYourWants.length + youOwnTheirWants.length;
  const complementScore = 1 - Math.exp(-complementCount / 3);

  const raw =
    overlap(aGroups, bGroups) * WEIGHTS.groups +
    overlap(aBias, bBias) * WEIGHTS.bias +
    overlap(demonstratedMembers(aOwned), demonstratedMembers(bOwned)) * WEIGHTS.members +
    overlap(aOwned, bOwned) * WEIGHTS.items +
    overlap(aEras, bEras) * WEIGHTS.eras +
    overlap(aInterests, bInterests) * WEIGHTS.interests +
    complementScore * WEIGHTS.complement;

  const score = Math.round(raw * 100);
  const reasons = explain({
    sharedGroupIds,
    sharedBiasIds,
    sharedEraIds,
    sharedInterestIds,
    theyOwnYourWants,
    youOwnTheirWants,
    reciprocal,
    resolve,
  });

  return {
    userA: a.userId,
    userB: b.userId,
    score,
    sharedGroupIds,
    sharedBiasIds,
    sharedMemberIds,
    sharedInterestIds,
    sharedTemplateIds,
    theyOwnYourWants,
    youOwnTheirWants,
    wishlistMatches: theyOwnYourWants,
    reciprocalMatches: youOwnTheirWants,
    sharedEraIds,
    potentialTradeMatches,
    potentialTrades: potentialTradeMatches,
    reasons,
  };
}

export function sharedInterestCount(compat: CollectionCompatibility): number {
  return (
    compat.sharedGroupIds.length +
    compat.sharedBiasIds.length +
    compat.sharedEraIds.length +
    compat.sharedInterestIds.length
  );
}

function uniqueIds(ids: TemplateId[]): TemplateId[] {
  return [...new Set(ids)];
}

function explain({
  sharedGroupIds,
  sharedBiasIds,
  sharedEraIds,
  sharedInterestIds,
  theyOwnYourWants,
  youOwnTheirWants,
  reciprocal,
  resolve,
}: {
  sharedGroupIds: GroupId[];
  sharedBiasIds: MemberId[];
  sharedEraIds: EraId[];
  sharedInterestIds: CollectorInterest[];
  theyOwnYourWants: TemplateId[];
  youOwnTheirWants: TemplateId[];
  reciprocal: boolean;
  resolve: CompatibilityResolvers;
}): string[] {
  const reasons: string[] = [];
  for (const groupId of sharedGroupIds.slice(0, 2)) {
    reasons.push(`You both collect ${resolve.groupName(groupId)}`);
  }
  for (const memberId of sharedBiasIds.slice(0, 2)) {
    reasons.push(`You both collect ${resolve.memberName(memberId)}`);
  }
  if (theyOwnYourWants.length === 1) {
    reasons.push("They own something on your wishlist");
  } else if (theyOwnYourWants.length > 1) {
    reasons.push(`They own ${theyOwnYourWants.length} things on your wishlist`);
  }
  if (youOwnTheirWants.length === 1) {
    reasons.push("You own something they want");
  } else if (youOwnTheirWants.length > 1) {
    reasons.push(`You own ${youOwnTheirWants.length} things they want`);
  }
  if (reciprocal) reasons.push("Potential trade match");
  if (sharedInterestIds.length > 0) {
    reasons.push(`You both collect ${formatList(sharedInterestIds.slice(0, 2).map((id) => INTEREST_LABEL[id]))}`);
  }
  if (sharedEraIds.length > 0 && resolve.eraName) {
    reasons.push(`You both collect ${formatList(sharedEraIds.slice(0, 2).map(resolve.eraName))}`);
  }
  return reasons.slice(0, 6);
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function isOpenToTrade(status: TradeStatus): boolean {
  return status === "for-trade" || status === "open-to-offers";
}

/** One collectible's relationship between two collectors. Never inferred from catalog. */
export interface MatchRelation {
  templateId: TemplateId;
  theyOwn: boolean;
  youOwn: boolean;
  theyWant: boolean;
  youWant: boolean;
  theyOwnYourWant: boolean;
  youOwnTheirWant: boolean;
  potentialTrade: boolean;
  relationship: string;
  /** Their owned copy is marked for trade. Placement does not affect this. */
  theirCopyOpenToTrade: boolean;
}

export function relationshipLine(theyOwnYourWant: boolean, youOwnTheirWant: boolean): string {
  if (theyOwnYourWant && youOwnTheirWant) return "Potential trade match.";
  if (theyOwnYourWant) return "They own this — it's on your wishlist.";
  if (youOwnTheirWant) return "You own this — it's on their wishlist.";
  return "";
}

export function describeMatch(
  viewer: CompatibilityInput,
  other: CompatibilityInput,
  templateId: TemplateId,
  potentialTrade: boolean,
): MatchRelation {
  const theyOwn = other.holdings.some((holding) => holding.templateId === templateId);
  const youOwn = viewer.holdings.some((holding) => holding.templateId === templateId);
  const theyWant = other.wishlist.some((item) => item.templateId === templateId);
  const youWant = viewer.wishlist.some((item) => item.templateId === templateId);
  const theyOwnYourWant = theyOwn && youWant;
  const youOwnTheirWant = youOwn && theyWant;
  return {
    templateId,
    theyOwn,
    youOwn,
    theyWant,
    youWant,
    theyOwnYourWant,
    youOwnTheirWant,
    potentialTrade,
    relationship: relationshipLine(theyOwnYourWant, youOwnTheirWant),
    theirCopyOpenToTrade: other.holdings.some(
      (holding) => holding.templateId === templateId && isOpenToTrade(holding.tradeStatus),
    ),
  };
}
