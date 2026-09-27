import { NextResponse } from "next/server";
import { createSharedCatalogContribution } from "@/server/dal/catalog";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const contribution = await createSharedCatalogContribution(await request.json(), client);
    return NextResponse.json({ contribution }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "catalog_contribution_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
