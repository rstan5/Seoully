import { NextResponse } from "next/server";
import { getCollectorCompatibility } from "@/server/compatibility/service";
import { getTradeOpportunity } from "@/server/trade/service";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

type Context = { params: Promise<{ userId: string }> };

/**
 * Viewer-relative derived pair. Wraps existing graph_pair_snapshot +
 * computeCompatibilityPeople + computeTradeOpportunity. No schema/RLS change.
 * Does not return another user's raw holdings/wishlist graph.
 */
export async function GET(request: Request, context: Context) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const { userId } = await context.params;
    const [compatibility, trade] = await Promise.all([
      getCollectorCompatibility({ targetUserId: userId }, client),
      getTradeOpportunity({ targetUserId: userId }, client),
    ]);
    return NextResponse.json({
      compatibility: {
        score: compatibility.score,
        engine: "people" as const,
        evidenceStrength: compatibility.evidenceStrength,
        visibilityLimited: compatibility.visibilityLimited,
        reasons: compatibility.reasons.map((reason) => ({
          code: reason.code,
          count: reason.count,
        })),
      },
      trade: {
        theyOwnYourWants: trade.theyOwnThatIWant.map((item) => ({
          templateId: item.templateId,
          name: item.templateName,
          ownedCopies: item.ownedCopies,
          forTradeCopies: item.forTradeCopies,
          openToTrade: item.forTradeCopies > 0,
        })),
        youOwnTheirWants: trade.iOwnThatTheyWant.map((item) => ({
          templateId: item.templateId,
          name: item.templateName,
          ownedCopies: item.ownedCopies,
          forTradeCopies: item.forTradeCopies,
          openToTrade: item.forTradeCopies > 0,
        })),
        reciprocal: trade.reciprocal,
        strength: trade.strength,
        visibility: trade.visibility,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "collector_match_failed";
    const status = reason === "unauthenticated" ? 401
      : reason === "same_collector" || reason === "collector_not_visible" ? 404
      : 400;
    return NextResponse.json({ error: reason }, { status });
  }
}
