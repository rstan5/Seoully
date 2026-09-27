import { NextResponse } from "next/server";
import { listDirectMessages, sendDirectMessage } from "@/server/dal/messages";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ conversationId: string }> };

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
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function POST(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { conversationId } = await context.params;
    const payload = await request.json() as { body?: unknown };
    const message = await sendDirectMessage(conversationId, payload.body, client);
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "message_send_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
