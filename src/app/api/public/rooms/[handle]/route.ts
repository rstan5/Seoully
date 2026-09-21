import { NextResponse } from "next/server";
import { getPublicRoomByHandle } from "@/server/dal/public-room";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await context.params;
    const room = await getPublicRoomByHandle(handle);
    if (!room) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(room, { headers: { "Cache-Control": "private, max-age=15" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
