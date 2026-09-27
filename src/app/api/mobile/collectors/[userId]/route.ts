import { NextResponse } from "next/server";
import { getPublicProfile } from "@/server/dal/profile";
import { followUser, getFollowState, unfollowUser } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { userId } = await context.params;
    const [profile, follow] = await Promise.all([
      getPublicProfile(userId, client),
      getFollowState(userId, client),
    ]);
    if (!profile) return NextResponse.json({ error: "collector_not_found" }, { status: 404 });
    return NextResponse.json({ profile, follow }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "collector_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function PATCH(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { userId } = await context.params;
    const payload = await request.json() as { following?: unknown };
    if (typeof payload.following !== "boolean") throw new Error("invalid_follow_state");
    const state = payload.following
      ? await followUser(userId, client)
      : await unfollowUser(userId, client);
    return NextResponse.json(state);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "follow_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
