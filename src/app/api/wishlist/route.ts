import { NextResponse } from "next/server";
import { addToMyWishlist, listMyWishlist, removeFromMyWishlist } from "@/server/dal/wishlist";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const entries = await listMyWishlist({ limit: Number(url.searchParams.get("limit") ?? "50"), offset: Number(url.searchParams.get("offset") ?? "0") });
    return NextResponse.json({ entries });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "wishlist_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function POST(request: Request) {
  try { return NextResponse.json({ entry: await addToMyWishlist(await request.json()) }, { status: 201 }); }
  catch (error) { const reason = error instanceof Error ? error.message : "wishlist_add_failed"; return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 }); }
}

export async function DELETE(request: Request) {
  try { return NextResponse.json(await removeFromMyWishlist(await request.json())); }
  catch (error) { const reason = error instanceof Error ? error.message : "wishlist_remove_failed"; return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 }); }
}
