import type {
  CollectibleTemplate,
  CollectionCompatibility,
  EraId,
  GroupId,
  Holding,
  MemberId,
  TemplateId,
  UserId,
  WishlistItem,
} from "./types";

/**
 * Collection compatibility.
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
 *    reveal. Conflating them produced obviously wrong output — it claimed two
 *    users "share I.N as a bias" purely because a random pull put him in both
 *    binders.
 */

const WEIGHTS = {
  /** Declared favorite groups. Coarse, but it's what people lead with. */
  groups: 0.22,
  /** Declared biases. The most personal signal there is. */
  bias: 0.2,
  /** Members actually present in both collections. Demonstrated, not claimed. */
  members: 0.15,
  /** Specific shared items. Proves depth. */
  items: 0.18,
  /** Shared eras — collectors who love the same comebacks recognize each other. */
  eras: 0.1,
  /** Two-way want/own complementarity: the signal that creates a reason to talk. */
  complement: 0.15,
} as const;

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
  /** Declared on the profile, not inferred from holdings. */
  favoriteGroupIds: GroupId[];
  biasMemberIds: MemberId[];
  favoriteEraIds: EraId[];
}

export interface CompatibilityResolvers {
  template: (id: TemplateId) => CollectibleTemplate | undefined;
  groupName: (id: GroupId) => string;
  memberName: (id: MemberId) => string;
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

  /** Members and eras a collector demonstrably engages with, via owned + wanted. */
  const demonstrated = (owned: Set<TemplateId>, wants: Set<TemplateId>) => {
    const members = new Set<MemberId>();
    const eras = new Set<EraId>();
    for (const templateId of [...owned, ...wants]) {
      const template = resolve.template(templateId);
      if (!template) continue;
      if (template.memberId) members.add(template.memberId);
      if (template.eraId) eras.add(template.eraId);
    }
    return { members, eras };
  };

  const aShown = demonstrated(aOwned, aWants);
  const bShown = demonstrated(bOwned, bWants);

  const aGroups = new Set(a.favoriteGroupIds);
  const bGroups = new Set(b.favoriteGroupIds);
  const aBias = new Set(a.biasMemberIds);
  const bBias = new Set(b.biasMemberIds);
  const aEras = new Set([...a.favoriteEraIds, ...aShown.eras]);
  const bEras = new Set([...b.favoriteEraIds, ...bShown.eras]);

  const sharedGroupIds = intersect(aGroups, bGroups);
  const sharedBiasIds = intersect(aBias, bBias);
  const sharedMemberIds = intersect(aShown.members, bShown.members);
  const sharedTemplateIds = intersect(aOwned, bOwned);

  const theyOwnYourWants = intersect(aWants, bOwned);
  const youOwnTheirWants = intersect(bWants, aOwned);

  // Complementarity saturates: four matching wants is a great reason to talk,
  // and forty is not ten times better.
  const complementCount = theyOwnYourWants.length + youOwnTheirWants.length;
  const complementScore = 1 - Math.exp(-complementCount / 3);

  const raw =
    overlap(aGroups, bGroups) * WEIGHTS.groups +
    overlap(aBias, bBias) * WEIGHTS.bias +
    overlap(aShown.members, bShown.members) * WEIGHTS.members +
    overlap(aOwned, bOwned) * WEIGHTS.items +
    overlap(aEras, bEras) * WEIGHTS.eras +
    complementScore * WEIGHTS.complement;

  const score = Math.round(raw * 100);

  // Reasons are ordered by how much they'd actually make someone click.
  const reasons: string[] = [];
  if (sharedBiasIds.length > 0) {
    reasons.push(`You share ${formatList(sharedBiasIds.map(resolve.memberName))} as a bias.`);
  }
  if (sharedGroupIds.length > 0) {
    reasons.push(`You both collect ${formatList(sharedGroupIds.slice(0, 3).map(resolve.groupName))}.`);
  }
  if (theyOwnYourWants.length > 0) {
    reasons.push(
      `They own ${theyOwnYourWants.length} ${plural(theyOwnYourWants.length, "item")} on your hunting list.`,
    );
  }
  if (youOwnTheirWants.length > 0) {
    reasons.push(
      `You own ${youOwnTheirWants.length} ${plural(youOwnTheirWants.length, "item")} they're hunting.`,
    );
  }
  if (sharedTemplateIds.length > 0) {
    reasons.push(`You share ${sharedTemplateIds.length} items.`);
  }

  return {
    userA: a.userId,
    userB: b.userId,
    score,
    sharedGroupIds,
    sharedMemberIds: sharedBiasIds.length > 0 ? sharedBiasIds : sharedMemberIds,
    sharedTemplateIds,
    theyOwnYourWants,
    youOwnTheirWants,
    reasons,
  };
}

function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
