import { NextResponse } from "next/server";
import { addToMyWishlist, listMyWishlist, removeFromMyWishlist } from "@/server/dal/wishlist";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const entries = await listMyWishlist({ limit: 100, offset: 0 }, client);
    return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "wishlist_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

async function mutate(request: Request, adding: boolean) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const input = await request.json();
    const result = adding
      ? { entry: await addToMyWishlist(input, client) }
      : await removeFromMyWishlist(input, client);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "wishlist_update_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export function POST(request: Request) {
  return mutate(request, true);
}

export function DELETE(request: Request) {
  return mutate(request, false);
}
