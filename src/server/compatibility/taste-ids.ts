import { GROUPS, MEMBERS } from "@/domain/fixtures/catalog";

export type TasteCatalogGroup = { id: string; slug: string; name: string };
export type TasteCatalogMember = { id: string; groupId: string; stageName: string; normalizedName: string };

function key(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function link(index: Map<string, Set<string>>, ids: string[]) {
  const unique = [...new Set(ids.filter((id) => id.length > 0))];
  for (const id of unique) {
    const set = index.get(id) ?? new Set<string>();
    for (const other of unique) set.add(other);
    index.set(id, set);
  }
}

/**
 * Maps onboarding fixture slugs (`skz`) and production catalog UUIDs onto a
 * shared alias set. Does not rewrite stored profile rows.
 */
export function buildTasteAliasIndex(input: {
  catalogGroups: TasteCatalogGroup[];
  catalogMembers: TasteCatalogMember[];
}): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  const groupsByName = new Map(input.catalogGroups.map((group) => [key(group.name), group]));
  const groupsBySlug = new Map(input.catalogGroups.map((group) => [group.slug, group]));

  for (const group of input.catalogGroups) {
    link(index, [group.id, group.slug, key(group.name)]);
  }
  for (const fixture of GROUPS) {
    const catalog = groupsBySlug.get(fixture.id) ?? groupsByName.get(key(fixture.name));
    if (catalog) link(index, [fixture.id, catalog.id, catalog.slug, key(catalog.name), key(fixture.name)]);
    else link(index, [fixture.id, key(fixture.name)]);
  }

  const membersByGroup = new Map<string, TasteCatalogMember[]>();
  for (const member of input.catalogMembers) {
    const list = membersByGroup.get(member.groupId) ?? [];
    list.push(member);
    membersByGroup.set(member.groupId, list);
    link(index, [member.id, member.normalizedName, key(member.stageName)]);
  }
  for (const fixture of MEMBERS) {
    const catalogGroup = groupsBySlug.get(fixture.groupId) ?? groupsByName.get(key(GROUPS.find((group) => group.id === fixture.groupId)?.name ?? ""));
    const catalogMember = catalogGroup
      ? (membersByGroup.get(catalogGroup.id) ?? []).find((member) => member.normalizedName === key(fixture.stageName) || key(member.stageName) === key(fixture.stageName))
      : undefined;
    if (catalogMember) link(index, [fixture.id, catalogMember.id, catalogMember.normalizedName, key(fixture.stageName)]);
    else link(index, [fixture.id, key(fixture.stageName)]);
  }
  return index;
}

export function expandTasteIds(ids: string[], index: Map<string, Set<string>>): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    out.add(id);
    for (const alias of index.get(id) ?? []) out.add(alias);
  }
  return [...out];
}
