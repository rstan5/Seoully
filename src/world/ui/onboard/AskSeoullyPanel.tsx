"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { assistantFallback, assistantPlanForTool, runAssistantTools, type AssistantAction, type AssistantCard } from "@/domain/assistant-tools";
import { repository } from "@/domain/memory-repository";
import { useLocale, useT } from "@/locale/store";
import { useSession } from "@/world/store/sessionStore";
import { useWorld } from "@/world/store/worldStore";
import { travelToRoomOf } from "@/world/useTraversal";
import { useAssistantStore } from "@/world/store/assistantStore";
import { queueSearchPreset } from "@/world/store/searchPreset";
import { queueProfilePreset } from "@/world/store/profilePreset";

interface AssistantApiResponse {
  reply?: string;
  mode?: "llm" | "fallback";
  plan?: { tool: string; query: string };
}

export function AskSeoullyPanel({ viewerId }: { viewerId: string }) {
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const locale = useLocale();
  const t = useT();
  const messages = useAssistantStore((s) => s.messages);
  const pending = useAssistantStore((s) => s.pending);
  const setPending = useAssistantStore((s) => s.setPending);
  const addMessage = useAssistantStore((s) => s.addMessage);
  const ensureViewer = useAssistantStore((s) => s.ensureViewer);
  const worldView = useWorld((s) => s.view);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureViewer(viewerId);
  }, [ensureViewer, viewerId]);
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const send = async (raw: string) => {
    const prompt = raw.trim();
    if (!prompt || pending) return;
    const history = messages.slice(-8).map(({ role, content }) => ({ role, content }));
    const previousUserIds = messages
      .slice()
      .reverse()
      .find((message) => message.role === "assistant")
      ?.cards?.filter((card) => card.kind === "collector")
      .map((card) => card.id);
    addMessage({ role: "user", content: prompt });
    setQuestion("");
    setPending(true);

    const inspectId = worldView.kind === "inspect"
      ? repository.getHoldingView(worldView.holdingId)?.template.id
      : undefined;
    const context = {
      surface: worldView.kind,
      ...(worldView.kind === "profile" ? { profileUserId: worldView.userId, targetUserId: worldView.userId } : {}),
      ...(inspectId ? { templateId: inspectId } : {}),
    };
    // Authenticated users use the server-owned production intelligence path.
    // Fixture/demo users continue through the frozen local assistant below.
    try {
      const production = await fetch("/api/assistant/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, question: prompt, history, context }),
      });
      if (production.ok) {
        const payload = (await production.json()) as { reply?: string; cards?: AssistantCard[] };
        if (payload.reply) {
          addMessage({ role: "assistant", content: payload.reply, cards: payload.cards ?? [] });
          setPending(false);
          return;
        }
      }
    } catch {
      // The deterministic fixture assistant remains the safe fallback.
    }
    let plannedIntent;
    let plannedQuery: string | undefined;
    let providerReady = false;
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: "plan", locale, question: prompt, history, context }),
      });
      if (response.ok) {
        const payload = (await response.json()) as AssistantApiResponse;
        if (payload.plan) {
          plannedIntent = assistantPlanForTool(payload.plan.tool);
          plannedQuery = payload.plan.query;
          providerReady = !!plannedIntent;
        }
      }
    } catch {
      // Deterministic local intent routing is the safe development fallback.
    }

    let toolResult;
    try {
      toolResult = runAssistantTools({
        viewerId: viewerId as never,
        question: prompt,
        locale,
        context,
        previousUserIds,
        ...(plannedIntent ? { intentOverride: plannedIntent } : {}),
        ...(plannedQuery !== undefined ? { queryOverride: plannedQuery } : {}),
      });
    } catch {
      addMessage({ role: "assistant", content: t("assistant.answer.unavailable") });
      setPending(false);
      return;
    }

    let reply = assistantFallback(toolResult, t);
    if (providerReady) {
      try {
        const response = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phase: "answer", locale, question: prompt, history, toolResult }),
        });
        if (response.ok) {
          const payload = (await response.json()) as AssistantApiResponse;
          if (payload.reply) reply = payload.reply;
        }
      } catch {
        // Keep the repository-grounded localized fallback if the provider is offline.
      }
    }
    addMessage({ role: "assistant", content: reply, cards: toolResult.cards });
    setPending(false);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(question);
  };

  const execute = (action: AssistantAction) => {
    const world = useWorld.getState();
    switch (action.type) {
      case "profile":
        if (repository.getUser(action.userId as never)) world.showProfile(action.userId as never);
        break;
      case "room":
        if (repository.getRoomByOwner(action.userId as never)) travelToRoomOf(action.userId as never);
        break;
      case "search":
        queueSearchPreset(action.query, action.destination);
        world.showSearch();
        break;
      case "collection":
      case "wishlist":
        queueProfilePreset(viewerId as never, action.type);
        world.showProfile(viewerId as never);
        break;
      case "composer":
        world.showCompose();
        break;
      case "inbox":
        world.showInbox();
        break;
      case "add":
        useSession.getState().openCollect();
        break;
    }
    useAssistantStore.getState().setOpen(false);
  };

  return (
    <section id="ask-seoully-panel" className="ask-seoully-panel" role="dialog" aria-labelledby="ask-seoully-title">
      <header className="ask-seoully-header">
        <div>
          <strong id="ask-seoully-title">{t("assistant.title")}</strong>
          <span>{t("assistant.intro")}</span>
        </div>
        <button type="button" aria-label={t("assistant.close")} onClick={() => useAssistantStore.getState().setOpen(false)}>×</button>
      </header>
      <div ref={threadRef} className="ask-seoully-thread" aria-live="polite" aria-busy={pending}>
        {messages.length === 0 ? (
          <div className="ask-seoully-starters">
            <button type="button" onClick={() => void send(locale === "ko" ? "아이템 찾아줘" : "Find collectibles")}>{t("assistant.starterFind")}</button>
            <button type="button" onClick={() => void send(locale === "ko" ? "내 컬렉션을 보여줘" : "What is in my collection?")}>{t("assistant.starterCollection")}</button>
            <button type="button" onClick={() => void send(locale === "ko" ? "아이템을 어떻게 추가해?" : "How do I add a collectible?")}>{t("assistant.starterHelp")}</button>
          </div>
        ) : messages.map((message) => (
          <div className={`ask-seoully-message is-${message.role}`} key={message.id}>
            <p>{message.content}</p>
            {message.cards?.length ? (
              <div className="ask-seoully-cards">
                {message.cards.map((card) => <AssistantResultCard key={`${card.kind}-${card.id}`} card={card} t={t} onAction={execute} />)}
              </div>
            ) : null}
          </div>
        ))}
        {pending && <p className="ask-seoully-pending">{t("assistant.loading")}</p>}
      </div>
      <form className="ask-seoully-compose" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder={t("assistant.placeholder")}
          aria-label={t("assistant.placeholder")}
          autoComplete="off"
          maxLength={800}
          disabled={pending}
        />
        <button type="submit" disabled={pending || !question.trim()}>{t("assistant.send")}</button>
      </form>
    </section>
  );
}

function AssistantResultCard({ card, t, onAction }: {
  card: AssistantCard;
  t: ReturnType<typeof useT>;
  onAction: (action: AssistantAction) => void;
}) {
  const label = card.kind === "collector" ? t("assistant.viewProfile")
    : card.kind === "room" ? t("assistant.enterRoom")
      : card.kind === "collectible" ? t("assistant.search")
        : card.action?.type === "collection" ? t("assistant.viewCollection")
          : card.action?.type === "wishlist" ? t("assistant.viewWishlist")
            : card.action?.type === "composer" ? t("assistant.openComposer")
              : card.action?.type === "inbox" ? t("assistant.openMessages")
                : t("assistant.takeMeThere");
  const action = card.action;
  return (
    <article className={`ask-seoully-result is-${card.kind}`}>
      <div><strong>{card.title}</strong>{card.subtitle && <span>{card.subtitle}</span>}{card.detail && <small>{card.detail}</small>}</div>
      {action && <button type="button" onClick={() => onAction(action)}>{label}</button>}
    </article>
  );
}
