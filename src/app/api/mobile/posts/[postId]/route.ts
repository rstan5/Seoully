import { NextResponse } from "next/server";
import { getProductionPost } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
export async function GET(request: Request, context: { params: Promise<{ postId: string }> }) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const post = await getProductionPost((await context.params).postId, client);
    return NextResponse.json(post ? { post } : { error: "not_found" }, { status: post ? 200 : 404, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "social_read_failed" }, { status: 400 }); }
}
