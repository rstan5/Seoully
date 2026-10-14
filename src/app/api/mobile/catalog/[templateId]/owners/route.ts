import { NextResponse } from "next/server";
import { findOwnersOfTemplate } from "@/server/dal/collection-graph";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
import { runWithSupabaseClient } from "@/server/supabase/request-client";
export async function GET(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { templateId } = await context.params;
    const owners = await runWithSupabaseClient(client, () => findOwnersOfTemplate({ templateId, limit: 25, offset: 0 }));
    return NextResponse.json({ owners: owners.map(({ userId, handle, displayName }) => ({ userId, handle, displayName })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "owners_unavailable" }, { status: 400 }); }
}
