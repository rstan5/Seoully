import "server-only";
import { reportOperationFailure } from "./safe-diagnostic";
import { ROOM_OBJECT_KINDS, ROOM_YAWS, validRoomObjectRelationships, validPhotoStringConfig } from "@/domain/room-object-schema";

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentIdentity, getCurrentIdentityFromClient } from "@/server/dal/profile";
import { nativeRoomStyleFromRow, nativeRoomThemeFromRow, ROOM_OWNER_SELECT, ROOM_OWNER_SELECT_STYLE, STARTER_ROOM_LAYOUT, type NativeRoomStyle } from "@/server/dal/room-schema";
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
const roomThemeSchema = z.object({
  roomId: uuid,
  themeId: z.enum(["hearth", "blossom", "midnight"]),
}).strict();
const roomStyleSchema = z.object({
  roomId: uuid,
  style: z.object({
    wall: z.enum(["plum", "cream", "ink", "blush", "sage"]),
    floor: z.enum(["walnut", "oak", "charcoal", "blush-wood"]),
    furniture: z.enum(["walnut", "oak", "ink", "blush"]),
    rug: z.enum(["rose", "cream", "ink", "sage"]),
    light: z.enum(["warm", "day", "soft", "night"]),
    brightness: z.enum(["dim", "normal", "bright"]),
    binder: z.enum(["cream", "blush", "lavender", "sage", "sky", "cocoa", "charcoal"]).optional(),
  }).strict(),
}).strict();

const roomObjectKind = z.enum(ROOM_OBJECT_KINDS);
const roomLayoutSchema = z.object({
  roomId: uuid,
  layout: z.object({
    version: z.literal(1),
    firstRoomEditCompleted: z.boolean(),
    objects: z.array(z.object({
      id: z.string().trim().min(1).max(80),
      kind: roomObjectKind,
      x: coordinate(-20, 20),
      y: coordinate(-20, 20),
      z: coordinate(-20, 20),
      rotateY: z.number().refine((value) => (ROOM_YAWS as readonly number[]).includes(value), "room_yaw_invalid"),
      parent: z.object({ objectId: z.string().min(1).max(80), surfaceId: z.string().min(1).max(80) }).strict().optional(),
      binderDesk: z.literal(true).optional(),
      photoString: z.object({ slots: z.array(uuid.transform((id) => id.toLowerCase()).nullable()).length(5) }).strict().optional(),
    }).strict().refine((obj) => !obj.photoString || (obj.kind === "photo-string" && validPhotoStringConfig(obj.photoString)), "photo_string_invalid")).refine((objects) => new Set(objects.map((object) => object.id)).size === objects.length, "room_object_id_duplicate").refine(validRoomObjectRelationships, "room_object_parent_invalid"),
  }).strict(),
}).strict();

