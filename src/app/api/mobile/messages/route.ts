import { NextResponse } from "next/server";
import { ensureDirectConversation, listDirectConversations, sendDirectMessage } from "@/server/dal/messages";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

function statusFor(reason: string) {
  if (reason === "unauthenticated") return 401;
  if (reason === "conversation_forbidden") return 403;
  if (reason.endsWith("_unavailable")) return 503;
  return 400;
}

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
    return NextResponse.json({ error: reason }, { status: statusFor(reason) });
  }
}

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const payload = await request.json() as {
      peerUserId?: unknown;
      body?: unknown;
      postId?: unknown;
      templateIds?: unknown;
    };
    if (payload.body !== undefined || payload.postId !== undefined || payload.templateIds !== undefined) {
      const message = await sendDirectMessage({
        peerUserId: payload.peerUserId,
        body: payload.body,
        postId: payload.postId,
        templateIds: payload.templateIds,
      }, client);
      return NextResponse.json({ conversationId: message.conversationId, message }, { status: 201 });
    }
    const conversationId = await ensureDirectConversation(payload.peerUserId, client);
    return NextResponse.json({ conversationId }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "conversation_create_failed";
    return NextResponse.json({ error: reason }, { status: statusFor(reason) });
  }
}
