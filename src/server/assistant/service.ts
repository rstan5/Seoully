import "server-only";

import { z } from "zod";
import { CATALOG_COMPLETENESS_DISCLAIMER, isAskNavigationAction, parseAskContext, searchDestinationFromQuestion } from "@/domain/ask-context";
import { navigationIntentFromQuestion } from "@/domain/ask-help";
import { classifyAskNeed } from "@/domain/ask-intent";
import { parseAskResult } from "@/domain/ask-result";
import { translate } from "@/locale/translate";
import { getCurrentIdentity } from "@/server/dal/profile";
import { generateAssistantReply, generateGeneralReply, planAssistantTool, type AssistantTurn } from "@/server/assistant-provider";
import { contextTarget, executeAssistantTool, hasAssistantTool, type AssistantSurfaceContext, type AssistantToolOutput } from "@/server/assistant/registry";

const requestSchema = z.object({
  locale: z.enum(["en", "ko"]),
  question: z.string().trim().min(1).max(800),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(800) })).max(8).default([]),
  context: z.unknown().optional(),
}).strict();

const toolMap: Record<string, string> = {
  get_seoully_help: "get_seoully_help",
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
  navigate: "navigate",
  check_my_collectible_status: "check_my_collectible_status",
  get_my_profile: "get_my_profile",
};

function searchQuery(question: string, plannedQuery?: string) {
  return (plannedQuery?.trim() || question).slice(0, 120);
}

function deterministicTool(question: string, context: AssistantSurfaceContext, locale: "en" | "ko"): { name: string; input: Record<string, unknown> } {
  const q = question.toLocaleLowerCase();
  const listInput = { limit: 8 };
  const query = searchQuery(question);
  const searchInput = { query, limit: 8 };
  const target = contextTarget(context);
  const nav = navigationIntentFromQuestion(question);
  if (nav) {
    if (nav.type === "search") return { name: "navigate", input: { destination: "search", query: context.searchQuery || query, ...(nav.destination ? { searchDestination: nav.destination } : {}) } };
    if (nav.type === "profile") return { name: "navigate", input: { destination: "profile", ...(nav.userId ? { targetUserId: nav.userId } : {}) } };
    if (nav.type === "room") return { name: "navigate", input: { destination: "room", ...(nav.userId ? { targetUserId: nav.userId } : {}) } };
    if (nav.type === "conversation") return { name: "navigate", input: { destination: "conversation", conversationId: nav.conversationId } };
    if (nav.type === "discover" || nav.type === "edit_profile") return { name: "navigate", input: { destination: nav.type } };
    return { name: "navigate", input: { destination: nav.type === "profile_self" ? "profile_self" : nav.type } };
  }
  if (/how do i|how can i|how does|where is|what is the binder|방법|어떻게|어디/.test(q)) return { name: "get_seoully_help", input: { query: question, locale } };
  if (context.templateId && /own this|already own|do i (already )?have|갖고|소유|가지고/.test(q)) return { name: "check_my_collectible_status", input: { templateId: context.templateId } };
  if (context.templateId && /wishlist|위시/.test(q)) return { name: "check_my_collectible_status", input: { templateId: context.templateId } };
  if (context.searchQuery && /search this|again|이대로|다시/.test(q)) {
    return { name: "navigate", input: { destination: "search", query: context.searchQuery, searchDestination: searchDestinationFromQuestion(question, context.searchDestination) } };
  }
  if (target && /profile|프로필/.test(q) && /their|them|this collector|그/.test(q)) return { name: "navigate", input: { destination: "profile", targetUserId: target } };
  if ((target || context.roomOwnerUserId) && /their room|this room|룸/.test(q) && !/search|찾/.test(q)) {
    return { name: "navigate", input: { destination: "room", targetUserId: context.roomOwnerUserId ?? target } };
  }
  if (/worth|price|value|estimate|가치|얼마|가격/.test(q)) return { name: "get_seoully_help", input: { query: question, locale } };
  if (/missing|am i missing|빠진|없는/.test(q)) return { name: "find_missing_known_collectibles", input: {} };
  if (/trade|교환|want anything|wants/.test(q)) return { name: "get_trade_relationship", input: { query, ...(target ? { targetUserId: target } : {}) } };
  if (/compatible|similar|like me|in common|we have|공통|비슷|취향/.test(q)) {
    return {
      name: target ? "get_collector_compatibility" : "discover_collectors",
      input: target ? { query, targetUserId: target } : listInput,
    };
  }
  if (/room|룸/.test(q)) return { name: "discover_rooms", input: listInput };
  if (/wishlist|위시/.test(q) && /who|owner|own|누가|가지/.test(q)) return { name: "find_wishlist_owners", input: listInput };
  if (/wishlist|위시/.test(q)) return { name: "get_my_wishlist", input: listInput };
  if (/own|collection|컬렉션|소유/.test(q)) {
    if (/profile|taste|취향/.test(q)) return { name: "get_my_profile", input: {} };
    return { name: /group|most|많이|breakdown/.test(q) ? "get_my_collection_breakdown" : "get_my_collection", input: /group|most|많이|breakdown/.test(q) ? {} : { ...listInput, query } };
  }
  if (/collectible|photocard|card|item|카드|포카|아이템|search|찾/.test(q)) {
    if (context.templateId && /\b(this|it|this card)\b|이거|이 카드/.test(q)) return { name: "check_my_collectible_status", input: { templateId: context.templateId } };
    return { name: /discover|check out|추천/.test(q) ? "discover_collectibles" : "search_collectibles", input: /discover|check out|추천/.test(q) ? listInput : searchInput };
  }
  if (/collector|people|누구|컬렉터/.test(q)) return { name: /like me|similar|비슷/.test(q) ? "discover_collectors" : "search_collectors", input: /like me|similar|비슷/.test(q) ? listInput : searchInput };
  if (target) return { name: "get_collector_compatibility", input: { query, targetUserId: target } };
  if (context.templateId) return { name: "check_my_collectible_status", input: { templateId: context.templateId } };
  return { name: "get_seoully_help", input: { query: question, locale } };
}

