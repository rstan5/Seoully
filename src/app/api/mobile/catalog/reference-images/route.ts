import { NextResponse } from "next/server";
import { createCatalogReferenceImage } from "@/server/dal/catalog-reference-images";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    const image = await createCatalogReferenceImage({ templateId: formData.get("templateId"), sourceKey: formData.get("sourceKey"), file }, client);
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "catalog_reference_upload_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
