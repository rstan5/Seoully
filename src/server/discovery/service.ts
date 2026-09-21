import "server-only";

import { z } from "zod";
import { getDiscoveryCandidateBatch, getDiscoveryCatalog, asPairPerson, type DiscoveryCandidate } from "@/server/dal/discovery";
import type { PairPerson } from "@/server/dal/collection-graph-pair";
import { computeCompatibilityPeople } from "@/server/compatibility/service";
import { computeTradeOpportunity } from "@/server/trade/service";

const optionsSchema = z.object({ limit: z.number().int().min(1).max(25).default(25) }).strict();

export type DiscoveryReasonCode = "HIGH_COLLECTION_OVERLAP" | "SHARED_GROUP" | "SHARED_MEMBER" | "SHARED_RELEASE" | "OWNS_WISHLIST_ITEM" | "WISHLIST_ITEM_FOR_TRADE" | "WANTS_YOUR_ITEM" | "RECIPROCAL_COLLECTION_INTEREST" | "RECIPROCAL_FOR_TRADE" | "COLLECTED_GROUP" | "COLLECTED_MEMBER" | "COLLECTED_RELEASE" | "FAVORITE_GROUP" | "BIAS_MEMBER" | "KNOWN_MISSING_ITEM" | "DISPLAYED_RELEVANT_ITEM";
export interface DiscoveryReason { code: DiscoveryReasonCode; ids?: string[]; count?: number; }

export interface CollectorDiscoveryResult { collector: { userId: string; handle: string; displayName: string }; rankScore: number; compatibilityScore: number; evidenceStrength: string; wishlistItemsOwnedCount: number; wishlistItemsForTradeCount: number; itemsTheyWantFromMeCount: number; reciprocal: boolean; reciprocalForTrade: boolean; reasons: DiscoveryReason[]; }
export interface RoomDiscoveryResult { roomId: string; collector: { userId: string; handle: string; displayName: string }; rankScore: number; displayedHoldingCount: number; relevantDisplayedCount: number; reasons: DiscoveryReason[]; }
export interface CollectibleDiscoveryResult { template: { id: string; name: string; kind: string; groupId: string; memberId: string | null; releaseId: string | null }; rankScore: number; reasons: DiscoveryReason[]; }

function diversify<T>(items: T[], limit: number, key: (item: T) => string | null): T[] {
  const result: T[] = [];
  const deferred: T[] = [];
  let previous: string | null = null;
  let run = 0;
  for (const item of items) {
    const current = key(item);
    if (current && current === previous && run >= 2) deferred.push(item);
    else { result.push(item); run = current === previous ? run + 1 : 1; previous = current; }
    if (result.length >= limit) break;
  }
  for (const item of deferred) { if (result.length >= limit) break; result.push(item); }
  return result;
}

function rankCollector(actor: PairPerson, candidate: DiscoveryCandidate): CollectorDiscoveryResult {
  const compatibility = computeCompatibilityPeople(actor, asPairPerson(candidate), candidate.user_id, false);
  const trade = computeTradeOpportunity(actor, asPairPerson(candidate), candidate.user_id, true, candidate.wishlist_public);
  const wishlistItemsOwnedCount = trade.theyOwnThatIWant.length;
  const wishlistItemsForTradeCount = trade.theyHaveForTradeThatIWant.length;
  const itemsTheyWantFromMeCount = trade.iOwnThatTheyWant.length;
  const score = Math.round(
    compatibility.score * 0.45
    + Math.min(wishlistItemsOwnedCount / 3, 1) * 25
    + Math.min(wishlistItemsForTradeCount / 2, 1) * 15
    + Math.min(itemsTheyWantFromMeCount / 3, 1) * 10
    + (trade.reciprocal ? 5 : 0),
  );
  const reasons: DiscoveryReason[] = [];
  if (compatibility.score >= 40) reasons.push({ code: "HIGH_COLLECTION_OVERLAP" });
  if (compatibility.sharedGroups.length) reasons.push({ code: "SHARED_GROUP", ids: compatibility.sharedGroups.slice(0, 5), count: compatibility.sharedGroups.length });
  if (compatibility.sharedMembers.length) reasons.push({ code: "SHARED_MEMBER", ids: compatibility.sharedMembers.slice(0, 5), count: compatibility.sharedMembers.length });
  if (compatibility.sharedReleases.length) reasons.push({ code: "SHARED_RELEASE", ids: compatibility.sharedReleases.slice(0, 5), count: compatibility.sharedReleases.length });
  if (wishlistItemsOwnedCount) reasons.push({ code: "OWNS_WISHLIST_ITEM", count: wishlistItemsOwnedCount });
  if (wishlistItemsForTradeCount) reasons.push({ code: "WISHLIST_ITEM_FOR_TRADE", count: wishlistItemsForTradeCount });
  if (itemsTheyWantFromMeCount) reasons.push({ code: "WANTS_YOUR_ITEM", count: itemsTheyWantFromMeCount });
  if (trade.reciprocal) reasons.push({ code: "RECIPROCAL_COLLECTION_INTEREST" });
  if (trade.reciprocalForTrade) reasons.push({ code: "RECIPROCAL_FOR_TRADE" });
  return { collector: { userId: candidate.user_id, handle: candidate.handle, displayName: candidate.display_name }, rankScore: Math.min(100, score), compatibilityScore: compatibility.score, evidenceStrength: compatibility.evidenceStrength, wishlistItemsOwnedCount, wishlistItemsForTradeCount, itemsTheyWantFromMeCount, reciprocal: trade.reciprocal, reciprocalForTrade: trade.reciprocalForTrade, reasons };
}

