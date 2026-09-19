import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfiguration } from "@/server/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next");
  let destination = new URL("/", url.origin);
  if (requested) {
    try {
      const candidate = new URL(requested, url.origin);
      if (candidate.origin === url.origin) destination = candidate;
    } catch {
      // Invalid redirect destinations fall back to the application root.
    }
  }
  if (!code || !hasSupabaseConfiguration()) {
    return NextResponse.redirect(new URL("/?auth=unavailable", url.origin));
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/?auth=unavailable", url.origin));
  return NextResponse.redirect(destination);
}
