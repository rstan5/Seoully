import { NextResponse } from "next/server";
import { getPublicProfileByHandle } from "@/server/dal/profile";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }) {
  try {
    const { handle } = await context.params;
    const profile = await getPublicProfileByHandle(handle);
    if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(profile, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
