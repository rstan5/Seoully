import { reportOperationFailure } from "@/server/dal/safe-diagnostic";
import { NextResponse } from "next/server";
import { createMyHolding, getMyHolding, listMyHoldings, removeMyHolding, setMyHoldingTradeStatus } from "@/server/dal/holdings";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

export async function POST(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const holding = await createMyHolding(await request.json(), client);
    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    reportOperationFailure("holding", error);
    const reason = error instanceof Error ? error.message : "holding_create_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const url = new URL(request.url);
    const holdingId = url.searchParams.get("holdingId");
    if (holdingId) {
      const holding = await getMyHolding({ holdingId }, client);
      return NextResponse.json({ holding }, { headers: { "Cache-Control": "no-store" } });
    }
    const holdings = await listMyHoldings({
      limit: Number(url.searchParams.get("limit") ?? "100"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    }, client);
    return NextResponse.json({ holdings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    reportOperationFailure("holding", error);
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
    reportOperationFailure("holding", error);
    const reason = error instanceof Error ? error.message : "holding_trade_update_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function DELETE(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const payload = await request.json() as { holdingId?: unknown };
    const result = await removeMyHolding({ holdingId: payload.holdingId }, client);
    return result.removed
      ? NextResponse.json(result, { headers: { "Cache-Control": "no-store" } })
      : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    reportOperationFailure("holding", error);
    const reason = error instanceof Error ? error.message : "holding_delete_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
