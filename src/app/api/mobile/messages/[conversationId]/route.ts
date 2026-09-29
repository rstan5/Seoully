import { NextResponse } from "next/server";
import { listDirectMessages, markDirectConversationRead, sendDirectMessage } from "@/server/dal/messages";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ conversationId: string }> };

function statusFor(reason: string) {
  if (reason === "unauthenticated") return 401;
  if (reason === "conversation_forbidden") return 403;
  if (reason.endsWith("_unavailable")) return 503;
  return 400;
}

export async function GET(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { conversationId } = await context.params;
    return NextResponse.json(
      { messages: await listDirectMessages(conversationId, client) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "messages_read_failed";
    return NextResponse.json({ error: reason }, { status: statusFor(reason) });
  }
}

export async function POST(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { conversationId } = await context.params;
    const payload = await request.json() as { body?: unknown; postId?: unknown; templateIds?: unknown };
    const message = await sendDirectMessage({
      conversationId,
      body: payload.body,
      postId: payload.postId,
      templateIds: payload.templateIds,
    }, client);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "message_send_failed";
    return NextResponse.json({ error: reason }, { status: statusFor(reason) });
  }
}

export async function PATCH(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { conversationId } = await context.params;
    await markDirectConversationRead(conversationId, client);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "messages_read_failed";
    return NextResponse.json({ error: reason }, { status: statusFor(reason) });
  }
}