function honestReply(locale: "en" | "ko", key: Parameters<typeof translate>[1]) {
  return { mode: "fallback" as const, reply: translate(locale, key), cards: [] };
}

function fallbackReply(output: AssistantToolOutput, locale: "en" | "ko"): string {
  const data = output.data as Record<string, unknown>;
  const count = typeof data?.count === "number" ? data.count : Array.isArray(output.cards) ? output.cards.length : 0;
  if (output.tool === "get_seoully_help" && typeof data.key === "string") {
    return translate(locale, data.key as Parameters<typeof translate>[1]);
  }
  if (output.tool === "check_my_collectible_status") {
    if (data.owned) return translate(locale, "assistant.answer.ownedYes");
    if (data.onWishlist) return translate(locale, "assistant.answer.wishlistYes");
    return translate(locale, "assistant.answer.ownedNo");
  }
  if (output.tool === "find_missing_known_collectibles") {
    const missingCount = typeof data.missingCount === "number" ? data.missingCount : 0;
    const disclaimer = locale === "ko" ? CATALOG_COMPLETENESS_DISCLAIMER.ko : CATALOG_COMPLETENESS_DISCLAIMER.en;
    if (!missingCount) return `${translate(locale, "assistant.answer.missingEmpty")} ${disclaimer}`;
    return `${translate(locale, "assistant.answer.missing", { count: missingCount })} ${disclaimer}`;
  }
  if (output.tool === "get_collector_compatibility") {
    const score = typeof data.score === "number" ? data.score : 0;
    return translate(locale, score > 0 ? "assistant.answer.common" : "assistant.answer.commonEmpty", { score });
  }
  if (output.tool === "get_trade_relationship") {
    return locale === "ko"
      ? (data.reciprocal ? "공개된 컬렉션/위시 기준으로 서로 관심 있는 아이템이 있어요." : "공개된 데이터로는 교환 신호가 거의 없어요.")
      : (data.reciprocal ? "Using visible collection and wishlist data, you each have something the other wants." : "Visible collection data doesn’t show a two-way trade signal yet.");
  }
  if (output.tool === "navigate") return translate(locale, "assistant.takeMeThere");
  if (output.tool === "search_collectibles" && !output.cards.length) return translate(locale, "assistant.answer.catalogNone");
  if (locale === "ko") {
    if (output.tool === "get_my_collection") return count ? `현재 컬렉션에서 ${count}개의 아이템을 찾았어요.` : "아직 production 컬렉션에 아이템이 없어요.";
    if (output.tool === "get_my_wishlist") return count ? `위시리스트에서 ${count}개의 아이템을 찾았어요.` : "위시리스트가 비어 있어요.";
    if (output.tool.startsWith("discover_")) return output.cards.length ? `${output.cards.length}개의 관련 결과를 찾았어요.` : "현재 조건에 맞는 결과를 찾지 못했어요.";
    if (output.tool === "estimate_collectible_value" || output.tool === "get_my_profile") {
      return output.tool === "get_my_profile" ? "내 프로필 요약을 찾아봤어요." : translate(locale, "assistant.answer.priceUnavailable");
    }
    return output.cards.length ? `${output.cards.length}개의 결과를 찾았어요.` : "아직 찾은 결과가 없어요.";
  }
  if (output.tool === "get_my_collection") return count ? `I found ${count} items in your production collection.` : "You do not have any production collection items yet.";
  if (output.tool === "get_my_wishlist") return count ? `I found ${count} items on your wishlist.` : "Your wishlist is empty.";
  if (output.tool.startsWith("discover_")) return output.cards.length ? `I found ${output.cards.length} relevant results.` : "I couldn't find any eligible results yet.";
  if (output.tool === "get_my_profile") return "Here’s a summary of your Seoully profile.";
  if (output.tool === "estimate_collectible_value") return translate(locale, "assistant.answer.priceUnavailable");
  return output.cards.length ? `I found ${output.cards.length} results.` : "I couldn't find a matching result yet.";
}

