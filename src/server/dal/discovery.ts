import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { PairPerson } from "@/server/dal/collection-graph-pair";

const uuid = z.string().uuid();
const holdingSchema = z.object({ holding_id: uuid, template_id: uuid, template_name: z.string(), group_id: uuid, member_id: uuid.nullable(), release_id: uuid.nullable(), kind: z.string(), trade_status: z.string() }).strict();
const personSchema = z.object({ user_id: uuid, holdings: z.array(holdingSchema).max(500), wishlist_template_ids: z.array(uuid).max(500), favorite_group_ids: z.array(z.string()).max(24), bias_member_ids: z.array(z.string()).max(48), favorite_era_ids: z.array(z.string()).max(48), collector_interests: z.array(z.string()).max(7) }).strict();
const candidateSchema = z.object({ user_id: uuid, handle: z.string(), display_name: z.string(), collection_public: z.boolean(), wishlist_public: z.boolean(), holdings: z.array(holdingSchema).max(500), wishlist_template_ids: z.array(uuid).max(500), favorite_group_ids: z.array(z.string()).max(24), bias_member_ids: z.array(z.string()).max(48), favorite_era_ids: z.array(z.string()).max(48), collector_interests: z.array(z.string()).max(7), room: z.object({ room_id: uuid, displayed_holding_count: z.number().int().nonnegative() }).nullable() }).strict();
const batchSchema = z.object({ actor: personSchema, candidates: z.array(candidateSchema).max(100) }).strict();

export type DiscoveryCandidate = z.infer<typeof candidateSchema>;
export type DiscoveryBatch = { actor: PairPerson; candidates: DiscoveryCandidate[] };

export interface DiscoveryCatalogItem { id: string; name: string; kind: string; groupId: string; memberId: string | null; releaseId: string | null; status: string; }

export async function getDiscoveryCandidateBatch(input?: unknown): Promise<DiscoveryBatch> {
  const limit = z.object({ limit: z.number().int().min(1).max(100).default(100) }).strict().parse(input ?? {}).limit;
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("graph_discovery_candidates", { p_limit: limit });
  if (error) throw new Error("discovery_candidates_failed");
  const parsed = batchSchema.parse(data);
  return { actor: parsed.actor as PairPerson, candidates: parsed.candidates };
}

export async function getDiscoveryCatalog(input?: unknown): Promise<DiscoveryCatalogItem[]> {
  const page = z.object({ limit: z.number().int().min(1).max(200).default(200), offset: z.number().int().min(0).max(10_000).default(0) }).strict().parse(input ?? {});
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("collectible_templates").select("id,name,kind,group_id,member_id,release_id,status").neq("status", "restricted").order("name").range(page.offset, page.offset + page.limit - 1);
  if (error) throw new Error("discovery_catalog_failed");
  return (data ?? []).map((row) => ({ id: String(row.id), name: String(row.name), kind: String(row.kind), groupId: String(row.group_id), memberId: typeof row.member_id === "string" ? row.member_id : null, releaseId: typeof row.release_id === "string" ? row.release_id : null, status: String(row.status) }));
}

export function asPairPerson(candidate: DiscoveryCandidate): PairPerson { return candidate as PairPerson; }
