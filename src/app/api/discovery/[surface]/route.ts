import { NextResponse } from "next/server";
import { discoveryQuery } from "@/server/discovery/actions";

const allowed = new Set(["collectors", "rooms", "collectibles"]);

export async function POST(request: Request, context: { params: Promise<{ surface: string }> }) {
  try {
    const { surface } = await context.params;
    if (!allowed.has(surface)) return NextResponse.json({ error: "unknown_discovery_surface" }, { status: 400 });
    const body = await request.json() as { limit?: unknown };
    const result = await discoveryQuery(surface, { limit: body.limit });
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "unauthenticated" ? 401 : 400 });
  } catch { return NextResponse.json({ error: "invalid_discovery_request" }, { status: 400 }); }
}
