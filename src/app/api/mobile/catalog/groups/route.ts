import { CATALOG_QA_GROUP_FILTER } from "@/domain/catalog-fixtures";
import { GROUPS } from "@/domain/fixtures/catalog";
import { NextResponse } from "next/server";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

/** Search shared community catalog names; never creates a group or contribution. */
export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 120) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    const { data, error } = await client.from("catalog_groups").select("id,name")
      .neq("status", "restricted").not("id", "in", CATALOG_QA_GROUP_FILTER).ilike("name", `%${query.replace(/[\\%_]/g, "")}%`).order("name").limit(50);
    if (error) throw new Error("groups_unavailable");
    const known = new Map(GROUPS.map(group => [group.name.normalize("NFKC").trim().toLocaleLowerCase(), group]));
    return NextResponse.json({ groups: (data ?? []).map(group => ({ ...(known.get(group.name.normalize("NFKC").trim().toLocaleLowerCase()) ?? { id: group.id, name: group.name, nativeName: group.name, memberIds: [] }), catalogId: group.id })) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "groups_unavailable" }, { status: 503 }); }
}
