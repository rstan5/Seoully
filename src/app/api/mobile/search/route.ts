import { NextResponse } from "next/server";
import { searchProductionUsers } from "@/server/dal/social";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const query = new URL(request.url).searchParams.get("q") ?? "";
    const users = await searchProductionUsers(query, client);
    return NextResponse.json({ users }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "social_search_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
