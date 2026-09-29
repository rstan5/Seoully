import { NextResponse } from "next/server";
import { searchProductionDiscoverCollectibles, searchProductionPosts, searchProductionUsers } from "@/server/dal/social";
import { searchProductionRooms } from "@/server/discovery/service";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
import { runWithSupabaseClient } from "@/server/supabase/request-client";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const dest = url.searchParams.get("dest") ?? "people";
    return await runWithSupabaseClient(client, async () => {
      if (dest === "posts") {
        const posts = await searchProductionPosts(query, client);
        return NextResponse.json({ posts }, { headers: { "Cache-Control": "no-store" } });
      }
      if (dest === "collectibles") {
        const collectibles = await searchProductionDiscoverCollectibles(query);
        return NextResponse.json({ collectibles }, { headers: { "Cache-Control": "no-store" } });
      }
      if (dest === "rooms") {
        const rooms = await searchProductionRooms(query, client);
        return NextResponse.json({ rooms }, { headers: { "Cache-Control": "no-store" } });
      }
      const users = await searchProductionUsers(query, client);
      return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "social_search_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
