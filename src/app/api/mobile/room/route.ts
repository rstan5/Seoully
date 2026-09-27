import { NextResponse } from "next/server";
import { listMyHoldings } from "@/server/dal/holdings";
import { ensureMyRoom, listMyRoomPlacements, upsertMyRoomPlacement } from "@/server/dal/rooms";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const room = await ensureMyRoom(client);
    const [{ placements }, holdings] = await Promise.all([
      listMyRoomPlacements({ roomId: room.id }, client),
      listMyHoldings({ limit: 100, offset: 0 }, client),
    ]);
    return NextResponse.json({ room, placements, holdings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "room_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function PUT(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const placement = await upsertMyRoomPlacement(await request.json(), client);
    return NextResponse.json({ placement }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "room_placement_write_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
