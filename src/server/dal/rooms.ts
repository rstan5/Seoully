import "server-only";

import { z } from "zod";
import { getCurrentIdentity } from "@/server/dal/profile";
import { createSupabaseServerClient } from "@/server/supabase/server";

const uuid = z.string().uuid();
const coordinate = (min: number, max: number) => z.number().finite().min(min).max(max);
const transformSchema = z.object({
  x: coordinate(-5000, 5000), y: coordinate(-5000, 5000), z: coordinate(-5000, 5000),
  rotateX: coordinate(-360, 360).optional(), rotateY: coordinate(-360, 360).optional(),
  rotateZ: coordinate(-360, 360).optional(), scale: coordinate(0.05, 10).optional(),
}).strict();
const offsetSchema = transformSchema.partial().strict();
const placementSchema = z.object({
  roomId: uuid,
  holdingId: uuid,
  zoneId: z.string().trim().min(1).max(160),
  slot: z.number().int().min(0).max(10_000),
  offset: offsetSchema.optional().nullable(),
  transform: transformSchema.optional().nullable(),
  surfaceId: z.string().trim().max(200).optional().nullable(),
}).strict();
const roomSchema = z.object({ roomId: uuid }).strict();

export interface RoomDTO { id: string; ownerUserId: string; createdAt: string; updatedAt: string; }
export interface RoomPlacementDTO {
  id: string; roomId: string; holdingId: string; zoneId: string; slot: number;
  offset: Record<string, number> | null;
  transform: Record<string, number> | null;
  surfaceId: string | null; createdAt: string; updatedAt: string;
}

export async function ensureMyRoom(): Promise<RoomDTO> {
  const identity = await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = await createSupabaseServerClient();
  const { data: existing, error: readError } = await supabase.from("rooms")
    .select("id,owner_user_id,created_at,updated_at").eq("owner_user_id", identity.user.id).maybeSingle();
  if (readError) throw new Error("room_read_failed");
  if (existing) return mapRoom(existing);
  const { data, error } = await supabase.from("rooms")
    .insert({ owner_user_id: identity.user.id })
    .select("id,owner_user_id,created_at,updated_at").single();
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await supabase.from("rooms")
        .select("id,owner_user_id,created_at,updated_at").eq("owner_user_id", identity.user.id).maybeSingle();
      if (raced) return mapRoom(raced);
    }
    throw new Error("room_create_failed");
  }
  if (!data) throw new Error("room_create_failed");
  return mapRoom(data);
}

export async function getMyRoom(): Promise<RoomDTO> { return ensureMyRoom(); }

export async function listMyRoomPlacements(input: unknown): Promise<{ room: RoomDTO; placements: RoomPlacementDTO[] }> {
  const { roomId } = roomSchema.parse(input);
  const room = await ensureMyRoom();
  if (room.id !== roomId) throw new Error("room_not_found");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("room_placements")
    .select("id,room_id,holding_id,zone_id,slot,spatial_offset,transform,surface_id,created_at,updated_at")
    .eq("room_id", room.id).order("updated_at", { ascending: false }).range(0, 499);
  if (error) throw new Error("room_placement_read_failed");
  return { room, placements: (data ?? []).map(mapPlacement) };
}

export async function upsertMyRoomPlacement(input: unknown): Promise<RoomPlacementDTO> {
  const payload = placementSchema.parse(input);
  const room = await ensureMyRoom();
  if (room.id !== payload.roomId) throw new Error("room_not_found");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("room_placements").upsert({
    room_id: payload.roomId, holding_id: payload.holdingId, zone_id: payload.zoneId,
    slot: payload.slot, spatial_offset: payload.offset ?? null, transform: payload.transform ?? null,
    surface_id: payload.surfaceId ?? null,
  }, { onConflict: "holding_id" }).select("id,room_id,holding_id,zone_id,slot,spatial_offset,transform,surface_id,created_at,updated_at").single();
  if (error || !data) throw new Error(error?.code === "42501" ? "room_placement_forbidden" : "room_placement_write_failed");
  return mapPlacement(data);
}

export async function removeMyRoomPlacement(input: unknown): Promise<{ removed: boolean }> {
  const { roomId, holdingId } = z.object({ roomId: uuid, holdingId: uuid }).strict().parse(input);
  const room = await ensureMyRoom();
  if (room.id !== roomId) throw new Error("room_not_found");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("room_placements").delete()
    .eq("room_id", roomId).eq("holding_id", holdingId).select("id");
  if (error) throw new Error("room_placement_delete_failed");
  return { removed: (data ?? []).length > 0 };
}

function mapRoom(row: Record<string, unknown>): RoomDTO {
  return { id: String(row.id), ownerUserId: String(row.owner_user_id), createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}
function mapPlacement(row: Record<string, unknown>): RoomPlacementDTO {
  return {
    id: String(row.id), roomId: String(row.room_id), holdingId: String(row.holding_id), zoneId: String(row.zone_id),
    slot: Number(row.slot), offset: isObject(row.spatial_offset) ? row.spatial_offset as Record<string, number> : null,
    transform: isObject(row.transform) ? row.transform as Record<string, number> : null,
    surfaceId: typeof row.surface_id === "string" ? row.surface_id : null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}
function isObject(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === "object" && !Array.isArray(value)); }
