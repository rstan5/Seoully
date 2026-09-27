import { NextResponse } from "next/server";
import { getPublicProfile } from "@/server/dal/profile";
import { getPublicRoomByHandle } from "@/server/dal/public-room";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { userId } = await context.params;
    const profile = await getPublicProfile(userId, client);
    if (!profile) return NextResponse.json({ error: "collector_not_found" }, { status: 404 });
    const room = await getPublicRoomByHandle(profile.user.handle, client);
    if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(room, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "public_room_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
