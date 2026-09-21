import { NextResponse } from "next/server";
import { askSeoullyProduction } from "@/server/assistant/service";

const rateBuckets = new Map<string, { start: number; count: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 20;

function rateLimited(request: Request): boolean {
  const now = Date.now();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const current = rateBuckets.get(ip);
  if (!current || now - current.start >= RATE_WINDOW_MS) rateBuckets.set(ip, { start: now, count: 1 });
  else { current.count += 1; if (current.count > RATE_LIMIT) return true; }
  if (rateBuckets.size > 1_000) for (const [key, bucket] of rateBuckets) if (now - bucket.start >= RATE_WINDOW_MS) rateBuckets.delete(key);
  return false;
}

export async function POST(request: Request) {
  if (rateLimited(request)) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Cache-Control": "no-store" } });
  try {
    const body = await request.json();
    const result = await askSeoullyProduction(body);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "assistant_unavailable";
    return NextResponse.json({ error: reason === "unauthenticated" ? "unauthenticated" : "assistant_unavailable" }, { status: reason === "unauthenticated" ? 401 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
