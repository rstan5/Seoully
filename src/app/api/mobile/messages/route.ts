import { NextResponse } from "next/server";
import { ensureDirectConversation, listDirectConversations } from "@/server/dal/messages";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    return NextResponse.json(
      { conversations: await listDirectConversations(client) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "messages_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const payload = await request.json() as { peerUserId?: unknown };
    const conversationId = await ensureDirectConversation(payload.peerUserId, client);
    return NextResponse.json({ conversationId }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "conversation_create_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
