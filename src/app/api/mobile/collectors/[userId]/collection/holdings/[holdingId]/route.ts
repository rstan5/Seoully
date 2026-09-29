import { NextResponse } from "next/server";
import { getPublicCollectorHolding } from "@/server/dal/public-collection";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ userId: string; holdingId: string }> };

export async function GET(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { userId, holdingId } = await context.params;
    const holding = await getPublicCollectorHolding(userId, holdingId, client);
    if (!holding) return NextResponse.json({ error: "holding_not_found" }, { status: 404 });
    return NextResponse.json({ holding }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "public_holding_read_failed";
    const status = reason === "unauthenticated" ? 401
      : reason === "same_collector" || reason === "collector_not_visible" ? 404
      : 400;
    return NextResponse.json({ error: reason }, { status });
  }
}
