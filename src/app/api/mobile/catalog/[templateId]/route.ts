import { NextResponse } from "next/server";
import { getSharedCatalogTemplate } from "@/server/dal/catalog";
import { listActiveCatalogReferenceImages } from "@/server/dal/catalog-reference-images";
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
      const references = await listActiveCatalogReferenceImages([template.id], client);
      const imageUrl = references.find(image => image.status === "active")?.url;
      return NextResponse.json({ template: { ...template, ...(imageUrl ? { imageUrl } : {}) } }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch { return NextResponse.json({ error: "catalog_unavailable" }, { status: 400 }); }
}
