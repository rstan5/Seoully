import { NextResponse } from "next/server";
import { getProductionDiscoverFeed, getProductionFeed } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") || undefined;
    const input = { limit: Number(url.searchParams.get("limit") ?? "20"), ...(cursor ? { cursor } : {}) };
    const page = url.searchParams.get("mode") === "discover"
      ? await getProductionDiscoverFeed(input, client)
      : await getProductionFeed(input, client);
    return NextResponse.json({ page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "social_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
