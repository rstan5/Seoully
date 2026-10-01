import { isAskNavigationAction, type AskNavigationAction } from "./ask-context";

export const ASK_RESULT_MODES = ["llm", "fallback", "demo"] as const;
export type AskResultMode = (typeof ASK_RESULT_MODES)[number];

export type AskResultCard = {
  kind: "collector" | "collectible" | "room" | "holding";
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  action?: AskNavigationAction;
};

export type AskResult = {
  reply: string;
  cards: AskResultCard[];
  navigation?: AskNavigationAction;
  mode?: AskResultMode;
};

const CARD_KINDS = new Set(["collector", "collectible", "room", "holding"]);

function asText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseCard(value: unknown): AskResultCard | null {
  if (!value || typeof value !== "object") return null;
  const card = value as Record<string, unknown>;
  if ("accessToken" in card || "apiKey" in card || "authorization" in card) return null;
  if (!CARD_KINDS.has(String(card.kind))) return null;
  const id = asText(card.id, 80);
  const title = asText(card.title, 200);
  if (!id || !title) return null;
  const parsed: AskResultCard = {
    kind: card.kind as AskResultCard["kind"],
    id,
    title,
  };
  const subtitle = asText(card.subtitle, 200);
  const detail = asText(card.detail, 400);
  if (subtitle) parsed.subtitle = subtitle;
  if (detail) parsed.detail = detail;
  if (isAskNavigationAction(card.action)) parsed.action = card.action;
  return parsed;
}

/** Validate a backend Ask Seoully payload. Drops raw tool calls, secrets, and illegal routes. */
export function parseAskResult(raw: unknown): AskResult {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const reply = asText(input.reply, 2_000);
  const cards = Array.isArray(input.cards)
    ? input.cards.map(parseCard).filter((card): card is AskResultCard => Boolean(card)).slice(0, 12)
    : [];
  const result: AskResult = { reply, cards };
  if (isAskNavigationAction(input.navigation)) result.navigation = input.navigation;
  if (typeof input.mode === "string" && (ASK_RESULT_MODES as readonly string[]).includes(input.mode)) {
    result.mode = input.mode as AskResultMode;
  }
  return result;
}
