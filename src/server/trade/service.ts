import "server-only";

import { z } from "zod";
import { getCollectionPairSnapshot, type PairPerson } from "@/server/dal/collection-graph-pair";

const inputSchema = z.object({ targetUserId: z.string().uuid() }).strict();
export type TradeStrength = "NONE" | "ONE_WAY" | "RECIPROCAL" | "RECIPROCAL_FOR_TRADE";

export interface TradeRelationship {
  templateId: string;
  templateName: string;
  ownedCopies: number;
  forTradeCopies: number;
}

export interface TradeOpportunity {
  userId: string;
  targetUserId: string;
  theyOwnThatIWant: TradeRelationship[];
  theyHaveForTradeThatIWant: TradeRelationship[];
  iOwnThatTheyWant: TradeRelationship[];
  iHaveForTradeThatTheyWant: TradeRelationship[];
  reciprocal: boolean;
  reciprocalForTrade: boolean;
  strength: TradeStrength;
  visibility: { collectionVisible: boolean; wishlistVisible: boolean };
}

function aggregate(person: PairPerson, templateIds: Set<string>): TradeRelationship[] {
  const map = new Map<string, TradeRelationship>();
  for (const holding of person.holdings) {
    if (!templateIds.has(holding.template_id)) continue;
    const current = map.get(holding.template_id) ?? { templateId: holding.template_id, templateName: holding.template_name, ownedCopies: 0, forTradeCopies: 0 };
    current.ownedCopies += 1;
    if (holding.trade_status === "for-trade" || holding.trade_status === "open-to-offers") current.forTradeCopies += 1;
    map.set(holding.template_id, current);
  }
  return [...map.values()].sort((a, b) => a.templateId.localeCompare(b.templateId)).slice(0, 50);
}

export async function getTradeOpportunity(input: unknown): Promise<TradeOpportunity> {
  const { targetUserId } = inputSchema.parse(input);
  const snapshot = await getCollectionPairSnapshot(targetUserId);
  const a = snapshot.actor!;
  const b = snapshot.target!;
  const aOwned = new Set(a.holdings.map((holding) => holding.template_id));
  const bOwned = new Set(b.holdings.map((holding) => holding.template_id));
  const aWants = new Set(a.wishlist_template_ids);
  const bWants = new Set(b.wishlist_template_ids);
  const theyOwnIds = new Set([...aWants].filter((id) => bOwned.has(id)));
  const iOwnIds = new Set([...bWants].filter((id) => aOwned.has(id)));
  const theyOwnThatIWant = aggregate(b, theyOwnIds);
  const iOwnThatTheyWant = aggregate(a, iOwnIds);
  const theyHaveForTradeThatIWant = theyOwnThatIWant.filter((item) => item.forTradeCopies > 0);
  const iHaveForTradeThatTheyWant = iOwnThatTheyWant.filter((item) => item.forTradeCopies > 0);
  const reciprocal = theyOwnThatIWant.length > 0 && iOwnThatTheyWant.length > 0;
  const reciprocalForTrade = theyHaveForTradeThatIWant.length > 0 && iHaveForTradeThatTheyWant.length > 0;
  const strength: TradeStrength = reciprocalForTrade ? "RECIPROCAL_FOR_TRADE" : reciprocal ? "RECIPROCAL" : (theyOwnThatIWant.length || iOwnThatTheyWant.length) ? "ONE_WAY" : "NONE";
  return {
    userId: a.user_id,
    targetUserId: b.user_id,
    theyOwnThatIWant,
    theyHaveForTradeThatIWant,
    iOwnThatTheyWant,
    iHaveForTradeThatTheyWant,
    reciprocal,
    reciprocalForTrade,
    strength,
    visibility: { collectionVisible: snapshot.target_collection_public !== false, wishlistVisible: snapshot.target_wishlist_public !== false },
  };
}