function plannedInput(mapped: string, planQuery: string, context: AssistantSurfaceContext, question: string, locale: "en" | "ko"): Record<string, unknown> {
  const target = contextTarget(context);
  const listTools = new Set(["get_my_collection", "get_my_wishlist", "find_wishlist_owners", "find_collectors_wanting_my_items", "find_reciprocal_collection_relationships", "discover_collectors", "discover_rooms", "discover_collectibles"]);
  if (mapped === "get_seoully_help") return { query: question, locale };
  if (mapped === "check_my_collectible_status") return context.templateId ? { templateId: context.templateId } : {};
  if (mapped === "navigate") {
    const intent = navigationIntentFromQuestion(question);
    if (intent?.type === "search") return { destination: "search", query: context.searchQuery || planQuery, searchDestination: intent.destination ?? context.searchDestination };
    if (intent && intent.type !== "profile" && intent.type !== "room" && intent.type !== "conversation" && intent.type !== "collectible" && intent.type !== "public_collectible") {
      return { destination: intent.type };
    }
    if (intent?.type === "profile") return { destination: "profile", targetUserId: intent.userId };
    if (intent?.type === "room") return { destination: "room", targetUserId: intent.userId };
    return { destination: "search", query: planQuery || context.searchQuery || "", searchDestination: searchDestinationFromQuestion(question, context.searchDestination) };
  }
  if (mapped === "find_missing_known_collectibles" || mapped === "get_my_collection_breakdown" || mapped === "get_my_profile") return {};
  if (mapped === "get_my_collection" || mapped === "get_my_wishlist") return { limit: 8, ...(planQuery ? { query: planQuery } : {}) };
  if (listTools.has(mapped)) return { limit: 8 };
  if (mapped === "get_collectible_details") return { templateId: context.templateId };
  return { query: planQuery, limit: 8, ...(target ? { targetUserId: target } : {}), ...(context.templateId ? { templateId: context.templateId } : {}) };
}

function publicAskResult(payload: { mode: "llm" | "fallback"; reply: string; cards: AssistantToolOutput["cards"]; navigation?: AssistantToolOutput["action"] }) {
  return parseAskResult({
    mode: payload.mode,
    reply: payload.reply,
    cards: payload.cards,
    ...(payload.navigation && isAskNavigationAction(payload.navigation) ? { navigation: payload.navigation } : {}),
  });
}

