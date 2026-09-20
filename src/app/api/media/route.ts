import { NextResponse } from "next/server";
import { getMyHoldingMedia, removeMyHoldingMedia, uploadHoldingMedia } from "@/server/dal/media";

function responseError(error: unknown) {
  const reason = error instanceof Error ? error.message : "media_request_failed";
  const status = reason === "unauthenticated" ? 401 : reason.endsWith("_not_found") ? 404 : 400;
  return NextResponse.json({ error: reason }, { status });
}

export async function GET(request: Request) {
  try {
    const holdingId = new URL(request.url).searchParams.get("holdingId");
    return NextResponse.json({ asset: await getMyHoldingMedia(holdingId) });
  } catch (error) { return responseError(error); }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    return NextResponse.json({ asset: await uploadHoldingMedia({ holdingId: formData.get("holdingId"), file }) }, { status: 201 });
  } catch (error) { return responseError(error); }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(await removeMyHoldingMedia(body?.holdingId));
  } catch (error) { return responseError(error); }
}
