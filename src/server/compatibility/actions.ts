"use server";

import { getCollectorCompatibility } from "@/server/compatibility/service";

export async function getProductionCompatibility(input: unknown) {
  try { return { ok: true as const, result: await getCollectorCompatibility(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "compatibility_failed" }; }
}
