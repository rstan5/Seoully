import { NextResponse } from "next/server";
import { getMyHolding, removeMyHolding } from "@/server/dal/holdings";

export async function GET(_request: Request, context: { params: Promise<{ holdingId: string }> }) {
  try {
    const { holdingId } = await context.params;
    const holding = await getMyHolding({ holdingId });
    return holding ? NextResponse.json({ holding }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "holding_read_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ holdingId: string }> }) {
  try {
    const { holdingId } = await context.params;
    const result = await removeMyHolding({ holdingId });
    return result.removed ? NextResponse.json(result) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "holding_delete_failed";
    return NextResponse.json({ error: reason }, { status: reason === "unauthenticated" ? 401 : 400 });
  }
}
