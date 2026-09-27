import { NextResponse } from "next/server";
import { createMyHolding } from "@/server/dal/holdings";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const holding = await createMyHolding(await request.json(), client);
    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "holding_create_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
