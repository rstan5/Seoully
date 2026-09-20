import { NextResponse } from "next/server";
import { getProductionCompatibility } from "@/server/compatibility/actions";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { targetUserId?: unknown };
    const result = await getProductionCompatibility({ targetUserId: body.targetUserId });
    return NextResponse.json(result, { status: result.ok ? 200 : result.reason === "unauthenticated" ? 401 : 400 });
  } catch { return NextResponse.json({ error: "invalid_compatibility_request" }, { status: 400 }); }
}
