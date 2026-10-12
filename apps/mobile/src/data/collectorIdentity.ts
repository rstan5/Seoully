import { supabase } from "../supabase";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Resolve selected catalog UUIDs directly, even outside a search result's limit.
 * Legacy fixture identity labels remain supplied by the existing onboarding read.
 */
export async function readSelectedCatalogIdentity(groupIds: string[], memberIds: string[]) {
  const groups = [...new Set(groupIds.filter(id => UUID.test(id)))];
  const members = [...new Set(memberIds.filter(id => UUID.test(id)))];
  const [g, m] = await Promise.all([
    groups.length ? supabase.from("catalog_groups").select("id,name").in("id", groups).neq("status", "restricted") : { data: [], error: null },
    members.length ? supabase.from("catalog_members").select("id,group_id,stage_name,catalog_groups!inner(name,status)").in("id", members).neq("status", "restricted").neq("catalog_groups.status", "restricted") : { data: [], error: null },
  ]);
  if (g.error || m.error) throw new Error("catalog_identity_unavailable");
  return { groups: (g.data ?? []).map(row => ({ id: row.id, name: row.name })),
    members: (m.data ?? []).flatMap(row => {
      const group = Array.isArray(row.catalog_groups) ? row.catalog_groups[0] : row.catalog_groups;
      return group ? [{ id: row.id, groupId: row.group_id, stageName: row.stage_name, nativeName: row.stage_name, groupName: group.name }] : [];
    }) };
}
