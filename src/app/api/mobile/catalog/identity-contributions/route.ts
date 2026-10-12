import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
const input = z.object({ submissionId: z.string().uuid(), name: z.string().min(1).max(120).refine(value => Boolean(value.trim())), kind: z.enum(["group", "member"]), groupId: z.string().uuid().optional() }).strict()
  .refine(value => value.kind === "member" ? Boolean(value.groupId) : value.groupId === undefined);
export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    const { data, error } = await client.rpc("contribute_catalog_identity", { p_payload: parsed.data });
    if (error) return NextResponse.json({ error: ["PGRST202", "42883"].includes(error.code) ? "capability_unavailable" : "contribution_failed" }, { status: ["PGRST202", "42883"].includes(error.code) ? 503 : 400 });
    return NextResponse.json({ contribution: data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "contribution_failed" }, { status: 400 }); }
}
