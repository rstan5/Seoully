"use server";

import { getTradeOpportunity } from "@/server/trade/service";

export async function getProductionTradeOpportunity(input: unknown) {
  try { return { ok: true as const, result: await getTradeOpportunity(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "trade_intelligence_failed" }; }
}
