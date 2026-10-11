import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { loadCollectorRoom, type NativeHolding } from "../api";
import { supabase } from "../supabase";
import { ownerRoomPreview, publicRoomPreview, type OwnerProfileRoom, type ProfileRoomPreview } from "./profileRoom";

/** Read only: unlike GET /mobile/room this never calls ensureMyRoom. */
export async function readOwnerProfileRoom(userId: string): Promise<OwnerProfileRoom | null> {
  const { data: room, error } = await supabase.from("rooms").select("id,style,layout").eq("owner_user_id", userId).maybeSingle();
  if (error) throw new Error("profile_room_read_failed");
  if (!room) return null;
  const { data, error: placementError } = await supabase.from("room_placements")
    .select("id,room_id,holding_id,zone_id,slot,spatial_offset,transform,surface_id")
    .eq("room_id", room.id).order("updated_at", { ascending: false }).range(0, 499);
  if (placementError) throw new Error("profile_room_read_failed");
  return { ...room, placements: (data ?? []).map(p => ({ id: p.id, roomId: p.room_id, holdingId: p.holding_id,
    zoneId: p.zone_id, slot: p.slot, offset: p.spatial_offset, transform: p.transform, surfaceId: p.surface_id })) };
}

export function useProfileRoom(userId: string | undefined, own: boolean, demo: boolean, holdings: NativeHolding[]) {
  const key = `${demo}:${own}:${userId ?? ""}`;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; owner?: OwnerProfileRoom | null; preview?: ProfileRoomPreview | null; failed?: boolean }>({ key: "" });
  useFocusEffect(useCallback(() => {
    if (!userId) return;
    void attempt; // explicit retry generation
    let active = true;
    async function read() {
      try {
        let next: typeof state;
        if (demo) {
          const { buildFixtureRoomSnapshot } = await import("./demoRoom");
          const snapshot = buildFixtureRoomSnapshot(userId, { ownStarter: own });
          next = { key, preview: ownerRoomPreview({ ...snapshot.room, placements: snapshot.placements }, snapshot.holdings) };
        } else if (own) next = { key, owner: await readOwnerProfileRoom(userId!) };
        else next = { key, preview: publicRoomPreview(userId!, await loadCollectorRoom(userId!)) };
        if (active) setState(next);
      } catch { if (active) setState({ key, failed: true }); }
    }
    void read();
    return () => { active = false; };
  }, [key, userId, own, demo, attempt]));
  const preview = useMemo(() => state.key !== key ? null : state.owner ? ownerRoomPreview(state.owner, holdings) : state.preview ?? null, [state, key, holdings]);
  return { preview, ready: !userId || state.key === key, failed: state.key === key && state.failed, retry: () => setAttempt(n => n + 1) };
}
