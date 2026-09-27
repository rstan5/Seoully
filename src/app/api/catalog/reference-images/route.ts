import { NextResponse } from "next/server";
import { createCatalogReferenceImage, listActiveCatalogReferenceImages } from "@/server/dal/catalog-reference-images";

function responseError(error: unknown) {
  const reason = error instanceof Error ? error.message : "catalog_reference_request_failed";
  const status = reason === "unauthenticated" ? 401 : reason.includes("not_authorized") ? 403 : reason.includes("not_found") ? 404 : 400;
  return NextResponse.json({ error: reason }, { status });
}

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get("templateIds") ?? "";
    const templateIds = raw.split(",").map((id) => id.trim()).filter(Boolean);
    return NextResponse.json({ images: await listActiveCatalogReferenceImages(templateIds) });
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    const image = await createCatalogReferenceImage({
      templateId: formData.get("templateId"),
      file,
      sourceKey: formData.get("sourceKey"),
    });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) { return responseError(error); }
}
