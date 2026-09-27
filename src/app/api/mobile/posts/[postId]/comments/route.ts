import { NextResponse } from "next/server";
import { createComment, listPostComments } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ postId: string }> };

export async function GET(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { postId } = await context.params;
    const page = await listPostComments(postId, { limit: 25 }, client);
    return NextResponse.json({ page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "comments_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function POST(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { postId } = await context.params;
    const payload = await request.json() as { body?: unknown };
    const comment = await createComment(postId, payload.body, client);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "comment_create_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
