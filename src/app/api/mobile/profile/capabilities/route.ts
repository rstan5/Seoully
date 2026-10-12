import { NextResponse } from "next/server";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";
export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const { data: auth, error } = await client.auth.getUser();
  if (error || !auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const result = await client.rpc("profile_identity_capabilities");
  if (result.error && !["PGRST202", "42883"].includes(result.error.code)) return NextResponse.json({ error: "capabilities_unavailable" }, { status: 503 });
  return NextResponse.json({ profileAvatar: !result.error && result.data?.profileAvatar === true, catalogIdentityContributions: !result.error && result.data?.catalogIdentityContributions === true }, { headers: { "Cache-Control": "no-store" } });
}
