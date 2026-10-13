import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
export const collectorCountInput = z.object({ templateIds: z.array(z.string().uuid()).max(100) }).strict();
export async function readPhotocardCollectorCounts(input: unknown, client: SupabaseClient): Promise<Record<string, number>> {
  const { templateIds } = collectorCountInput.parse(input);
  const { data, error } = await client.rpc("get_photocard_collector_counts", { p_template_ids: [...new Set(templateIds)] });
  if (error) throw new Error(error.code === "42501" ? "unauthenticated" : "collector_counts_unavailable");
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const raw = row.collector_count;
    const count = typeof raw === "number" || (typeof raw === "string" && /^\d+$/.test(raw)) ? Number(raw) : NaN;
    if (templateIds.includes(row.template_id) && Number.isSafeInteger(count) && count >= 0) counts[row.template_id] = count;
  }
  return counts;
}
