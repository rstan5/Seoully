import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getMyCollection, getMyWishlist, getCollectionBreakdown, findOwnersOfTemplate, findWantersOfTemplate, findOwnersOfMyWishlist, findCollectorsWantingMyItems, getReciprocalRelationships, getKnownCoverage } from "@/server/dal/collection-graph";
import { searchSharedCatalog, getSharedCatalogTemplate } from "@/server/dal/catalog";
import { getCollectorCompatibility } from "@/server/compatibility/service";
import { getTradeOpportunity } from "@/server/trade/service";
import { discoverCollectors, discoverRooms, discoverCollectibles } from "@/server/discovery/service";

const limitSchema = z.object({ limit: z.number().int().min(1).max(25).default(8) }).strict();
const querySchema = z.object({ query: z.string().trim().max(120).default(""), limit: z.number().int().min(1).max(25).default(8) }).strict();
const targetSchema = z.object({ query: z.string().trim().max(120).default(""), targetUserId: z.string().uuid().optional() }).strict();
const navigationSchema = z.object({ destination: z.enum(["profile", "room", "collection", "wishlist", "search"]), query: z.string().trim().max(120).optional(), targetUserId: z.string().uuid().optional() }).strict();
const templateSchema = z.object({ templateId: z.string().uuid(), limit: z.number().int().min(1).max(25).default(8) }).strict();
const contextSchema = z.object({ surface: z.string().max(40).default("home"), targetUserId: z.string().uuid().optional(), profileUserId: z.string().uuid().optional(), templateId: z.string().uuid().optional(), roomId: z.string().uuid().optional() }).strict();

export const assistantSurfaceContextSchema = contextSchema;
export type AssistantSurfaceContext = z.infer<typeof contextSchema>;
export interface AssistantCard { kind: "collector" | "collectible" | "room" | "holding"; id: string; title: string; subtitle?: string; detail?: string; action?: { type: string; userId?: string; query?: string; destination?: string }; }
export interface AssistantToolOutput { tool: string; data: unknown; cards: AssistantCard[]; action?: AssistantCard["action"]; }

type Executor = (input: unknown, context: AssistantSurfaceContext) => Promise<AssistantToolOutput>;
interface ToolDefinition { name: string; description: string; input: z.ZodTypeAny; execute: Executor; maxResults: number; }

function card(kind: AssistantCard["kind"], id: string, title: string, subtitle?: string, detail?: string, action?: AssistantCard["action"]): AssistantCard { return { kind, id, title, ...(subtitle ? { subtitle } : {}), ...(detail ? { detail } : {}), ...(action ? { action } : {}) }; }

async function identityClient() { const identity = await getCurrentIdentity(); if (!identity) throw new Error("unauthenticated"); return { identity, supabase: await createSupabaseServerClient() }; }

