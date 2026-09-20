import { NextResponse } from "next/server";
import { searchSharedCatalog } from "@/server/dal/catalog";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const limit = Number(url.searchParams.get("limit") ?? "24");
    const offset = Number(url.searchParams.get("offset") ?? "0");
    const results = await searchSharedCatalog({ query, limit, offset });
    return NextResponse.json({ results }, { headers: { "Cache-Control": "public, max-age=10, stale-while-revalidate=30" } });
  } catch {
    return NextResponse.json({ error: "catalog_unavailable" }, { status: 503 });
  }
}
