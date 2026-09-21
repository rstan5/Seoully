import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { generateAssistantReply, planAssistantTool, type AssistantTurn } from "@/server/assistant-provider";
import { executeAssistantTool, hasAssistantTool, type AssistantSurfaceContext, type AssistantToolOutput } from "@/server/assistant/registry";

const requestSchema = z.object({
  locale: z.enum(["en", "ko"]),
  question: z.string().trim().min(1).max(800),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(800) })).max(8).default([]),
  context: z.unknown().optional(),
}).strict();

const toolMap: Record<string, string> = {
  get_my_collection: "get_my_collection",
  get_my_wishlist: "get_my_wishlist",
  find_wishlist_owners: "find_wishlist_owners",
  find_collectors_wanting_my_items: "find_collectors_wanting_my_items",
  find_potential_trade_matches: "find_reciprocal_collection_relationships",
  find_missing_collectibles: "find_missing_known_collectibles",
  find_similar_collectors: "discover_collectors",
  find_similar_rooms: "discover_rooms",
  search_collectibles: "search_collectibles",
  search_collectors: "search_collectors",
  get_collectible_details: "get_collectible_details",
  get_collector_details: "get_collector_compatibility",
  estimate_collectible_value: "estimate_collectible_value",
};

function deterministicTool(question: string, context: AssistantSurfaceContext): { name: string; input: Record<string, unknown> } {
  const q = question.toLocaleLowerCase();
  const listInput = { limit: 8 };
  const searchInput = { query: question.slice(0, 120), limit: 8 };
  if (/worth|price|value|estimate|가치|얼마|가격/.test(q)) return { name: "estimate_collectible_value", input: { query: question.slice(0, 120), ...(context.templateId ? { templateId: context.templateId } : {}) } };
  if (/missing|am i missing|빠진|없는/.test(q)) return { name: "find_missing_known_collectibles", input: {} };
  if (/trade|교환|want anything|wants/.test(q)) return { name: "get_trade_relationship", input: { query: question.slice(0, 120), ...(context.targetUserId ? { targetUserId: context.targetUserId } : {}) } };
  if (/compatible|similar|like me|비슷|취향/.test(q)) return { name: context.targetUserId || context.profileUserId ? "get_collector_compatibility" : "discover_collectors", input: context.targetUserId || context.profileUserId ? { query: question.slice(0, 120), targetUserId: context.targetUserId ?? context.profileUserId } : listInput };
  if (/room|룸/.test(q)) return { name: "discover_rooms", input: listInput };
  if (/wishlist|위시/.test(q) && /who|owner|own|누가|가지/.test(q)) return { name: "find_wishlist_owners", input: listInput };
  if (/wishlist|위시/.test(q)) return { name: "get_my_wishlist", input: listInput };
  if (/own|collection|컬렉션|소유/.test(q)) return { name: /group|most|많이|breakdown/.test(q) ? "get_my_collection_breakdown" : "get_my_collection", input: /group|most|많이|breakdown/.test(q) ? {} : listInput };
  if (/collectible|photocard|card|item|카드|포카|아이템|search|찾/.test(q)) return { name: /discover|check out|추천/.test(q) ? "discover_collectibles" : "search_collectibles", input: /discover|check out|추천/.test(q) ? listInput : searchInput };
  if (/collector|people|누구|컬렉터/.test(q)) return { name: /like me|similar|비슷/.test(q) ? "discover_collectors" : "search_collectors", input: /like me|similar|비슷/.test(q) ? listInput : searchInput };
  return { name: "get_my_collection_breakdown", input: {} };
}

