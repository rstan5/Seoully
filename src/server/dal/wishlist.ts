import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";
import type { CatalogTemplateDTO } from "@/server/dal/catalog";

const pageSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(100_000).default(0),
}).strict();
const templateSchema = z.object({ templateId: z.string().uuid() }).strict();

export interface WishlistEntryDTO {
  id: string;
  ownerUserId: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  template: CatalogTemplateDTO;
}

export async function addToMyWishlist(input: unknown): Promise<WishlistEntryDTO> {
  const { templateId } = templateSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data: template, error: templateError } = await supabase
    .from("collectible_templates")
    .select("id,status")
    .eq("id", templateId)
    .neq("status", "restricted")
    .maybeSingle();
  if (templateError) throw new Error("wishlist_unavailable");
  if (!template) throw new Error("template_not_found");
  const columns = "id,owner_user_id,template_id,created_at,updated_at";
  const { data: existing, error: existingError } = await supabase
    .from("wishlist_entries")
    .select(columns)
    .eq("owner_user_id", identity.user.id)
    .eq("template_id", template.id)
    .maybeSingle();
  if (existingError) throw new Error("wishlist_add_failed");
  if (existing) {
    const [entry] = await hydrateWishlist([existing], supabase);
    if (!entry) throw new Error("wishlist_add_failed");
    return entry;
  }
  const { data, error } = await supabase
    .from("wishlist_entries")
    .insert({ owner_user_id: identity.user.id, template_id: template.id })
    .select(columns)
    .single();
  if (error) {
    // A concurrent identical request may win the unique constraint. Resolve
    // that race by returning the owner's existing entry, never by updating it.
    if (error.code === "23505") {
      const { data: raced } = await supabase
        .from("wishlist_entries")
        .select(columns)
        .eq("owner_user_id", identity.user.id)
        .eq("template_id", template.id)
        .maybeSingle();
      if (raced) {
        const [entry] = await hydrateWishlist([raced], supabase);
        if (entry) return entry;
      }
    }
    throw new Error("wishlist_add_failed");
  }
  if (!data) throw new Error("wishlist_add_failed");
  const [entry] = await hydrateWishlist([data], supabase);
  if (!entry) throw new Error("wishlist_add_failed");
  return entry;
}

export async function removeFromMyWishlist(input: unknown): Promise<{ removed: boolean }> {
  const { templateId } = templateSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wishlist_entries")
    .delete()
    .eq("owner_user_id", identity.user.id)
    .eq("template_id", templateId)
    .select("id");
  if (error) throw new Error("wishlist_remove_failed");
  return { removed: (data ?? []).length > 0 };
}

export async function listMyWishlist(input?: unknown): Promise<WishlistEntryDTO[]> {
  const page = pageSchema.parse(input ?? {});
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wishlist_entries")
    .select("id,owner_user_id,template_id,created_at,updated_at")
    .eq("owner_user_id", identity.user.id)
    .order("created_at", { ascending: false })
    .range(page.offset, page.offset + page.limit - 1);
  if (error) throw new Error("wishlist_read_failed");
  return hydrateWishlist(data ?? [], supabase);
}

export async function isOnMyWishlist(input: unknown): Promise<boolean> {
  const { templateId } = templateSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("wishlist_entries")
    .select("id")
    .eq("owner_user_id", identity.user.id)
    .eq("template_id", templateId)
    .maybeSingle();
  if (error) throw new Error("wishlist_read_failed");
  return Boolean(data);
}

async function hydrateWishlist(rows: Array<Record<string, unknown>>, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<WishlistEntryDTO[]> {
  const templateIds = [...new Set(rows.map((row) => row.template_id).filter((id): id is string => typeof id === "string"))];
  if (templateIds.length === 0) return [];
  const { data: templates, error } = await supabase
    .from("collectible_templates")
    .select("id,group_id,member_id,release_id,kind,name,descriptor,status,created_at")
    .in("id", templateIds);
  if (error) throw new Error("wishlist_read_failed");
  const groupIds = [...new Set((templates ?? []).map((row) => row.group_id))];
  const memberIds = [...new Set((templates ?? []).map((row) => row.member_id).filter((id): id is string => typeof id === "string"))];
  const releaseIds = [...new Set((templates ?? []).map((row) => row.release_id).filter((id): id is string => typeof id === "string"))];
  const [groups, members, releases] = await Promise.all([
    groupIds.length ? supabase.from("catalog_groups").select("id,name").in("id", groupIds) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? supabase.from("catalog_members").select("id,stage_name").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
    releaseIds.length ? supabase.from("catalog_releases").select("id,title").in("id", releaseIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (groups.error || members.error || releases.error) throw new Error("wishlist_read_failed");
  const groupMap = new Map((groups.data ?? []).map((row) => [row.id, row.name]));
  const memberMap = new Map((members.data ?? []).map((row) => [row.id, row.stage_name]));
  const releaseMap = new Map((releases.data ?? []).map((row) => [row.id, row.title]));
  const templateMap = new Map((templates ?? []).map((row) => [row.id, row]));
  return rows.flatMap((row) => {
    const template = templateMap.get(String(row.template_id));
    if (!template) return [];
    const mapped: CatalogTemplateDTO = {
      id: String(template.id), groupId: String(template.group_id),
      memberId: typeof template.member_id === "string" ? template.member_id : null,
      releaseId: typeof template.release_id === "string" ? template.release_id : null,
      kind: template.kind as CatalogTemplateDTO["kind"], name: String(template.name),
      descriptor: String(template.descriptor ?? ""), status: template.status as CatalogTemplateDTO["status"],
      groupName: groupMap.get(String(template.group_id)) ?? "",
      memberName: typeof template.member_id === "string" ? memberMap.get(template.member_id) ?? null : null,
      releaseName: typeof template.release_id === "string" ? releaseMap.get(template.release_id) ?? null : null,
      createdAt: String(template.created_at),
    };
    return [{ id: String(row.id), ownerUserId: String(row.owner_user_id), templateId: String(row.template_id), createdAt: String(row.created_at), updatedAt: String(row.updated_at), template: mapped }];
  });
}
