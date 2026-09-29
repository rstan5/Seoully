import { NextResponse } from "next/server";
import { getPublicCollectorCollection } from "@/server/dal/public-collection";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { userId } = await context.params;
    const collection = await getPublicCollectorCollection(userId, client);
    return NextResponse.json(collection, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "collector_collection_failed";
    const status = reason === "unauthenticated" ? 401
      : reason === "same_collector" || reason === "collector_not_visible" ? 404
      : 400;
    return NextResponse.json({ error: reason }, { status });
  }
}
