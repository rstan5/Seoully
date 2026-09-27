import { NextResponse } from "next/server";
import { getProductionFeed } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const page = await getProductionFeed({ limit: Number(url.searchParams.get("limit") ?? "20") }, client);
    return NextResponse.json({ page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "social_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
