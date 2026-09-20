"use server";

import { createMyHolding, getMyHolding, listMyHoldings, removeMyHolding, setMyHoldingTradeStatus } from "@/server/dal/holdings";

export async function createHolding(input: unknown) {
  try { return { ok: true as const, holding: await createMyHolding(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "holding_create_failed" }; }
}

export async function listHoldings(input?: unknown) {
  try { return { ok: true as const, holdings: await listMyHoldings(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "holding_read_failed" }; }
}

export async function getHolding(input: unknown) {
  try { return { ok: true as const, holding: await getMyHolding(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "holding_read_failed" }; }
}

export async function removeHolding(input: unknown) {
  try { return { ok: true as const, result: await removeMyHolding(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "holding_delete_failed" }; }
}

export async function setHoldingTradeStatus(input: unknown) {
  try { return { ok: true as const, holding: await setMyHoldingTradeStatus(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "holding_trade_update_failed" }; }
}
