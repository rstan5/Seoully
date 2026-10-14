import { NextResponse } from "next/server";
import { getSharedCatalogTemplate } from "@/server/dal/catalog";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
import { runWithSupabaseClient } from "@/server/supabase/request-client";

export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const auth = await client.auth.getUser();
    if (!auth.data.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const { templateId } = await context.params;
    return await runWithSupabaseClient(client, async () => {
      const template = await getSharedCatalogTemplate(templateId);
      if (!template) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ template }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch { return NextResponse.json({ error: "catalog_unavailable" }, { status: 400 }); }
}
