import { NextResponse } from "next/server";
import {
  discoverCollectibles,
  discoverCollectors,
  discoverRooms,
} from "@/server/discovery/service";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

const allowed = new Set(["collectors", "rooms", "collectibles"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ surface: string }> },
) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { surface } = await context.params;
    if (!allowed.has(surface)) {
      return NextResponse.json({ error: "unknown_discovery_surface" }, { status: 400 });
    }
    const body = await request.json() as { limit?: unknown };
    const input = { limit: body.limit };
    const items = surface === "collectors"
      ? await discoverCollectors(input, client)
      : surface === "rooms"
        ? await discoverRooms(input, client)
        : await discoverCollectibles(input, client);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "discovery_failed";
    return NextResponse.json(
      { error: reason },
      { status: reason === "unauthenticated" ? 401 : 400 },
    );
  }
}
