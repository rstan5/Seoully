import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

const kindValues = ["photocard", "album", "vinyl", "poster", "lightstick", "plushie", "figure", "book", "apparel", "memorabilia"] as const;

export const catalogSearchSchema = z.object({
  query: z.string().trim().max(120).default(""),
  limit: z.number().int().min(1).max(50).default(24),
  offset: z.number().int().min(0).max(10_000).default(0),
}).strict();

export const catalogContributionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  kind: z.enum(kindValues),
  groupName: z.string().trim().min(1).max(120),
  memberName: z.string().trim().max(120).optional(),
  releaseName: z.string().trim().max(160).optional(),
  descriptor: z.string().trim().max(300).optional(),
}).strict();

export type CatalogContributionInput = z.infer<typeof catalogContributionSchema>;

export interface CatalogTemplateDTO {
  id: string;
  groupId: string;
  memberId: string | null;
  releaseId: string | null;
  kind: (typeof kindValues)[number];
  name: string;
  descriptor: string;
  status: "community" | "verified" | "restricted";
  groupName: string;
  memberName: string | null;
  releaseName: string | null;
  createdAt: string;
}

export interface CatalogContributionDTO {
  template: CatalogTemplateDTO;
  contributorUserId: string;
  created: boolean;
}

export async function searchSharedCatalog(input: unknown): Promise<CatalogTemplateDTO[]> {
  const parsed = catalogSearchSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("collectible_templates")
    .select("id,group_id,member_id,release_id,kind,name,descriptor,status,created_at")
    .neq("status", "restricted")
    .order("created_at", { ascending: false })
    .range(parsed.offset, parsed.offset + parsed.limit - 1);
  if (parsed.query) {
    const normalized = parsed.query.replace(/[%(),]/g, " ").trim();
    if (normalized) query = query.ilike("search_text", `%${normalized}%`);
  }
  const { data, error } = await query;
  if (error) throw new Error("catalog_search_failed");
  return hydrateCatalogTemplates(data ?? [], supabase);
}

export async function createSharedCatalogContribution(input: unknown): Promise<CatalogContributionDTO> {
  const payload = catalogContributionSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_catalog_contribution", { p_payload: payload });
  if (error) {
    if (error.code === "42501") throw new Error("unauthenticated");
    throw new Error("catalog_contribution_failed");
  }
  const result = data as { template?: Record<string, unknown>; contributor_user_id?: string; created?: boolean } | null;
  if (!result?.template || result.contributor_user_id !== identity.user.id) throw new Error("catalog_contribution_failed");
  const templates = await hydrateCatalogTemplates([result.template], supabase);
  const template = templates[0];
  if (!template) throw new Error("catalog_contribution_failed");
  return { template, contributorUserId: result.contributor_user_id, created: result.created === true };
}

async function hydrateCatalogTemplates(rows: Array<Record<string, unknown>>, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<CatalogTemplateDTO[]> {
  const groupIds = [...new Set(rows.map((row) => row.group_id).filter((id): id is string => typeof id === "string"))];
  const memberIds = [...new Set(rows.map((row) => row.member_id).filter((id): id is string => typeof id === "string"))];
  const releaseIds = [...new Set(rows.map((row) => row.release_id).filter((id): id is string => typeof id === "string"))];
  const [groups, members, releases] = await Promise.all([
    groupIds.length ? supabase.from("catalog_groups").select("id,name").in("id", groupIds) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? supabase.from("catalog_members").select("id,stage_name").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
    releaseIds.length ? supabase.from("catalog_releases").select("id,title").in("id", releaseIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (groups.error || members.error || releases.error) throw new Error("catalog_search_failed");
  const groupMap = new Map((groups.data ?? []).map((row) => [row.id, row.name]));
  const memberMap = new Map((members.data ?? []).map((row) => [row.id, row.stage_name]));
  const releaseMap = new Map((releases.data ?? []).map((row) => [row.id, row.title]));
  return rows.map((row) => ({
    id: String(row.id),
    groupId: String(row.group_id),
    memberId: typeof row.member_id === "string" ? row.member_id : null,
    releaseId: typeof row.release_id === "string" ? row.release_id : null,
    kind: row.kind as CatalogTemplateDTO["kind"],
    name: String(row.name),
    descriptor: String(row.descriptor ?? ""),
    status: row.status as CatalogTemplateDTO["status"],
    groupName: groupMap.get(String(row.group_id)) ?? "",
    memberName: typeof row.member_id === "string" ? memberMap.get(row.member_id) ?? null : null,
    releaseName: typeof row.release_id === "string" ? releaseMap.get(row.release_id) ?? null : null,
    createdAt: String(row.created_at),
  }));
}
