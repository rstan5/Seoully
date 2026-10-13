import { NextResponse } from "next/server";
import { readPhotocardCollectorCounts, collectorCountInput } from "@/server/dal/photocard-collector-count";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
import { createSupabaseServerClient } from "@/server/supabase/server";
export async function POST(request: Request) {
  const parsed = collectorCountInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    const client = createSupabaseBearerClient(request) ?? await createSupabaseServerClient();
    const counts = await readPhotocardCollectorCounts(parsed.data, client);
    return NextResponse.json({ counts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const unauthenticated = error instanceof Error && error.message === "unauthenticated";
    return NextResponse.json({ error: unauthenticated ? "unauthenticated" : "collector_counts_unavailable" }, { status: unauthenticated ? 401 : 503 });
  }
}
