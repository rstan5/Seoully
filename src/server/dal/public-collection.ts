import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCollectionPairSnapshot, type PairHolding } from "@/server/dal/collection-graph-pair";
import { getCurrentIdentityFromClient } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { publicRecordOmitsPrivateMedia } from "@/server/public-collection-contract";
import type { PublicCatalogTemplate, PublicHolding, PublicWishlistEntry } from "@/server/dal/public-collection-types";

export type PublicCollectorCollection = {
  collectionPublic: boolean;
  wishlistPublic: boolean;
  holdings: PublicHolding[];
  wishlist: PublicWishlistEntry[];
};

function emptyCollection(collectionPublic: boolean, wishlistPublic: boolean): PublicCollectorCollection {
  return { collectionPublic, wishlistPublic, holdings: [], wishlist: [] };
}

async function loadTemplatesByIds(ids: string[], supabase: SupabaseClient) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, PublicCatalogTemplate>();
  const { data, error } = await supabase
    .from("collectible_templates")
    .select("id,group_id,member_id,release_id,kind,name,descriptor,status,created_at")
    .in("id", unique)
    .neq("status", "restricted");
  if (error) throw new Error("catalog_search_failed");
  const rows = data ?? [];
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
  return new Map(rows.map((row) => {
    const template: PublicCatalogTemplate = {
      id: String(row.id),
      groupId: String(row.group_id),
      memberId: typeof row.member_id === "string" ? row.member_id : null,
      releaseId: typeof row.release_id === "string" ? row.release_id : null,
      kind: String(row.kind),
      name: String(row.name),
      descriptor: String(row.descriptor ?? ""),
      status: String(row.status),
      groupName: groupMap.get(String(row.group_id)) ?? "",
      memberName: typeof row.member_id === "string" ? memberMap.get(row.member_id) ?? null : null,
      releaseName: typeof row.release_id === "string" ? releaseMap.get(row.release_id) ?? null : null,
    };
    return [template.id, template];
  }));
}

function toPublicHolding(holding: PairHolding, template: PublicCatalogTemplate | undefined): PublicHolding {
  const mapped: PublicHolding = {
    id: holding.holding_id,
    templateId: holding.template_id,
    acquiredAt: "",
    tradeStatus: holding.trade_status === "for-trade" ? "for-trade" : "not-for-trade",
    template: template ?? {
      id: holding.template_id,
      groupId: holding.group_id,
      memberId: holding.member_id,
      releaseId: holding.release_id,
      kind: holding.kind,
      name: holding.template_name,
      descriptor: "",
      status: "community",
      groupName: "",
      memberName: null,
      releaseName: null,
    },
  };
  if (!publicRecordOmitsPrivateMedia(mapped as unknown as Record<string, unknown>)) {
    throw new Error("public_holding_media_leak");
  }
  return mapped;
}

export async function getPublicCollectorCollection(targetUserId: string, client: SupabaseClient): Promise<PublicCollectorCollection> {
  const identity = await getCurrentIdentityFromClient(client);
  if (!identity) throw new Error("unauthenticated");
  if (identity.user.id === targetUserId) throw new Error("same_collector");
  const snapshot = await getCollectionPairSnapshot(targetUserId, client);
  if (!snapshot.target) throw new Error("collector_not_visible");
  const collectionPublic = snapshot.target_collection_public !== false;
  const wishlistPublic = snapshot.target_wishlist_public === true;
  if (!collectionPublic && !wishlistPublic) return emptyCollection(false, false);
  const supabase = client ?? await createSupabaseServerClient();
  const templateIds = [
    ...(collectionPublic ? snapshot.target.holdings.map((holding) => holding.template_id) : []),
    ...(wishlistPublic ? snapshot.target.wishlist_template_ids : []),
  ];
  const templates = await loadTemplatesByIds(templateIds, supabase);
  const holdings = collectionPublic
    ? snapshot.target.holdings.map((holding) => toPublicHolding(holding, templates.get(holding.template_id)))
    : [];
  const wishlist = wishlistPublic
    ? snapshot.target.wishlist_template_ids.flatMap((templateId) => {
      const template = templates.get(templateId);
      if (!template) return [];
      const entry: PublicWishlistEntry = { id: templateId, templateId, template };
      if (!publicRecordOmitsPrivateMedia(entry as unknown as Record<string, unknown>)) {
        throw new Error("public_wishlist_media_leak");
      }
      return [entry];
    })
    : [];
  return { collectionPublic, wishlistPublic, holdings, wishlist };
}

export async function getPublicCollectorHolding(targetUserId: string, holdingId: string, client: SupabaseClient): Promise<PublicHolding | null> {
  const collection = await getPublicCollectorCollection(targetUserId, client);
  if (!collection.collectionPublic) return null;
  return collection.holdings.find((holding) => holding.id === holdingId) ?? null;
}

export async function getPublicCollectorWishlistItem(targetUserId: string, templateId: string, client: SupabaseClient): Promise<PublicWishlistEntry | null> {
  const collection = await getPublicCollectorCollection(targetUserId, client);
  if (!collection.wishlistPublic) return null;
  return collection.wishlist.find((entry) => entry.templateId === templateId) ?? null;
}
