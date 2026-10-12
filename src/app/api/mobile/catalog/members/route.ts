import { CATALOG_QA_GROUP_FILTER } from "@/domain/catalog-fixtures";
import { GROUPS, MEMBERS } from "@/domain/fixtures/catalog";
import { NextResponse } from "next/server";
import { createSupabaseBearerClient } from "@/server/supabase/bearer";

/** Public catalog identity search, not an artist/member creation endpoint. */
export async function GET(request: Request) {
  const client = createSupabaseBearerClient(request);
  if (!client) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 120) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  try {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    const { data, error } = await client.from("catalog_members")
      .select("id,group_id,stage_name,catalog_groups!inner(id,name,status)")
      .neq("status", "restricted").not("group_id", "in", CATALOG_QA_GROUP_FILTER).neq("catalog_groups.status", "restricted")
      .ilike("stage_name", `%${query.replace(/[\\%_]/g, "")}%`).order("stage_name").limit(500);
    if (error) throw new Error("members_unavailable");
    const normalize = (name: string) => name.normalize("NFKC").trim().toLocaleLowerCase();
    const members = (data ?? []).map(row => {
      const relation = row.catalog_groups;
      const group = Array.isArray(relation) ? relation[0] : relation;
      if (!group) throw new Error("member_group_unavailable");
      const knownGroup = GROUPS.find(g => normalize(g.name) === normalize(group.name));
      const groupId = knownGroup?.id ?? row.group_id;
      const known = MEMBERS.find(m => m.groupId === groupId && normalize(m.stageName) === normalize(row.stage_name));
      return { id: known?.id ?? row.id, groupId, stageName: row.stage_name, nativeName: known?.nativeName ?? row.stage_name, groupName: group.name };
    });
    return NextResponse.json({ members }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "members_unavailable" }, { status: 503 }); }
}
