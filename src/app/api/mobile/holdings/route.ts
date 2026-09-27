import { NextResponse } from "next/server";
import { createMyHolding, listMyHoldings, setMyHoldingTradeStatus } from "@/server/dal/holdings";
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

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const holdings = await listMyHoldings({
      limit: Number(url.searchParams.get("limit") ?? "100"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    }, client);
    return NextResponse.json({ holdings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "holding_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function PATCH(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const holding = await setMyHoldingTradeStatus(await request.json(), client);
    return NextResponse.json({ holding }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "holding_trade_update_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
