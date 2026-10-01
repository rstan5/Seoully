import { runAssistantTools, assistantFallback, translate } from "seoully-domain/assistant-tools";
import { isAskNavigationAction, parseAskContext, type AskSurfaceContext } from "seoully-domain/ask-context";
import { classifyAskNeed, navigationIntentFromAsk } from "seoully-domain/ask-intent";
import { SOO } from "seoully-domain/fixtures/collectors";
import type { NativeAskResult } from "../types";

export function askDemo(
  question: string,
  locale: "en" | "ko",
  history: { role: "user" | "assistant"; content: string }[],
  context?: AskSurfaceContext,
): NativeAskResult {
  const surface = parseAskContext(context ?? { surface: "home" });
  const need = classifyAskNeed(question);
  if (need === "price") {
    return { reply: translate(locale, "assistant.answer.priceUnavailable"), cards: [] };
  }
  if (need === "current_info") {
    return { reply: translate(locale, "assistant.answer.currentInfo"), cards: [] };
  }
  if (need === "general") {
    return { reply: translate(locale, "assistant.answer.demoGeneral"), cards: [] };
  }
  const nav = need === "navigate" ? navigationIntentFromAsk(question) : null;
  const result = runAssistantTools({
    viewerId: SOO,
    question,
    locale,
    context: surface,
    previousUserIds: surface.recentCollectorIds,
  });
  const navigation = nav && isAskNavigationAction(nav) ? nav : result.cards.map((card) => card.action).find(isAskNavigationAction);
  return {
    reply: assistantFallback(result, (key, params) => translate(locale, key, params)),
    cards: result.cards.map((card) => ({
      kind: card.kind,
      id: card.id,
      title: card.title,
      ...(card.subtitle ? { subtitle: card.subtitle } : {}),
      ...(card.detail ? { detail: card.detail } : {}),
      ...(card.action ? { action: card.action } : {}),
    })),
    ...(need === "navigate" && navigation ? { navigation } : {}),
  };
}

void history;