export async function askSeoullyProduction(raw: unknown) {
  const input = requestSchema.parse(raw);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const context = parseAskContext(input.context ?? {});
  const need = classifyAskNeed(input.question);
  if (need === "price") return publicAskResult(honestReply(input.locale, "assistant.answer.priceUnavailable"));
  if (need === "current_info") return publicAskResult(honestReply(input.locale, "assistant.answer.currentInfo"));

  let planned: { name: string; input: Record<string, unknown> } | null = null;
  let plannerChoseNone = false;
  try {
    const plan = await planAssistantTool({ locale: input.locale, question: input.question, history: input.history as AssistantTurn[], context });
    if (plan) {
      const mapped = plan.tool === "estimate_collectible_value" ? "" : (toolMap[plan.tool] ?? plan.tool);
      if (mapped && hasAssistantTool(mapped)) {
        const resolvedTool = mapped === "get_collectible_details" && !context.templateId ? "search_collectibles" : mapped;
        planned = { name: resolvedTool, input: plannedInput(resolvedTool, plan.query, context, input.question, input.locale) };
      }
    } else {
      plannerChoseNone = true;
    }
  } catch {
    /* deterministic routing below is the safe fallback */
  }

  const useGeneral = (plannerChoseNone || !planned) && (need === "general" || need === "help" && plannerChoseNone);
  if (need === "general" && (plannerChoseNone || !planned)) {
    try {
      const reply = await generateGeneralReply({ locale: input.locale, question: input.question, history: input.history as AssistantTurn[] });
      if (reply) return publicAskResult({ mode: "llm", reply, cards: [] });
      return publicAskResult(honestReply(input.locale, "assistant.answer.notConfigured"));
    } catch {
      return publicAskResult(honestReply(input.locale, "assistant.answer.openaiUnavailable"));
    }
  }

  if (useGeneral && need === "help" && plannerChoseNone) {
    planned = { name: "get_seoully_help", input: { query: input.question, locale: input.locale } };
  }

  const selected = planned ?? (need === "general" ? null : deterministicTool(input.question, context, input.locale));
  if (!selected) {
    try {
      const reply = await generateGeneralReply({ locale: input.locale, question: input.question, history: input.history as AssistantTurn[] });
      if (reply) return publicAskResult({ mode: "llm", reply, cards: [] });
      return publicAskResult(honestReply(input.locale, "assistant.answer.notConfigured"));
    } catch {
      return publicAskResult(honestReply(input.locale, "assistant.answer.openaiUnavailable"));
    }
  }

  let toolResult: AssistantToolOutput;
  try {
    toolResult = await executeAssistantTool(selected.name, selected.input, context);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "assistant_tool_failed";
    if (reason === "template_required" || reason === "template_not_found") {
      return publicAskResult({ mode: "fallback", reply: translate(input.locale, reason === "template_required" ? "assistant.answer.needCollectible" : "assistant.answer.catalogNone"), cards: [] });
    }
    if (reason === "destination_unavailable") {
      return publicAskResult({ mode: "fallback", reply: translate(input.locale, "assistant.answer.roomUnavailable"), cards: [] });
    }
    if (reason === "collector_not_visible") {
      return publicAskResult({ mode: "fallback", reply: translate(input.locale, "assistant.answer.privateUnavailable"), cards: [] });
    }
    if (["collector_not_found", "collector_ambiguous", "target_required"].includes(reason)) {
      return publicAskResult({ mode: "fallback", reply: translate(input.locale, "assistant.answer.needCollector"), cards: [] });
    }
    throw new Error("assistant_tool_failed");
  }
  let reply: string | null = null;
  try {
    reply = await generateAssistantReply({
      locale: input.locale,
      question: input.question,
      history: input.history as AssistantTurn[],
      toolResult: { data: toolResult.data, cards: toolResult.cards.map(({ action: _action, ...card }) => card) },
    });
  } catch {
    reply = null;
  }
  const autoNav = (need === "navigate" || toolResult.tool === "navigate") && isAskNavigationAction(toolResult.action)
    ? toolResult.action
    : undefined;
  return publicAskResult({
    mode: reply ? "llm" : "fallback",
    reply: reply ?? fallbackReply(toolResult, input.locale),
    cards: toolResult.cards,
    navigation: autoNav,
  });
}
