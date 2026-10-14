import { NextResponse } from "next/server";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
import { runWithSupabaseClient } from "@/server/supabase/request-client";
import { searchSharedCatalog } from "@/server/dal/catalog";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "24");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const client = createSupabaseBearerClient(request);
    const results = client ? await runWithSupabaseClient(client, () => searchSharedCatalog({ query, limit, offset })) : await searchSharedCatalog({ query, limit, offset });
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
}
