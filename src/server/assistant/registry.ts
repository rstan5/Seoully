import "server-only";

import { z } from "zod";
import { CATALOG_COMPLETENESS_DISCLAIMER, parseAskContext, searchDestinationFromQuestion, type AskNavigationAction, type AskSurfaceContext } from "@/domain/ask-context";
import { helpForQuestion } from "@/domain/ask-help";
import { translate } from "@/locale/translate";
import { getCurrentIdentity, getCurrentIdentityFromClient, getPublicProfile } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { requestSupabaseClient } from "@/server/supabase/request-client";
import { checkMyCollectibleStatus, getMyCollection, getMyWishlist, getCollectionBreakdown, findOwnersOfTemplate, findWantersOfTemplate, findOwnersOfMyWishlist, findCollectorsWantingMyItems, getReciprocalRelationships, getKnownCoverage } from "@/server/dal/collection-graph";
import { searchSharedCatalog, getSharedCatalogTemplate } from "@/server/dal/catalog";
import { getCollectorCompatibility } from "@/server/compatibility/service";
import { getTradeOpportunity } from "@/server/trade/service";
import { discoverCollectors, discoverRooms, discoverCollectibles } from "@/server/discovery/service";
import { navigationFromContext, validateAskNavigation } from "@/server/assistant/navigation";

const limitSchema = z.object({ limit: z.number().int().min(1).max(25).default(8) }).strict();
const querySchema = z.object({ query: z.string().trim().max(120).default(""), limit: z.number().int().min(1).max(25).default(8) }).strict();
const targetSchema = z.object({ query: z.string().trim().max(120).default(""), targetUserId: z.string().uuid().optional() }).strict();
const navigationSchema = z.object({
  destination: z.enum(["profile", "profile_self", "room", "collection", "wishlist", "search", "inbox", "composer", "add", "conversation"]),
  query: z.string().trim().max(120).optional(),
  searchDestination: z.enum(["people", "rooms", "posts", "collectibles", "entities"]).optional(),
  targetUserId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
}).strict();
const templateSchema = z.object({ templateId: z.string().uuid(), limit: z.number().int().min(1).max(25).default(8) }).strict();
const statusSchema = z.object({ templateId: z.string().uuid().optional() }).strict();
const helpSchema = z.object({ query: z.string().trim().max(800).default(""), locale: z.enum(["en", "ko"]).optional() }).strict();

export const assistantSurfaceContextSchema = z.unknown().transform((value) => parseAskContext(value));
export type AssistantSurfaceContext = AskSurfaceContext;
export interface AssistantCard {
  kind: "collector" | "collectible" | "room" | "holding";
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  action?: AskNavigationAction;
}
export interface AssistantToolOutput { tool: string; data: unknown; cards: AssistantCard[]; action?: AskNavigationAction }

type Executor = (input: unknown, context: AssistantSurfaceContext) => Promise<AssistantToolOutput>;
interface ToolDefinition { name: string; description: string; input: z.ZodTypeAny; execute: Executor; maxResults: number }

function card(kind: AssistantCard["kind"], id: string, title: string, subtitle?: string, detail?: string, action?: AskNavigationAction): AssistantCard {
  return { kind, id, title, ...(subtitle ? { subtitle } : {}), ...(detail ? { detail } : {}), ...(action ? { action } : {}) };
}

async function identityClient() {
  const stored = requestSupabaseClient();
  if (stored) {
    const identity = await getCurrentIdentityFromClient(stored);
    if (!identity) throw new Error("unauthenticated");
    return { identity, supabase: stored };
  }
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  return { identity, supabase: await createSupabaseServerClient() };
}

export function contextTarget(context: AssistantSurfaceContext): string | undefined {
  return context.collectorUserId ?? context.targetUserId ?? context.profileUserId;
}

