import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

const uuid = z.string().uuid();
const pageSchema = z.object({ limit: z.number().int().min(1).max(500).default(25), offset: z.number().int().min(0).max(10_000).default(0) }).strict();
type RpcRow = Record<string, unknown>;
const rpcRows = (value: unknown): RpcRow[] => Array.isArray(value) ? value.filter((row): row is RpcRow => Boolean(row && typeof row === "object")) : [];

export interface GraphCollector { userId: string; handle: string; displayName: string; }
export interface OwnerResult extends GraphCollector { ownedCopies: number; forTradeCopies: number; }
export interface WishlistOwnerResult extends OwnerResult { templateId: string; templateName: string; }
export interface WantedHoldingResult extends GraphCollector { templateId: string; templateName: string; holdingId: string; tradeStatus: string; }
export interface CollectionItem { holdingId: string; templateId: string; templateName: string; kind: string; groupId: string; memberId: string | null; releaseId: string | null; tradeStatus: string; displayed: boolean; }
export interface WishlistItemResult { entryId: string; templateId: string; templateName: string; kind: string; groupId: string; memberId: string | null; releaseId: string | null; }
export interface CoverageResult { knownToSeoully: number; ownedKnown: number; missingKnown: string[]; ownedKnownIds: string[]; }

async function identityAndClient() {
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  return { identity, supabase: await createSupabaseServerClient() };
}

export async function getMyCollection(input?: unknown): Promise<CollectionItem[]> {
  const page = pageSchema.parse(input ?? {}); const { identity, supabase } = await identityAndClient();
  const { data, error } = await supabase.from("holdings")
    .select("id,template_id,trade_status,collectible_templates!inner(id,name,kind,group_id,member_id,release_id),room_placements(id)")
    .eq("owner_user_id", identity.user.id).order("created_at", { ascending: false }).range(page.offset, page.offset + page.limit - 1);
  if (error) throw new Error("graph_collection_read_failed");
  return (data ?? []).map((row) => {
    const template = row.collectible_templates as unknown as Record<string, unknown>;
    return { holdingId: String(row.id), templateId: String(row.template_id), templateName: String(template.name), kind: String(template.kind), groupId: String(template.group_id), memberId: typeof template.member_id === "string" ? template.member_id : null, releaseId: typeof template.release_id === "string" ? template.release_id : null, tradeStatus: String(row.trade_status), displayed: Array.isArray(row.room_placements) && row.room_placements.length > 0 };
  });
}

export async function getMyWishlist(input?: unknown): Promise<WishlistItemResult[]> {
  const page = pageSchema.parse(input ?? {}); const { identity, supabase } = await identityAndClient();
  const { data, error } = await supabase.from("wishlist_entries")
    .select("id,template_id,collectible_templates!inner(id,name,kind,group_id,member_id,release_id)")
    .eq("owner_user_id", identity.user.id).order("created_at", { ascending: false }).range(page.offset, page.offset + page.limit - 1);
  if (error) throw new Error("graph_wishlist_read_failed");
  return (data ?? []).map((row) => { const t = row.collectible_templates as unknown as Record<string, unknown>; return { entryId: String(row.id), templateId: String(row.template_id), templateName: String(t.name), kind: String(t.kind), groupId: String(t.group_id), memberId: typeof t.member_id === "string" ? t.member_id : null, releaseId: typeof t.release_id === "string" ? t.release_id : null }; });
}

export async function findOwnersOfTemplate(input: unknown): Promise<OwnerResult[]> {
  const parsed = z.object({ templateId: uuid, limit: z.number().int().min(1).max(50).default(25), offset: z.number().int().min(0).max(10_000).default(0) }).strict().parse(input); const { templateId } = parsed; const page = parsed;
  const { supabase } = await identityAndClient();
  const { data, error } = await supabase.rpc("graph_owners_of_template", { p_template_id: templateId, p_limit: page.limit, p_offset: page.offset });
  if (error) throw new Error("graph_owners_read_failed");
  return rpcRows(data).map((row) => ({ userId: String(row.user_id), handle: String(row.handle), displayName: String(row.display_name), ownedCopies: Number(row.holding_count), forTradeCopies: Number(row.for_trade_count) }));
}

export async function findWantersOfTemplate(input: unknown): Promise<GraphCollector[]> {
  const parsed = z.object({ templateId: uuid, limit: z.number().int().min(1).max(50).default(25), offset: z.number().int().min(0).max(10_000).default(0) }).strict().parse(input); const { templateId } = parsed; const page = parsed; const { supabase } = await identityAndClient();
  const { data, error } = await supabase.rpc("graph_wanters_of_template", { p_template_id: templateId, p_limit: page.limit, p_offset: page.offset });
  if (error) throw new Error("graph_wanters_read_failed");
  return rpcRows(data).map((row) => ({ userId: String(row.user_id), handle: String(row.handle), displayName: String(row.display_name) }));
}

export async function findOwnersOfMyWishlist(input?: unknown): Promise<WishlistOwnerResult[]> {
  const page = pageSchema.parse(input ?? {}); const { supabase } = await identityAndClient();
  const { data, error } = await supabase.rpc("graph_owners_of_my_wishlist", { p_limit: page.limit, p_offset: page.offset });
  if (error) throw new Error("graph_wishlist_owners_read_failed");
  return rpcRows(data).map((row) => ({ userId: String(row.user_id), handle: String(row.handle), displayName: String(row.display_name), templateId: String(row.template_id), templateName: String(row.template_name), ownedCopies: Number(row.holding_count), forTradeCopies: Number(row.for_trade_count) }));
}

