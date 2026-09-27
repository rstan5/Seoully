import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";

/**
 * Native clients cannot participate in Next's cookie session. This narrow endpoint
 * accepts a Supabase access token and resolves the same Seoully identity used by web.
 * It never accepts a user id and never uses a service-role key.
 */
export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "configuration" }, { status: 503 });
  const token = authorization.slice("bearer ".length).trim();
  if (!token) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  try {
    const identity = await getCurrentIdentityFromClient(supabase);
    if (!identity) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    return NextResponse.json({ identity });
  } catch {
    return NextResponse.json({ error: "identity_unavailable" }, { status: 503 });
  }
}
