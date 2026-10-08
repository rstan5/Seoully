import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FirstHomeState } from "@/domain/first-home";

/** Reads only; never lazily creates a Room or infers success from UI hints. */
export async function readFirstHome(client: SupabaseClient, userId: string, identityReady: boolean): Promise<FirstHomeState> {
  const [owned, room] = await Promise.all([
    client.from("holdings").select("id,collectible_templates!inner(status)")
      .eq("owner_user_id", userId).neq("collectible_templates.status", "restricted")
      .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(1).maybeSingle(),
    client.from("rooms").select("id").eq("owner_user_id", userId).maybeSingle(),
  ]);
  if (owned.error || room.error) throw new Error("first_home_unavailable");
  const state: FirstHomeState = { identityReady, holdingId: owned.data?.id ?? null, roomId: room.data?.id ?? null, placedHoldingId: null };
  if (!state.holdingId || !state.roomId) return state;
  const { data, error } = await client.from("room_placements")
    .select("holding_id,surface_id,transform")
    .eq("room_id", state.roomId).eq("holding_id", state.holdingId).maybeSingle();
  if (error) throw new Error("first_home_unavailable");
  // Existing native placement rules establish compatible surface/geometry at
  // release. Require its committed, room-scoped placement record, not Binder
  // eligibility or an optimistic object with a pending ID.
  const transform = data?.transform as Record<string, unknown> | null;
  if (data?.surface_id?.startsWith(`${state.roomId}-`) && transform &&
      ["x", "y", "z"].every(key => typeof transform[key] === "number" && Number.isFinite(transform[key]) && Math.abs(transform[key] as number) <= 5000)) {
    state.placedHoldingId = data.holding_id;
  }
  return state;
}
