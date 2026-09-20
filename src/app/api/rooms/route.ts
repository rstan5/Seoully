import { NextResponse } from "next/server";
import { ensureMyRoom, listMyRoomPlacements } from "@/server/dal/rooms";

export async function GET(request: Request) {
  try {
    const room = await ensureMyRoom();
    const url = new URL(request.url);
    const result = await listMyRoomPlacements({ roomId: url.searchParams.get("roomId") ?? room.id });
    return NextResponse.json(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "room_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function POST() {
  try { return NextResponse.json({ room: await ensureMyRoom() }); }
  catch (error) { const reason = error instanceof Error ? error.message : "room_create_failed"; return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 }); }
}