export async function discoverCollectors(input?: unknown): Promise<CollectorDiscoveryResult[]> {
  const { limit } = optionsSchema.parse(input ?? {});
  const batch = await getDiscoveryCandidateBatch({ limit: 100 });
  const ranked = batch.candidates.map((candidate) => rankCollector(batch.actor, candidate)).sort((a, b) => b.rankScore - a.rankScore || b.compatibilityScore - a.compatibilityScore || a.collector.displayName.localeCompare(b.collector.displayName) || a.collector.userId.localeCompare(b.collector.userId));
  return diversify(ranked, limit, (item) => item.reasons.find((reason) => reason.code === "SHARED_GROUP")?.ids?.[0] ?? null);
}

export async function discoverRooms(input?: unknown): Promise<RoomDiscoveryResult[]> {
  const { limit } = optionsSchema.parse(input ?? {});
  const batch = await getDiscoveryCandidateBatch({ limit: 100 });
  const results = batch.candidates.filter((candidate) => candidate.room).map((candidate) => {
    const collector = rankCollector(batch.actor, candidate);
    const room = candidate.room!;
    const relevantDisplayedCount = 0;
    const rankScore = Math.round(collector.rankScore * 0.8 + Math.min(relevantDisplayedCount / 3, 1) * 20);
    const reasons: DiscoveryReason[] = collector.reasons.filter((reason) => ["HIGH_COLLECTION_OVERLAP", "SHARED_GROUP", "SHARED_MEMBER", "SHARED_RELEASE", "OWNS_WISHLIST_ITEM", "WISHLIST_ITEM_FOR_TRADE"].includes(reason.code));
    if (relevantDisplayedCount) reasons.push({ code: "DISPLAYED_RELEVANT_ITEM", count: relevantDisplayedCount });
    return { roomId: room.room_id, collector: collector.collector, rankScore, displayedHoldingCount: room.displayed_holding_count, relevantDisplayedCount, reasons };
  }).sort((a, b) => b.rankScore - a.rankScore || b.relevantDisplayedCount - a.relevantDisplayedCount || a.roomId.localeCompare(b.roomId));
  return results.slice(0, limit);
}

export async function discoverCollectibles(input?: unknown): Promise<CollectibleDiscoveryResult[]> {
  const { limit } = optionsSchema.parse(input ?? {});
  const batch = await getDiscoveryCandidateBatch({ limit: 1 });
  const catalog = await getDiscoveryCatalog({ limit: 200, offset: 0 });
  const owned = new Set(batch.actor.holdings.map((holding) => holding.template_id));
  const wanted = new Set(batch.actor.wishlist_template_ids);
  const ownedGroups = new Set(batch.actor.holdings.map((holding) => holding.group_id));
  const ownedMembers = new Set(batch.actor.holdings.flatMap((holding) => holding.member_id ? [holding.member_id] : []));
  const ownedReleases = new Set(batch.actor.holdings.flatMap((holding) => holding.release_id ? [holding.release_id] : []));
  const favoriteGroups = new Set(batch.actor.favorite_group_ids);
  const biasMembers = new Set(batch.actor.bias_member_ids);
  const ranked = catalog.filter((item) => !owned.has(item.id) && !wanted.has(item.id)).map((item) => {
    const reasons: DiscoveryReason[] = [];
    const group = ownedGroups.has(item.groupId); const member = item.memberId ? ownedMembers.has(item.memberId) : false; const release = item.releaseId ? ownedReleases.has(item.releaseId) : false; const favorite = favoriteGroups.has(item.groupId); const bias = item.memberId ? biasMembers.has(item.memberId) : false;
    if (group) reasons.push({ code: "COLLECTED_GROUP", ids: [item.groupId] });
    if (member) reasons.push({ code: "COLLECTED_MEMBER", ids: item.memberId ? [item.memberId] : [] });
    if (release) reasons.push({ code: "COLLECTED_RELEASE", ids: item.releaseId ? [item.releaseId] : [] });
    if (release) reasons.push({ code: "KNOWN_MISSING_ITEM", ids: item.releaseId ? [item.releaseId] : [] });
    if (favorite) reasons.push({ code: "FAVORITE_GROUP", ids: [item.groupId] });
    if (bias) reasons.push({ code: "BIAS_MEMBER", ids: item.memberId ? [item.memberId] : [] });
    const rankScore = group ? 40 : 0;
    const score = Math.min(100, rankScore + (member ? 25 : 0) + (release ? 15 : 0) + (favorite ? 10 : 0) + (bias ? 10 : 0));
    return { template: { id: item.id, name: item.name, kind: item.kind, groupId: item.groupId, memberId: item.memberId, releaseId: item.releaseId }, rankScore: score, reasons };
  }).sort((a, b) => b.rankScore - a.rankScore || a.template.name.localeCompare(b.template.name) || a.template.id.localeCompare(b.template.id));
  return diversify(ranked, limit, (item) => item.template.groupId);
}