async function resolveTarget(input: z.infer<typeof targetSchema>, context: AssistantSurfaceContext, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, actorId: string): Promise<string> {
  const target = input.targetUserId ?? context.targetUserId ?? context.profileUserId;
  if (target && target !== actorId) return target;
  if (!input.query) throw new Error("target_required");
  const raw = input.query.replace(/[%(),]/g, " ").trim();
  const explicit = raw.match(/\b(?:does|about|with|for|are|is)\s+([a-z0-9][a-z0-9 _-]{1,39})/i)?.[1]?.trim();
  const q = (explicit ?? raw).split(/\s+(?:have|has|own|want|anything|anything|and|from|trade|compatible|like)\b/i)[0]!.trim();
  const { data, error } = await supabase.from("profiles").select("user_id").or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`).neq("user_id", actorId).limit(2);
  if (error || !data?.length) throw new Error("collector_not_found");
  if (data.length > 1) throw new Error("collector_ambiguous");
  return String(data[0]!.user_id);
}

function catalogCards(items: Awaited<ReturnType<typeof searchSharedCatalog>>): AssistantCard[] { return items.slice(0, 8).map((item) => card("collectible", item.id, item.name, [item.groupName, item.memberName, item.releaseName].filter(Boolean).join(" · "), item.status, { type: "search", query: item.name, destination: "collectibles" })); }

const tools: ToolDefinition[] = [
  { name: "get_my_collection", description: "Read the authenticated user's production Holdings.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await getMyCollection(input); return { tool: "get_my_collection", data: { count: items.length, items: items.slice(0, 25) }, cards: items.slice(0, 8).map((item) => card("holding", item.holdingId, item.templateName, item.kind, item.tradeStatus, { type: "collection" })) }; } },
  { name: "get_my_collection_breakdown", description: "Summarize the authenticated user's production collection.", input: z.object({}).strict(), maxResults: 1, execute: async () => ({ tool: "get_my_collection_breakdown", data: await getCollectionBreakdown({}), cards: [] }) },
  { name: "get_my_wishlist", description: "Read the authenticated user's production wishlist.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await getMyWishlist(input); return { tool: "get_my_wishlist", data: { count: items.length, items: items.slice(0, 25) }, cards: items.slice(0, 8).map((item) => card("collectible", item.templateId, item.templateName, item.kind, undefined, { type: "wishlist" })) }; } },
  { name: "find_wishlist_owners", description: "Find visible collectors who own items on my wishlist.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await findOwnersOfMyWishlist(input); return { tool: "find_wishlist_owners", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.userId, item.displayName, `@${item.handle}`, `${item.ownedCopies} owned · ${item.forTradeCopies} for trade`, { type: "profile", userId: item.userId })) }; } },
  { name: "find_collectors_wanting_my_items", description: "Find visible collectors whose wishlist contains my owned items.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await findCollectorsWantingMyItems(input); return { tool: "find_collectors_wanting_my_items", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.userId, item.displayName, `@${item.handle}`, item.templateName, { type: "profile", userId: item.userId })) }; } },
  { name: "find_reciprocal_collection_relationships", description: "Find factual reciprocal visible ownership and wishlist relationships.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await getReciprocalRelationships({}); return { tool: "find_reciprocal_collection_relationships", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.collector.userId, item.collector.displayName, `@${item.collector.handle}`, "Reciprocal collection interest", { type: "profile", userId: item.collector.userId })) }; } },
  { name: "find_missing_known_collectibles", description: "Compare my Holdings against currently known catalog items.", input: z.object({ groupId: z.string().uuid().optional(), memberId: z.string().uuid().optional(), releaseId: z.string().uuid().optional() }).strict(), maxResults: 25, execute: async (input) => ({ tool: "find_missing_known_collectibles", data: await getKnownCoverage(input), cards: [] }) },
  { name: "find_collectible_owners", description: "Find visible collectors who own a specific catalog collectible.", input: templateSchema, maxResults: 8, execute: async (input) => ({ tool: "find_collectible_owners", data: await findOwnersOfTemplate(input), cards: [] }) },
  { name: "find_collectible_wanters", description: "Find visible collectors who publicly want a specific catalog collectible.", input: templateSchema, maxResults: 8, execute: async (input) => ({ tool: "find_collectible_wanters", data: await findWantersOfTemplate(input), cards: [] }) },
  { name: "search_collectibles", description: "Search the production shared catalog.", input: querySchema, maxResults: 8, execute: async (input) => { const items = await searchSharedCatalog(input); return { tool: "search_collectibles", data: items.slice(0, 25), cards: catalogCards(items) }; } },
  { name: "get_collectible_details", description: "Read one discoverable production catalog collectible by ID.", input: z.object({ templateId: z.string().uuid() }).strict(), maxResults: 1, execute: async (input) => { const item = await getSharedCatalogTemplate((input as { templateId: string }).templateId); if (!item) throw new Error("template_not_found"); return { tool: "get_collectible_details", data: item, cards: catalogCards([item]) }; } },
  { name: "search_collectors", description: "Search public production collector profiles by handle or display name.", input: querySchema, maxResults: 8, execute: async (input) => { const { identity, supabase } = await identityClient(); const parsed = input as { query: string; limit: number }; const q = parsed.query.replace(/[%(),]/g, " ").trim(); let query = supabase.from("profiles").select("user_id,handle,display_name").neq("user_id", identity.user.id).order("display_name").limit(parsed.limit); if (q) query = query.or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`); const { data, error } = await query; if (error) throw new Error("collector_search_failed"); const rows = (data ?? []).slice(0, 25); return { tool: "search_collectors", data: rows, cards: rows.slice(0, 8).map((row) => card("collector", String(row.user_id), String(row.display_name), `@${String(row.handle)}`, undefined, { type: "profile", userId: String(row.user_id) })) }; } },
  { name: "get_collector_compatibility", description: "Read the exact production compatibility result for a visible collector.", input: targetSchema, maxResults: 1, execute: async (input, context) => { const { identity, supabase } = await identityClient(); const targetUserId = await resolveTarget(input as z.infer<typeof targetSchema>, context, supabase, identity.user.id); return { tool: "get_collector_compatibility", data: await getCollectorCompatibility({ targetUserId }), cards: [] }; } },
  { name: "get_trade_relationship", description: "Read visible ownership and wishlist trade intelligence for a collector.", input: targetSchema, maxResults: 1, execute: async (input, context) => { const { identity, supabase } = await identityClient(); const targetUserId = await resolveTarget(input as z.infer<typeof targetSchema>, context, supabase, identity.user.id); return { tool: "get_trade_relationship", data: await getTradeOpportunity({ targetUserId }), cards: [] }; } },
  { name: "discover_collectors", description: "Use the deterministic production collector Discovery Brain.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await discoverCollectors(input); return { tool: "discover_collectors", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.collector.userId, item.collector.displayName, `@${item.collector.handle}`, item.reasons.slice(0, 2).map((reason) => reason.code).join(" · "), { type: "profile", userId: item.collector.userId })) }; } },
  { name: "discover_rooms", description: "Use the deterministic production Room Discovery Brain.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await discoverRooms(input); return { tool: "discover_rooms", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("room", item.roomId, item.collector.displayName, `@${item.collector.handle}`, `${item.displayedHoldingCount} displayed`, { type: "room", userId: item.collector.userId })) }; } },
  { name: "discover_collectibles", description: "Use the deterministic production collectible Discovery Brain.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await discoverCollectibles(input); return { tool: "discover_collectibles", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collectible", item.template.id, item.template.name, item.template.kind, item.reasons.slice(0, 2).map((reason) => reason.code).join(" · "), { type: "search", query: item.template.name, destination: "collectibles" })) }; } },
  { name: "estimate_collectible_value", description: "Provide catalog context for a clearly labeled rough estimate; never claim live market data.", input: z.object({ query: z.string().trim().max(120).default(""), templateId: z.string().uuid().optional() }).strict(), maxResults: 1, execute: async (input, context) => { const parsed = input as { query: string; templateId?: string }; const match = parsed.templateId ?? context.templateId; const item = match ? await getSharedCatalogTemplate(match) : (await searchSharedCatalog({ query: parsed.query, limit: 5, offset: 0 })).at(0); return { tool: "estimate_collectible_value", data: { item, source: "no_verified_live_market_data", disclosure: "Any range is a rough collector-market estimate, not a current sale price." }, cards: item ? catalogCards([item]) : [] }; } },
  { name: "navigate", description: "Return one allowlisted in-app navigation intent; never open arbitrary URLs or mutate state.", input: navigationSchema, maxResults: 1, execute: async (input, context) => { const parsed = input as z.infer<typeof navigationSchema>; if (parsed.destination === "search") return { tool: "navigate", data: { destination: "search" }, cards: [], action: { type: "search", query: parsed.query ?? "", destination: "collectibles" } }; if (parsed.destination === "collection") return { tool: "navigate", data: { destination: "collection" }, cards: [], action: { type: "collection" } }; if (parsed.destination === "wishlist") return { tool: "navigate", data: { destination: "wishlist" }, cards: [], action: { type: "wishlist" } }; const { identity, supabase } = await identityClient(); const targetUserId = await resolveTarget({ query: parsed.query ?? "", targetUserId: parsed.targetUserId }, context, supabase, identity.user.id); return { tool: "navigate", data: { destination: parsed.destination, targetUserId }, cards: [], action: parsed.destination === "profile" ? { type: "profile", userId: targetUserId } : { type: "room", userId: targetUserId } }; } },
];

const registry = new Map(tools.map((tool) => [tool.name, tool]));
export const assistantToolDefinitions = tools.map(({ name, description, maxResults }) => ({ name, description, maxResults }));

export async function executeAssistantTool(name: string, rawInput: unknown, context: unknown): Promise<AssistantToolOutput> {
  const tool = registry.get(name);
  if (!tool) throw new Error("unknown_assistant_tool");
  const parsedContext = contextSchema.parse(context ?? {});
  const input = tool.input.parse(rawInput ?? {});
  return tool.execute(input, parsedContext);
}

export function hasAssistantTool(name: string): boolean { return registry.has(name); }
