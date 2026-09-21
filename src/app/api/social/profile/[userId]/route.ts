import { NextResponse } from "next/server";
import { getProductionProfilePosts } from "@/server/dal/social";

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await context.params;
    const url = new URL(request.url);
    const page = await getProductionProfilePosts(userId, { limit: Number(url.searchParams.get("limit") ?? "20"), ...(url.searchParams.get("cursor") ? { cursor: url.searchParams.get("cursor")! } : {}) });
    return NextResponse.json({ page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "social_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400, headers: { "Cache-Control": "no-store" } });
  }
}
