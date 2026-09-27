import { NextResponse } from "next/server";
import { updateCurrentProfile } from "@/server/dal/profile";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function PATCH(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try { return NextResponse.json({ identity: await updateCurrentProfile(await request.json(), client) }); }
  catch (error) { const reason = error instanceof Error ? error.message : "profile_update_failed"; return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 }); }
}
