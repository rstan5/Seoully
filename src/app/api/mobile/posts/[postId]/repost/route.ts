import { NextResponse } from "next/server";
import { setPostReposted } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
type Context = { params: Promise<{ postId: string }> };
async function write(request: Request, context: Context, reposted: boolean) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { postId } = await context.params;
    return NextResponse.json(await setPostReposted(postId, reposted, client), { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "repost_unavailable" }, { status: 400 }); }
}
export const PUT = (request: Request, context: Context) => write(request, context, true);
export const DELETE = (request: Request, context: Context) => write(request, context, false);