function fallbackReply(output: AssistantToolOutput, locale: "en" | "ko"): string {
  const data = output.data as Record<string, unknown>;
  const count = typeof data?.count === "number" ? data.count : Array.isArray(output.cards) ? output.cards.length : 0;
  if (locale === "ko") {
    if (output.tool === "get_my_collection") return count ? `현재 컬렉션에서 ${count}개의 아이템을 찾았어요.` : "아직 production 컬렉션에 아이템이 없어요.";
    if (output.tool === "get_my_wishlist") return count ? `위시리스트에서 ${count}개의 아이템을 찾았어요.` : "위시리스트가 비어 있어요.";
    if (output.tool.startsWith("discover_")) return output.cards.length ? `${output.cards.length}개의 관련 결과를 찾았어요.` : "현재 조건에 맞는 결과를 찾지 못했어요.";
    if (output.tool === "estimate_collectible_value") return "실시간 시세 데이터는 연결되어 있지 않아요. 정확한 식별 정보가 있으면 대략적인 컬렉터 시장 범위를 안내할 수 있어요.";
    return output.cards.length ? `${output.cards.length}개의 결과를 찾았어요.` : "아직 찾은 결과가 없어요.";
  }
  if (output.tool === "get_my_collection") return count ? `I found ${count} items in your production collection.` : "You do not have any production collection items yet.";
  if (output.tool === "get_my_wishlist") return count ? `I found ${count} items on your wishlist.` : "Your wishlist is empty.";
  if (output.tool.startsWith("discover_")) return output.cards.length ? `I found ${output.cards.length} relevant results.` : "I couldn't find any eligible results yet.";
  if (output.tool === "estimate_collectible_value") return "There is no live market-data source connected. With clearer identity details, I can help frame a rough collector-market estimate rather than a verified price.";
  return output.cards.length ? `I found ${output.cards.length} results.` : "I couldn't find a matching result yet.";
}

export async function askSeoullyProduction(raw: unknown) {
  const input = requestSchema.parse(raw);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const context = (await import("@/server/assistant/registry")).assistantSurfaceContextSchema.parse(input.context ?? {});
  let planned: { name: string; input: Record<string, unknown> } | null = null;
  try {
    const plan = await planAssistantTool({ locale: input.locale, question: input.question, history: input.history as AssistantTurn[], context });
    if (plan) {
      const mapped = toolMap[plan.tool] ?? plan.tool;
      if (hasAssistantTool(mapped)) {
        const target = context.targetUserId ?? context.profileUserId;
        const resolvedTool = mapped === "get_collectible_details" && !context.templateId ? "search_collectibles" : mapped;
        const listTools = new Set(["get_my_collection", "get_my_wishlist", "find_wishlist_owners", "find_collectors_wanting_my_items", "find_reciprocal_collection_relationships", "discover_collectors", "discover_rooms", "discover_collectibles"]);
        const input = resolvedTool === "find_missing_known_collectibles" || resolvedTool === "get_my_collection_breakdown" ? {} : listTools.has(resolvedTool) ? { limit: 8 } : resolvedTool === "get_collectible_details" ? { templateId: context.templateId } : { query: plan.query, limit: 8, ...(target ? { targetUserId: target } : {}), ...(context.templateId ? { templateId: context.templateId } : {}) };
        planned = { name: resolvedTool, input };
      }
    }
  } catch { /* deterministic routing below is the safe fallback */ }
  const selected = planned ?? deterministicTool(input.question, context);
  let toolResult: AssistantToolOutput;
  try { toolResult = await executeAssistantTool(selected.name, selected.input, context); }
  catch (error) {
    const reason = error instanceof Error ? error.message : "assistant_tool_failed";
    if (["collector_not_found", "collector_ambiguous", "target_required"].includes(reason)) return { mode: "fallback" as const, reply: input.locale === "ko" ? "어느 컬렉터를 말하는지 조금 더 알려주세요." : "Which collector should I look at?", cards: [] };
    throw new Error("assistant_tool_failed");
  }
  const reply = await generateAssistantReply({ locale: input.locale, question: input.question, history: input.history as AssistantTurn[], toolResult: { tool: toolResult.tool, data: toolResult.data, cards: toolResult.cards } }).catch(() => null);
  return { mode: reply ? "llm" as const : "fallback" as const, reply: reply ?? fallbackReply(toolResult, input.locale), cards: toolResult.cards, tool: toolResult.tool };
}
