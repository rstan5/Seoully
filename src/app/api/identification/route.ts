import { NextResponse } from "next/server";
import { getCurrentIdentity } from "@/server/dal/profile";
import { identifyCollectible, retrieveCatalogCandidates } from "@/server/identification/service";

export async function POST(request: Request) {
  try {
    const identity = await getCurrentIdentity();
    if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type) || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "invalid_media" }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const dataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
    const hypothesis = await identifyCollectible({ dataUrl, mimeType: file.type });
    const candidates = await retrieveCatalogCandidates(hypothesis);
    return NextResponse.json({ hypothesis, candidates });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "identification_unavailable";
    return NextResponse.json({ error: reason, manualFallback: true }, { status: 503 });
  }
}
