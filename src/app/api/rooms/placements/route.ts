import { NextResponse } from "next/server";
import { removeMyRoomPlacement, upsertMyRoomPlacement } from "@/server/dal/rooms";

export async function POST(request: Request) {
  try { return NextResponse.json({ placement: await upsertMyRoomPlacement(await request.json()) }, { status: 201 }); }
  catch (error) { const reason = error instanceof Error ? error.message : "room_placement_write_failed"; return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 }); }
}

export async function DELETE(request: Request) {
  try { return NextResponse.json(await removeMyRoomPlacement(await request.json())); }
  catch (error) { const reason = error instanceof Error ? error.message : "room_placement_delete_failed"; return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 }); }
}
