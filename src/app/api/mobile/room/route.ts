import { NextResponse } from "next/server";
import { listMyHoldings } from "@/server/dal/holdings";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureMyRoom, listMyRoomPlacements, removeMyRoomPlacement, updateMyRoomStyle, updateMyRoomTheme, upsertMyRoomPlacement } from "@/server/dal/rooms";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const room = await ensureMyRoom(client);
    const [{ placements }, holdings] = await Promise.all([
      listMyRoomPlacements({ roomId: room.id }, client),
      loadAllHoldings(client),
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

export async function PATCH(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const body = await request.json() as { style?: unknown; themeId?: unknown };
    const room = body.style
      ? await updateMyRoomStyle(body, client)
      : await updateMyRoomTheme(body, client);
    return NextResponse.json({ room }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "room_theme_write_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function DELETE(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const result = await removeMyRoomPlacement(await request.json(), client);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "room_placement_delete_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

async function loadAllHoldings(client: SupabaseClient) {
  const holdings = [];
  for (let offset = 0; offset < 2_000; offset += 100) {
    const page = await listMyHoldings({ limit: 100, offset }, client);
    holdings.push(...page);
    if (page.length < 100) break;
  }
  return holdings;
}
