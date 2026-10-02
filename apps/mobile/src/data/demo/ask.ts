import { runAssistantTools, assistantFallback, translate } from "seoully-domain/assistant-tools";
import { isAskNavigationAction, parseAskContext, type AskSurfaceContext } from "seoully-domain/ask-context";
import { ASK_HISTORY_LIMIT, classifyAskNeed, navigationIntentFromAsk } from "seoully-domain/ask-intent";
import { parseAskResult, type AskResult } from "seoully-domain/ask-result";
import { SOO } from "seoully-domain/fixtures/collectors";

const FOLLOW_UP = /which of them|which one|those|them|what about|그중|그 사람들/;

export function askDemo(
  question: string,
  locale: "en" | "ko",
  history: { role: "user" | "assistant"; content: string }[],
  context?: AskSurfaceContext,
): AskResult {
  const boundedHistory = history.slice(-ASK_HISTORY_LIMIT);
  const surface = parseAskContext(context ?? { surface: "home" });
  let need = classifyAskNeed(question);
  if (need === "general" && boundedHistory.length && FOLLOW_UP.test(question.toLowerCase())) {
    need = "seoully";
  }
  if (need === "price") {
    return parseAskResult({ mode: "demo", reply: translate(locale, "assistant.answer.priceUnavailable"), cards: [] });
  }
  if (need === "current_info") {
    return parseAskResult({ mode: "demo", reply: translate(locale, "assistant.answer.currentInfo"), cards: [] });
  }
  if (need === "general") {
    return parseAskResult({ mode: "demo", reply: translate(locale, "assistant.answer.demoGeneral"), cards: [] });
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
  return parseAskResult({
    mode: "demo",
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
  });
}
