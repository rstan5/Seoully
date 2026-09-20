import { NextResponse } from "next/server";
import { collectionGraphQuery } from "@/server/collection-graph/actions";

const allowed = new Set(["my-collection", "my-wishlist", "owners", "wanters", "owners-of-my-wishlist", "wanting-my-items", "reciprocal", "overlap", "breakdown", "coverage"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as { operation?: string; input?: unknown };
    if (!body.operation || !allowed.has(body.operation)) return NextResponse.json({ error: "unknown_graph_operation" }, { status: 400 });
    const result = await collectionGraphQuery(body.operation, body.input ?? {});
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "unauthenticated" ? 401 : 400 });
  } catch { return NextResponse.json({ error: "invalid_graph_request" }, { status: 400 }); }
}