export interface RoomDTO {
  id: string;
  ownerUserId: string;
  themeId: "hearth" | "blossom" | "midnight";
  style: NativeRoomStyle;
  layout: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
export interface RoomPlacementDTO {
  id: string; roomId: string; holdingId: string; zoneId: string; slot: number;
  offset: Record<string, number> | null;
  transform: Record<string, number> | null;
  surfaceId: string | null; createdAt: string; updatedAt: string;
}

const ROOM_OWNER_SELECT_FALLBACK = "id,owner_user_id,created_at,updated_at" as const;

async function selectOwnerRoom(supabase: SupabaseClient, ownerUserId: string) {
  const laidOut = await supabase.from("rooms").select(ROOM_OWNER_SELECT).eq("owner_user_id", ownerUserId).maybeSingle();
  if (!laidOut.error) return laidOut;
  const styled = await supabase.from("rooms").select(ROOM_OWNER_SELECT_STYLE).eq("owner_user_id", ownerUserId).maybeSingle();
  if (!styled.error) return styled;
  return supabase.from("rooms").select(ROOM_OWNER_SELECT_FALLBACK).eq("owner_user_id", ownerUserId).maybeSingle();
}

export async function ensureMyRoom(client?: SupabaseClient): Promise<RoomDTO> {
  const identity = client ? await getCurrentIdentityFromClient(client) : await getCurrentIdentity();
  if (!identity) throw new Error("unauthenticated");
  const supabase = client ?? await createSupabaseServerClient();
  const { data: existing, error: readError } = await selectOwnerRoom(supabase, identity.user.id);
  if (readError) throw new Error("room_read_failed");
  if (existing) return mapRoom(existing);
  const inserted = await supabase.from("rooms").insert({ owner_user_id: identity.user.id, layout: STARTER_ROOM_LAYOUT });
  if (inserted.error && inserted.error.code !== "23505" && isMissingLayoutColumn(inserted.error)) {
    const fallback = await supabase.from("rooms").insert({ owner_user_id: identity.user.id });
    if (fallback.error && fallback.error.code !== "23505") throw new Error("room_create_failed");
  } else if (inserted.error && inserted.error.code !== "23505") {
    throw new Error("room_create_failed");
  }
  const created = await selectOwnerRoom(supabase, identity.user.id);
  if (created.error || !created.data) throw new Error("room_create_failed");
  return mapRoom(created.data);
}

export async function getMyRoom(client?: SupabaseClient): Promise<RoomDTO> { return ensureMyRoom(client); }

export async function updateMyRoomTheme(input: unknown, client?: SupabaseClient): Promise<RoomDTO> {
  const payload = roomThemeSchema.parse(input);
  const room = await ensureMyRoom(client);
  if (room.id !== payload.roomId) throw new Error("room_not_found");
  void client;
  throw new Error("room_theme_unavailable");
}

export async function updateMyRoomStyle(input: unknown, client?: SupabaseClient): Promise<RoomDTO> {
  const payload = roomStyleSchema.parse(input);
  const room = await ensureMyRoom(client);
  if (room.id !== payload.roomId) throw new Error("room_not_found");
  const supabase = client ?? await createSupabaseServerClient();
  const updated = await supabase.from("rooms")
    .update({ style: payload.style })
    .eq("id", room.id)
    .eq("owner_user_id", room.ownerUserId)
    .select(ROOM_OWNER_SELECT)
    .single();
  const data = !updated.error ? updated.data : (await supabase.from("rooms")
    .update({ style: payload.style })
    .eq("id", room.id)
    .eq("owner_user_id", room.ownerUserId)
    .select(ROOM_OWNER_SELECT_STYLE)
    .single()).data;
  const error = updated.error && !data ? updated.error : null;
  if (error || !data) throw new Error(error?.code === "42501" ? "room_style_forbidden" : "room_style_write_failed");
  return mapRoom(data);
}

export async function updateMyRoomLayout(input: unknown, client?: SupabaseClient): Promise<RoomDTO> {
  const payload = roomLayoutSchema.parse(input);
  const room = await ensureMyRoom(client);
  if (room.id !== payload.roomId) throw new Error("room_not_found");
  const supabase = client ?? await createSupabaseServerClient();
  const attachmentIds = payload.layout.objects.flatMap((obj) => obj.photoString?.slots.filter((id): id is string => id !== null) ?? []);
  if (attachmentIds.length) {
    const { data: eligible, error: readError } = await supabase.from("holdings")
      .select("id,collectible_templates!inner(kind,status)")
      .eq("owner_user_id", room.ownerUserId).in("id", [...new Set(attachmentIds)])
      .eq("collectible_templates.kind", "photocard").neq("collectible_templates.status", "restricted");
    if (readError || new Set((eligible ?? []).map((row) => row.id)).size !== new Set(attachmentIds).size) {
      throw new Error("photo_string_holding_ineligible");
    }
  }
  const { data, error } = await supabase.from("rooms")
    .update({ layout: payload.layout })
    .eq("id", room.id)
    .eq("owner_user_id", room.ownerUserId)
    .select(ROOM_OWNER_SELECT)
    .single();
  if (error || !data) {
    if (isMissingLayoutColumn(error) || error?.code === "23514") throw new Error("room_layout_unavailable");
    throw new Error(error?.code === "42501" ? "room_layout_forbidden" : "room_layout_write_failed");
  }
  return mapRoom(data);
}

export async function listMyRoomPlacements(input: unknown, client?: SupabaseClient): Promise<{ room: RoomDTO; placements: RoomPlacementDTO[] }> {
  const { roomId } = roomSchema.parse(input);
  const room = await ensureMyRoom(client);
  if (room.id !== roomId) throw new Error("room_not_found");
  const supabase = client ?? await createSupabaseServerClient();
  const { data, error } = await supabase.from("room_placements")
    .select("id,room_id,holding_id,zone_id,slot,spatial_offset,transform,surface_id,created_at,updated_at")
    .eq("room_id", room.id).order("updated_at", { ascending: false }).range(0, 499);
  if (error) throw new Error("room_placement_read_failed");
  return { room, placements: (data ?? []).map(mapPlacement) };
}

export async function upsertMyRoomPlacement(input: unknown, client?: SupabaseClient, options: { nativeDestinations?: boolean } = {}): Promise<RoomPlacementDTO> {
  const parsed = placementSchema.safeParse(input);
  if (!parsed.success) {
    reportOperationFailure("room_placement_validate", parsed.error);
    throw new Error("room_placement_invalid");
  }
  const payload = parsed.data;
  const room = await ensureMyRoom(client);
  if (room.id !== payload.roomId) throw new Error("room_not_found");
  const supabase = client ?? await createSupabaseServerClient();
  if (options.nativeDestinations) {
    const holding = await supabase.from("holdings").select("id,collectible_templates!inner(kind)")
      .eq("id", payload.holdingId).eq("owner_user_id", room.ownerUserId).maybeSingle();
    if (holding.error || !holding.data) throw new Error("room_placement_forbidden");
    const template = holding.data.collectible_templates;
    if ((Array.isArray(template) ? template[0] : template)?.kind === "photocard") throw new Error("photocard_binder_only");
  }
  const { data, error } = await supabase.from("room_placements").upsert({
    room_id: payload.roomId, holding_id: payload.holdingId, zone_id: payload.zoneId,
    slot: payload.slot, spatial_offset: payload.offset ?? null, transform: payload.transform ?? null,
    surface_id: payload.surfaceId ?? null,
  }, { onConflict: "holding_id" }).select("id,room_id,holding_id,zone_id,slot,spatial_offset,transform,surface_id,created_at,updated_at").single();
  if (error || !data) {
    reportOperationFailure("room_placement_write", error);
    throw new Error(error?.code === "42501" ? "room_placement_forbidden" : "room_placement_write_failed");
  }
  return mapPlacement(data);
}

export async function removeMyRoomPlacement(input: unknown, client?: SupabaseClient): Promise<{ removed: boolean }> {
  const { roomId, holdingId } = z.object({ roomId: uuid, holdingId: uuid }).strict().parse(input);
  const room = await ensureMyRoom(client);
  if (room.id !== roomId) throw new Error("room_not_found");
  const supabase = client ?? await createSupabaseServerClient();
  const { data, error } = await supabase.from("room_placements").delete()
    .eq("room_id", roomId).eq("holding_id", holdingId).select("id");
  if (error) throw new Error("room_placement_delete_failed");
  return { removed: (data ?? []).length > 0 };
}

function mapRoom(row: Record<string, unknown>): RoomDTO {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    themeId: nativeRoomThemeFromRow(row),
    style: nativeRoomStyleFromRow(row),
    layout: isObject(row.layout) ? row.layout : {},
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
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
function isMissingLayoutColumn(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "42703" || /column .*layout/i.test(message);
}
