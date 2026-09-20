import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

const pageSchema = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(100_000).default(0),
}).strict();

const templateIdSchema = z.object({ templateId: z.string().uuid() }).strict();
const holdingIdSchema = z.object({ holdingId: z.string().uuid() }).strict();
const tradeStateSchema = z.object({
  holdingId: z.string().uuid(),
  tradeStatus: z.enum(["not-for-trade", "for-trade"]),
}).strict();

export interface HoldingDTO {
  id: string;
  ownerUserId: string;
  templateId: string;
  acquiredAt: string;
  tradeStatus: "not-for-trade" | "for-trade";
  createdAt: string;
  updatedAt: string;
  personalMediaUrl?: string;
  template: {
    id: string;
    name: string;
    kind: string;
    descriptor: string;
    status: string;
    groupId: string;
    groupName: string;
    memberId: string | null;
    memberName: string | null;
    releaseId: string | null;
    releaseName: string | null;
  };
}

export async function createMyHolding(input: unknown): Promise<HoldingDTO> {
  const { templateId } = templateIdSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data: template, error: templateError } = await supabase
    .from("collectible_templates")
    .select("id,status")
    .eq("id", templateId)
    .neq("status", "restricted")
    .maybeSingle();
  if (templateError) throw new Error("holding_unavailable");
  if (!template) throw new Error("template_not_found");
  const { data: holding, error } = await supabase
    .from("holdings")
    .insert({ owner_user_id: identity.user.id, template_id: template.id })
    .select("id,owner_user_id,template_id,acquired_at,created_at,updated_at,trade_status")
    .single();
  if (error || !holding) throw new Error("holding_create_failed");
  const [result] = await hydrateHoldings([holding], supabase);
  if (!result) throw new Error("holding_create_failed");
  return result;
}

export async function listMyHoldings(input?: unknown): Promise<HoldingDTO[]> {
  const page = pageSchema.parse(input ?? {});
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("holdings")
    .select("id,owner_user_id,template_id,acquired_at,created_at,updated_at,trade_status")
    .eq("owner_user_id", identity.user.id)
    .order("created_at", { ascending: false })
    .range(page.offset, page.offset + page.limit - 1);
  if (error) throw new Error("holding_read_failed");
  return hydrateHoldings(data ?? [], supabase);
}

export async function getMyHolding(input: unknown): Promise<HoldingDTO | null> {
  const { holdingId } = holdingIdSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("holdings")
    .select("id,owner_user_id,template_id,acquired_at,created_at,updated_at,trade_status")
    .eq("id", holdingId)
    .eq("owner_user_id", identity.user.id)
    .maybeSingle();
  if (error) throw new Error("holding_read_failed");
  if (!data) return null;
  const [result] = await hydrateHoldings([data], supabase);
  return result ?? null;
}

export async function setMyHoldingTradeStatus(input: unknown): Promise<HoldingDTO> {
  const { holdingId, tradeStatus } = tradeStateSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data: holding, error } = await supabase
    .from("holdings")
    .update({ trade_status: tradeStatus })
    .eq("id", holdingId)
    .eq("owner_user_id", identity.user.id)
    .select("id,owner_user_id,template_id,acquired_at,created_at,updated_at,trade_status")
    .maybeSingle();
  if (error) throw new Error("holding_trade_update_failed");
  if (!holding) throw new Error("holding_not_found");
  const [result] = await hydrateHoldings([holding], supabase);
  if (!result) throw new Error("holding_trade_update_failed");
  return result;
}

export async function removeMyHolding(input: unknown): Promise<{ removed: boolean }> {
  const { holdingId } = holdingIdSchema.parse(input);
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("holdings")
    .delete()
    .eq("id", holdingId)
    .eq("owner_user_id", identity.user.id)
    .select("id");
  if (error) throw new Error("holding_delete_failed");
  return { removed: (data ?? []).length > 0 };
}

async function hydrateHoldings(rows: Array<Record<string, unknown>>, supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>): Promise<HoldingDTO[]> {
  const templateIds = [...new Set(rows.map((row) => row.template_id).filter((id): id is string => typeof id === "string"))];
  if (templateIds.length === 0) return [];
  const { data: templates, error } = await supabase
    .from("collectible_templates")
    .select("id,group_id,member_id,release_id,kind,name,descriptor,status")
    .in("id", templateIds);
  if (error) throw new Error("holding_read_failed");
  const groupIds = [...new Set((templates ?? []).map((row) => row.group_id))];
  const memberIds = [...new Set((templates ?? []).map((row) => row.member_id).filter((id): id is string => typeof id === "string"))];
  const releaseIds = [...new Set((templates ?? []).map((row) => row.release_id).filter((id): id is string => typeof id === "string"))];
  const [groups, members, releases] = await Promise.all([
    groupIds.length ? supabase.from("catalog_groups").select("id,name").in("id", groupIds) : Promise.resolve({ data: [], error: null }),
    memberIds.length ? supabase.from("catalog_members").select("id,stage_name").in("id", memberIds) : Promise.resolve({ data: [], error: null }),
    releaseIds.length ? supabase.from("catalog_releases").select("id,title").in("id", releaseIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (groups.error || members.error || releases.error) throw new Error("holding_read_failed");
  const groupMap = new Map((groups.data ?? []).map((row) => [row.id, row.name]));
  const memberMap = new Map((members.data ?? []).map((row) => [row.id, row.stage_name]));
  const releaseMap = new Map((releases.data ?? []).map((row) => [row.id, row.title]));
  const templateMap = new Map((templates ?? []).map((row) => [row.id, row]));
  const holdingIds = rows.map((row) => String(row.id));
  const { data: mediaRows } = holdingIds.length
    ? await supabase.from("media_assets").select("holding_id,storage_bucket,storage_path").in("holding_id", holdingIds)
    : { data: [] as Array<Record<string, unknown>> };
  const mediaUrls = new Map<string, string>();
  await Promise.all((mediaRows ?? []).map(async (media) => {
    const signed = await supabase.storage.from(String(media.storage_bucket)).createSignedUrl(String(media.storage_path), 3600);
    if (signed.data?.signedUrl) mediaUrls.set(String(media.holding_id), signed.data.signedUrl);
  }));
  return rows.flatMap((row) => {
    const template = templateMap.get(String(row.template_id));
    if (!template) return [];
    return [{
      id: String(row.id), ownerUserId: String(row.owner_user_id), templateId: String(row.template_id),
      acquiredAt: String(row.acquired_at), createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      ...(mediaUrls.get(String(row.id)) ? { personalMediaUrl: mediaUrls.get(String(row.id)) } : {}),
      tradeStatus: row.trade_status === "for-trade" ? "for-trade" : "not-for-trade",
      template: {
        id: String(template.id), name: String(template.name), kind: String(template.kind), descriptor: String(template.descriptor ?? ""), status: String(template.status),
        groupId: String(template.group_id), groupName: groupMap.get(String(template.group_id)) ?? "",
        memberId: typeof template.member_id === "string" ? template.member_id : null,
        memberName: typeof template.member_id === "string" ? memberMap.get(template.member_id) ?? null : null,
        releaseId: typeof template.release_id === "string" ? template.release_id : null,
        releaseName: typeof template.release_id === "string" ? releaseMap.get(template.release_id) ?? null : null,
      },
    }];
  });
}
