import { NextResponse } from "next/server";
import { getCurrentIdentity, getPublicProfileByHandle } from "@/server/dal/profile";

export async function GET(_request: Request, context: { params: Promise<{ handle: string }> }) {
  try {
    if (!(await getCurrentIdentity())) return NextResponse.json({ error: "authentication_required" }, { status: 401 });
    const { handle } = await context.params;
    const profile = await getPublicProfileByHandle(handle);
    if (!profile) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(profile, { headers: { "Cache-Control": "private, max-age=30" } });
  } catch {
    return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  }
}