async function resolveTarget(input: z.infer<typeof targetSchema>, context: AssistantSurfaceContext, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, actorId: string): Promise<string> {
  const target = input.targetUserId ?? contextTarget(context);
  if (target && target !== actorId) return target;
  if (!input.query) throw new Error("target_required");
  const raw = input.query.replace(/[%(),]/g, " ").trim();
  const explicit = raw.match(/\b(?:does|about|with|for|are|is)\s+([a-z0-9][a-z0-9 _-]{1,39})/i)?.[1]?.trim();
  const q = (explicit ?? raw).split(/\s+(?:have|has|own|want|anything|and|from|trade|compatible|like)\b/i)[0]!.trim();
  const { data, error } = await supabase.from("profiles").select("user_id").or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`).neq("user_id", actorId).limit(2);
  if (error || !data?.length) throw new Error("collector_not_found");
  if (data.length > 1) throw new Error("collector_ambiguous");
  return String(data[0]!.user_id);
}

function catalogCards(items: Awaited<ReturnType<typeof searchSharedCatalog>>): AssistantCard[] {
  return items.slice(0, 8).map((item) => card(
    "collectible",
    item.id,
    item.name,
    [item.groupName, item.memberName, item.releaseName].filter(Boolean).join(" · "),
    item.status,
    { type: "search", query: item.name, destination: "collectibles" },
  ));
}

async function collectorCard(userId: string, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, detail?: string): Promise<AssistantCard | null> {
  const profile = await getPublicProfile(userId, supabase);
  if (!profile) return null;
  return card("collector", profile.user.id, profile.user.displayName, `@${profile.user.handle}`, detail, { type: "profile", userId: profile.user.id });
}

const tools: ToolDefinition[] = [
  {
    name: "get_seoully_help",
    description: "Explain an implemented Seoully feature and offer one allowlisted destination.",
    input: helpSchema,
    maxResults: 1,
    execute: async (input) => {
      const { identity, supabase } = await identityClient();
      const parsed = input as { query: string; locale?: "en" | "ko" };
      const help = helpForQuestion(parsed.query || "", identity.user.id);
      const action = await validateAskNavigation(help.action, identity.user.id, supabase);
      const locale = parsed.locale ?? "en";
      return {
        tool: "get_seoully_help",
        data: { key: help.key },
        cards: action ? [card("holding", "help-action", translate(locale, "assistant.takeMeThere"), undefined, undefined, action)] : [],
        ...(action ? { action } : {}),
      };
    },
  },
  {
    name: "check_my_collectible_status",
    description: "Read whether the authenticated user owns or wishlists a catalog collectible.",
    input: statusSchema,
    maxResults: 2,
    execute: async (input, context) => {
      const parsed = input as { templateId?: string };
      const templateId = parsed.templateId ?? context.templateId;
      if (!templateId) throw new Error("template_required");
      const item = await getSharedCatalogTemplate(templateId);
      if (!item) throw new Error("template_not_found");
      const status = await checkMyCollectibleStatus(templateId);
      const cards: AssistantCard[] = catalogCards([item]);
      if (status.owned) cards.push(card("holding", status.holdingIds[0] ?? item.id, item.name, "Owned", undefined, { type: "collection" }));
      else if (status.onWishlist) cards.push(card("collectible", item.id, item.name, "Wishlist", undefined, { type: "wishlist" }));
      return { tool: "check_my_collectible_status", data: { ...status, templateName: item.name, kind: item.kind, groupName: item.groupName, memberName: item.memberName }, cards };
    },
  },
  { name: "get_my_collection", description: "Read the authenticated user's production Holdings.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await getMyCollection(input); return { tool: "get_my_collection", data: { count: items.length, items: items.slice(0, 25).map(({ holdingId, templateId, templateName, kind, tradeStatus }) => ({ holdingId, templateId, templateName, kind, tradeStatus })) }, cards: items.slice(0, 8).map((item) => card("holding", item.holdingId, item.templateName, item.kind, item.tradeStatus, { type: "collection" })) }; } },
  { name: "get_my_collection_breakdown", description: "Summarize the authenticated user's production collection.", input: z.object({}).strict(), maxResults: 1, execute: async () => ({ tool: "get_my_collection_breakdown", data: await getCollectionBreakdown({}), cards: [{ kind: "holding", id: "open-collection", title: "Collection", action: { type: "collection" } }] }) },
  { name: "get_my_wishlist", description: "Read the authenticated user's production wishlist.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await getMyWishlist(input); return { tool: "get_my_wishlist", data: { count: items.length, items: items.slice(0, 25).map(({ templateId, templateName, kind }) => ({ templateId, templateName, kind })) }, cards: items.slice(0, 8).map((item) => card("collectible", item.templateId, item.templateName, item.kind, undefined, { type: "wishlist" })) }; } },
  { name: "find_wishlist_owners", description: "Find visible collectors who own items on my wishlist.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await findOwnersOfMyWishlist(input); return { tool: "find_wishlist_owners", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.userId, item.displayName, `@${item.handle}`, `${item.ownedCopies} owned · ${item.forTradeCopies} for trade`, { type: "profile", userId: item.userId })) }; } },
  { name: "find_collectors_wanting_my_items", description: "Find visible collectors whose wishlist contains my owned items.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await findCollectorsWantingMyItems(input); return { tool: "find_collectors_wanting_my_items", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.userId, item.displayName, `@${item.handle}`, item.templateName, { type: "profile", userId: item.userId })) }; } },
  { name: "find_reciprocal_collection_relationships", description: "Find factual reciprocal visible ownership and wishlist relationships.", input: limitSchema, maxResults: 8, execute: async (input) => { void input; const items = await getReciprocalRelationships({}); return { tool: "find_reciprocal_collection_relationships", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.collector.userId, item.collector.displayName, `@${item.collector.handle}`, "Reciprocal collection interest", { type: "profile", userId: item.collector.userId })) }; } },
  {
    name: "find_missing_known_collectibles",
    description: "Compare my Holdings against currently known catalog items.",
    input: z.object({ groupId: z.string().uuid().optional(), memberId: z.string().uuid().optional(), releaseId: z.string().uuid().optional() }).strict(),
    maxResults: 25,
    execute: async (input) => {
      const coverage = await getKnownCoverage(input);
      const missing = coverage.missingKnown.slice(0, 8);
      const templates = (await Promise.all(missing.map((id) => getSharedCatalogTemplate(id)))).filter((item): item is NonNullable<typeof item> => Boolean(item));
      return {
        tool: "find_missing_known_collectibles",
        data: {
          knownToSeoully: coverage.knownToSeoully,
          ownedKnown: coverage.ownedKnown,
          missingCount: coverage.missingKnown.length,
          missingKnown: missing,
          disclaimer: CATALOG_COMPLETENESS_DISCLAIMER.en,
        },
        cards: catalogCards(templates),
      };
    },
  },
  { name: "find_collectible_owners", description: "Find visible collectors who own a specific catalog collectible.", input: templateSchema, maxResults: 8, execute: async (input) => { const items = await findOwnersOfTemplate(input); return { tool: "find_collectible_owners", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.userId, item.displayName, `@${item.handle}`, `${item.ownedCopies} owned`, { type: "profile", userId: item.userId })) }; } },
  { name: "find_collectible_wanters", description: "Find visible collectors who publicly want a specific catalog collectible.", input: templateSchema, maxResults: 8, execute: async (input) => { const items = await findWantersOfTemplate(input); return { tool: "find_collectible_wanters", data: items, cards: items.slice(0, 8).map((item) => card("collector", item.userId, item.displayName, `@${item.handle}`, undefined, { type: "profile", userId: item.userId })) }; } },
  { name: "search_collectibles", description: "Search the production shared catalog.", input: querySchema, maxResults: 8, execute: async (input) => { const items = await searchSharedCatalog(input); return { tool: "search_collectibles", data: items.slice(0, 25).map(({ id, name, kind, groupName, memberName, status }) => ({ id, name, kind, groupName, memberName, status })), cards: catalogCards(items) }; } },
  { name: "get_collectible_details", description: "Read one discoverable production catalog collectible by ID.", input: z.object({ templateId: z.string().uuid() }).strict(), maxResults: 1, execute: async (input) => { const item = await getSharedCatalogTemplate((input as { templateId: string }).templateId); if (!item) throw new Error("template_not_found"); return { tool: "get_collectible_details", data: { id: item.id, name: item.name, kind: item.kind, groupName: item.groupName, memberName: item.memberName, status: item.status }, cards: catalogCards([item]) }; } },
  { name: "search_collectors", description: "Search public production collector profiles by handle or display name.", input: querySchema, maxResults: 8, execute: async (input) => { const { identity, supabase } = await identityClient(); const parsed = input as { query: string; limit: number }; const q = parsed.query.replace(/[%(),]/g, " ").trim(); let query = supabase.from("profiles").select("user_id,handle,display_name").neq("user_id", identity.user.id).order("display_name").limit(parsed.limit); if (q) query = query.or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`); const { data, error } = await query; if (error) throw new Error("collector_search_failed"); const rows = (data ?? []).slice(0, 25); return { tool: "search_collectors", data: rows, cards: rows.slice(0, 8).map((row) => card("collector", String(row.user_id), String(row.display_name), `@${String(row.handle)}`, undefined, { type: "profile", userId: String(row.user_id) })) }; } },
  {
    name: "get_collector_compatibility",
    description: "Read the exact production compatibility result for a visible collector.",
    input: targetSchema,
    maxResults: 1,
    execute: async (input, context) => {
      const { identity, supabase } = await identityClient();
      const targetUserId = await resolveTarget(input as z.infer<typeof targetSchema>, context, supabase, identity.user.id);
      const data = await getCollectorCompatibility({ targetUserId }, supabase);
      const collector = await collectorCard(targetUserId, supabase, `score ${data.score}`);
      return { tool: "get_collector_compatibility", data, cards: collector ? [collector] : [] };
    },
  },
  {
    name: "get_trade_relationship",
    description: "Read visible ownership and wishlist trade intelligence for a collector.",
    input: targetSchema,
    maxResults: 1,
    execute: async (input, context) => {
      const { identity, supabase } = await identityClient();
      const targetUserId = await resolveTarget(input as z.infer<typeof targetSchema>, context, supabase, identity.user.id);
      const data = await getTradeOpportunity({ targetUserId }, supabase);
      const collector = await collectorCard(targetUserId, supabase, data.strength);
      return {
        tool: "get_trade_relationship",
        data: {
          targetUserId: data.targetUserId,
          strength: data.strength,
          reciprocal: data.reciprocal,
          theyOwnThatIWant: data.theyOwnThatIWant.map(({ templateId, templateName, forTradeCopies }) => ({ templateId, templateName, forTradeCopies })),
          iOwnThatTheyWant: data.iOwnThatTheyWant.map(({ templateId, templateName, forTradeCopies }) => ({ templateId, templateName, forTradeCopies })),
          visibility: data.visibility,
        },
        cards: collector ? [collector] : [],
      };
    },
  },
  { name: "discover_collectors", description: "Use the deterministic production collector Discovery Brain.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await discoverCollectors(input); return { tool: "discover_collectors", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collector", item.collector.userId, item.collector.displayName, `@${item.collector.handle}`, item.reasons.slice(0, 2).map((reason) => reason.code).join(" · "), { type: "profile", userId: item.collector.userId })) }; } },
  { name: "discover_rooms", description: "Use the deterministic production Room Discovery Brain.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await discoverRooms(input); return { tool: "discover_rooms", data: items.slice(0, 25).map((item) => ({ roomId: item.roomId, userId: item.collector.userId, handle: item.collector.handle, displayedHoldingCount: item.displayedHoldingCount })), cards: items.slice(0, 8).map((item) => card("room", item.roomId, item.collector.displayName, `@${item.collector.handle}`, `${item.displayedHoldingCount} displayed`, { type: "room", userId: item.collector.userId })) }; } },
  { name: "discover_collectibles", description: "Use the deterministic production collectible Discovery Brain.", input: limitSchema, maxResults: 8, execute: async (input) => { const items = await discoverCollectibles(input); return { tool: "discover_collectibles", data: items.slice(0, 25), cards: items.slice(0, 8).map((item) => card("collectible", item.template.id, item.template.name, item.template.kind, item.reasons.slice(0, 2).map((reason) => reason.code).join(" · "), { type: "search", query: item.template.name, destination: "collectibles" })) }; } },
  { name: "estimate_collectible_value", description: "Provide catalog context for a clearly labeled rough estimate; never claim live market data.", input: z.object({ query: z.string().trim().max(120).default(""), templateId: z.string().uuid().optional() }).strict(), maxResults: 1, execute: async (input, context) => { const parsed = input as { query: string; templateId?: string }; const match = parsed.templateId ?? context.templateId; const item = match ? await getSharedCatalogTemplate(match) : (await searchSharedCatalog({ query: parsed.query, limit: 5, offset: 0 })).at(0); return { tool: "estimate_collectible_value", data: { item: item ? { id: item.id, name: item.name, kind: item.kind, groupName: item.groupName } : null, source: "no_verified_live_market_data", disclosure: "Any range is a rough collector-market estimate, not a current sale price." }, cards: item ? catalogCards([item]) : [] }; } },
  {
    name: "navigate",
    description: "Return one allowlisted in-app navigation intent; never open arbitrary URLs or mutate state.",
    input: navigationSchema,
    maxResults: 1,
    execute: async (input, context) => {
      const parsed = input as z.infer<typeof navigationSchema>;
      const { identity, supabase } = await identityClient();
      const draft = navigationFromContext(
        parsed.destination,
        {
          ...context,
          ...(parsed.targetUserId ? { collectorUserId: parsed.targetUserId, profileUserId: parsed.targetUserId, targetUserId: parsed.targetUserId } : {}),
          ...(parsed.conversationId ? { conversationId: parsed.conversationId } : {}),
        },
        parsed.query ?? "",
        parsed.searchDestination ?? searchDestinationFromQuestion(parsed.query ?? "", context.searchDestination),
      );
      const action = await validateAskNavigation(draft, identity.user.id, supabase);
      if (!action) throw new Error("destination_unavailable");
      return { tool: "navigate", data: { destination: parsed.destination }, cards: [card("holding", "navigate", "Take me there", undefined, undefined, action)], action };
    },
  },
];

const registry = new Map(tools.map((tool) => [tool.name, tool]));
export const assistantToolDefinitions = tools.map(({ name, description, maxResults }) => ({ name, description, maxResults }));

export async function executeAssistantTool(name: string, rawInput: unknown, context: unknown): Promise<AssistantToolOutput> {
  const tool = registry.get(name);
  if (!tool) throw new Error("unknown_assistant_tool");
  const parsedContext = assistantSurfaceContextSchema.parse(context ?? {});
  const input = tool.input.parse(rawInput ?? {});
  return tool.execute(input, parsedContext);
}

export function hasAssistantTool(name: string): boolean { return registry.has(name); }
