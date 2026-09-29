import { runAssistantTools, assistantFallback, translate } from "seoully-domain/assistant-tools";
import { SOO } from "seoully-domain/fixtures/collectors";
import type { NativeAskResult } from "../types";

export function askDemo(
  question: string,
  locale: "en" | "ko",
  history: { role: "user" | "assistant"; content: string }[],
): NativeAskResult {
  void history;
  const result = runAssistantTools({
    viewerId: SOO,
    question,
    locale,
    context: { surface: "home" },
  });
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
  };
}
