import { NextResponse } from "next/server";
import { likePost, unlikePost } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ postId: string }> };

async function update(request: Request, context: Context, liked: boolean) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { postId } = await context.params;
    const state = liked ? await likePost(postId, client) : await unlikePost(postId, client);
    return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "like_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export function PUT(request: Request, context: Context) {
  return update(request, context, true);
}

export function DELETE(request: Request, context: Context) {
  return update(request, context, false);
}