export async function findCollectorsWantingMyItems(input?: unknown): Promise<WantedHoldingResult[]> {
  const page = pageSchema.parse(input ?? {}); const { supabase } = await identityAndClient();
  const { data, error } = await supabase.rpc("graph_collectors_wanting_my_items", { p_limit: page.limit, p_offset: page.offset });
  if (error) throw new Error("graph_wanters_read_failed");
  return rpcRows(data).map((row) => ({ userId: String(row.user_id), handle: String(row.handle), displayName: String(row.display_name), templateId: String(row.template_id), templateName: String(row.template_name), holdingId: String(row.holding_id), tradeStatus: String(row.trade_status) }));
}

export async function getCollectionOverlap(input: unknown) {
  const parsed = z.object({ targetUserId: uuid, limit: z.number().int().min(1).max(100).default(100) }).strict().parse(input); const { targetUserId } = parsed; const { supabase } = await identityAndClient();
  const { data, error } = await supabase.rpc("graph_overlap", { p_target_user_id: targetUserId, p_limit: parsed.limit });
  if (error) throw new Error("graph_overlap_read_failed");
  const rows = rpcRows(data);
  return { sharedTemplates: rows.map((row) => String(row.template_id)), sharedGroups: [...new Set(rows.map((row) => String(row.group_id)))], sharedMembers: [...new Set(rows.filter((row) => row.member_id).map((row) => String(row.member_id)))], sharedReleases: [...new Set(rows.filter((row) => row.release_id).map((row) => String(row.release_id)))], targetUserId };
}

export async function getCollectionBreakdown(input?: unknown) {
  z.object({}).strict().parse(input ?? {});
  const items = await getMyCollection({ limit: 500, offset: 0 });
  const by = (key: (item: CollectionItem) => string) => Object.fromEntries([...items.reduce((map, item) => map.set(key(item), (map.get(key(item)) ?? 0) + 1), new Map<string, number>())]);
  const wishlist = await getMyWishlist({ limit: 500, offset: 0 });
  return { totalHoldings: items.length, uniqueTemplates: new Set(items.map((item) => item.templateId)).size, forTradeHoldings: items.filter((item) => item.tradeStatus === "for-trade").length, wishlistCount: wishlist.length, byGroup: by((item) => item.groupId), byMember: by((item) => item.memberId ?? "unassigned"), byRelease: by((item) => item.releaseId ?? "unassigned"), byType: by((item) => item.kind), displayedHoldings: items.filter((item) => item.displayed).length, storedHoldings: items.filter((item) => !item.displayed).length };
}

export async function getKnownCoverage(input: unknown): Promise<CoverageResult> {
  const filters = z.object({ groupId: uuid.optional(), memberId: uuid.optional(), releaseId: uuid.optional() }).strict().parse(input);
  const { identity, supabase } = await identityAndClient();
  let query = supabase.from("collectible_templates").select("id").neq("status", "restricted").limit(500);
  if (filters.groupId) query = query.eq("group_id", filters.groupId); if (filters.memberId) query = query.eq("member_id", filters.memberId); if (filters.releaseId) query = query.eq("release_id", filters.releaseId);
  const { data: templates, error } = await query; if (error) throw new Error("graph_coverage_read_failed");
  const { data: holdings, error: holdingError } = await supabase.from("holdings").select("template_id").eq("owner_user_id", identity.user.id).limit(500);
  if (holdingError) throw new Error("graph_coverage_read_failed");
  const known = (templates ?? []).map((row) => String(row.id)); const owned = new Set((holdings ?? []).map((row) => String(row.template_id))); const ownedKnownIds = known.filter((id) => owned.has(id));
  return { knownToSeoully: known.length, ownedKnown: ownedKnownIds.length, missingKnown: known.filter((id) => !owned.has(id)), ownedKnownIds };
}

export async function getReciprocalRelationships(input?: unknown) {
  z.object({}).strict().parse(input ?? {});
  const [owners, wanted] = await Promise.all([findOwnersOfMyWishlist({ limit: 50, offset: 0 }), findCollectorsWantingMyItems({ limit: 50, offset: 0 })]);
  const byUser = new Map<string, { collector: GraphCollector; theyOwnThatIWant: WishlistOwnerResult[]; iOwnThatTheyWant: WantedHoldingResult[] }>();
  for (const item of owners) { const current = byUser.get(item.userId) ?? { collector: item, theyOwnThatIWant: [], iOwnThatTheyWant: [] }; current.theyOwnThatIWant.push(item); byUser.set(item.userId, current); }
  for (const item of wanted) { const current = byUser.get(item.userId) ?? { collector: item, theyOwnThatIWant: [], iOwnThatTheyWant: [] }; current.iOwnThatTheyWant.push(item); byUser.set(item.userId, current); }
  return [...byUser.values()].filter((item) => item.theyOwnThatIWant.length > 0 && item.iOwnThatTheyWant.length > 0);
}
