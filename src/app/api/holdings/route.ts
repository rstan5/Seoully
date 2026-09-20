import { NextResponse } from "next/server";
import { createMyHolding, listMyHoldings } from "@/server/dal/holdings";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const holdings = await listMyHoldings({
      limit: Number(url.searchParams.get("limit") ?? "50"),
      offset: Number(url.searchParams.get("offset") ?? "0"),
    });
    return NextResponse.json({ holdings });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "holding_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function POST(request: Request) {
  try {
    const holding = await createMyHolding(await request.json());
    return NextResponse.json({ holding }, { status: 201 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "holding_create_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
