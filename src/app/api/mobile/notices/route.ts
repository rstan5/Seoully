import { NextResponse } from "next/server";
import { listSocialNotices, markSocialNoticesRead, unreadSocialNoticeCount } from "@/server/dal/notices";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

function statusFor(reason: string) {
  if (reason === "unauthenticated") return 401;
  if (reason.endsWith("_unavailable")) return 503;
  return 400;
}

export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    const [notices, unreadCount] = await Promise.all([
      listSocialNotices(client),
      unreadSocialNoticeCount(client),
    ]);
    return NextResponse.json({ notices, unreadCount }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "notices_read_failed";
    return NextResponse.json({ error: reason }, { status: statusFor(reason) });
  }
}

export async function PATCH(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  try {
    await markSocialNoticesRead(client);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "notices_read_failed";
    return NextResponse.json({ error: reason }, { status: statusFor(reason) });
  }
}
