import { z } from "zod";
import { generateAssistantReply, planAssistantTool, type AssistantTurn } from "@/server/assistant-provider";
import type { Locale } from "@/locale/translate";

const requestSchema = z.object({
  phase: z.enum(["plan", "answer"]),
  locale: z.enum(["en", "ko"]),
  question: z.string().trim().min(1).max(800),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(800) })).max(8),
  context: z.unknown().optional(),
  toolResult: z.unknown().optional(),
});

const rateBuckets = new Map<string, { start: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 12;

function rateLimited(request: Request): boolean {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const current = rateBuckets.get(ip);
  if (!current || now - current.start >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { start: now, count: 1 });
  } else {
    current.count += 1;
    if (current.count > RATE_LIMIT) return true;
  }
  if (rateBuckets.size > 1_000) {
    for (const [key, bucket] of rateBuckets) {
      if (now - bucket.start >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
  }
  return false;
}

export async function POST(request: Request) {
  if (rateLimited(request)) {
    return Response.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
  }
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success || (parsed.data.toolResult !== undefined && JSON.stringify(parsed.data.toolResult).length > 12_000)) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  try {
    if (parsed.data.phase === "plan") {
      const plan = await planAssistantTool({
        locale: parsed.data.locale as Locale,
        question: parsed.data.question,
        history: parsed.data.history as AssistantTurn[],
        context: parsed.data.context,
      });
      return Response.json(plan ? { plan, mode: "llm" } : { mode: "fallback" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (parsed.data.toolResult === undefined) {
      return Response.json({ error: "tool_result_required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }
    const reply = await generateAssistantReply({
      locale: parsed.data.locale as Locale,
      question: parsed.data.question,
      history: parsed.data.history as AssistantTurn[],
      toolResult: parsed.data.toolResult,
    });
    return Response.json(reply ? { reply, mode: "llm" } : { mode: "fallback" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "assistant_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
