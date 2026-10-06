import "server-only";
import { signPublicRoomMedia } from "./public-room-media";
import { nativeRoomStyleFromRow } from "./room-schema";
import { listActiveCatalogReferenceImages } from "@/server/dal/catalog-reference-images";
import { publicPhotoStringVisuals, publicVisualRoomLayout, publicRoomVisualTransform, publicRoomTemplate, type PublicPhotoStringVisual } from "@/domain/public-room-layout";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { getCurrentIdentity } from "@/server/dal/profile";

const handleSchema = z.string().trim().transform((value) => value.replace(/^@/, "").toLowerCase()).pipe(z.string().regex(/^[a-z][a-z0-9_]{2,15}$/));

export interface PublicRoomPlacement {
  id: string;
  zoneId: string;
  slot: number;
  offset: Record<string, number> | null;
  transform: Record<string, number> | null;
  surfaceId: string | null;
  holding: {
    templateId: string;
    tradeStatus: string;
    template: Record<string, unknown>;
    personalMediaUrl?: string;
  };
}

export interface PublicRoomDTO {
  owner: { userId: string; handle: string; displayName: string };
  room: { id: string; style?: Record<string, unknown>; layout?: Record<string, unknown>; placements: PublicRoomPlacement[]; photoStringCards?: PublicPhotoStringVisual[] } | null;
  private: boolean;
  viewerUserId?: string;
}

export async function getPublicRoomByHandle(input: unknown, client?: SupabaseClient): Promise<PublicRoomDTO | null> {
  const handle = handleSchema.parse(input);
  const supabase = client ?? await createSupabaseServerClient();
  const viewerUserId = client
    ? (await supabase.auth.getUser()).data.user?.id
    : (await getCurrentIdentity().catch(() => null))?.user.id;
  if (!viewerUserId) throw new Error("unauthenticated");
  const { data, error } = await supabase.rpc("get_public_room_by_handle", { p_handle: handle });
  if (error) throw new Error("public_room_read_failed");
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const owner = raw.owner as Record<string, unknown> | null;
  if (!owner || typeof owner.userId !== "string" || typeof owner.handle !== "string") return null;
  const privateRoom = raw.private === true;
  const roomRaw = raw.room as Record<string, unknown> | null;
  if (privateRoom || !roomRaw || typeof roomRaw.id !== "string" || !z.string().uuid().safeParse(roomRaw.id).success) return {
    owner: { userId: owner.userId, handle: owner.handle, displayName: String(owner.displayName ?? owner.handle) },
    room: null,
    private: privateRoom,
    ...(viewerUserId ? { viewerUserId } : {}),
  };
  const rows = Array.isArray(roomRaw.placements) ? roomRaw.placements : [];
  const mediaIds = rows.slice(0, 500).flatMap((value) => {
    if (!isRecord(value) || typeof value.id !== "string" || !z.string().uuid().safeParse(value.id).success || !isRecord(value.holding)) return [];
    return value.holding.hasPersonalMedia === true ? [value.id] : [];
  });
  const signedMedia = await signPublicRoomMedia(supabase, roomRaw.id, mediaIds);
  const placements: PublicRoomPlacement[] = [];
  for (const value of rows.slice(0, 500)) {
    if (!isRecord(value)) continue;
    const row = value;
    const holding = row.holding as Record<string, unknown> | null;
    const template = holding?.template as Record<string, unknown> | null;
    if (!holding || !template || typeof row.id !== "string" || typeof holding.templateId !== "string") continue;
    const personalMediaUrl = signedMedia.get(row.id);
    placements.push({
      id: row.id,
      zoneId: String(row.zoneId ?? ""),
      slot: Number(row.slot ?? 0),
      offset: publicRoomVisualTransform(row.offset),
      transform: publicRoomVisualTransform(row.transform),
      surfaceId: typeof row.surfaceId === "string" ? row.surfaceId : null,
      holding: {
        templateId: holding.templateId,
        tradeStatus: String(holding.tradeStatus ?? "not-for-trade"),
        template: publicRoomTemplate(template),
        ...(personalMediaUrl ? { personalMediaUrl } : {}),
      },
    });
  }
  const photoStringCards = publicPhotoStringVisuals(roomRaw.photoStringCards);
  if (photoStringCards.length) {
    // Only active, explicitly community-shared catalog imagery; failure keeps the safe fallback.
    const references = await listActiveCatalogReferenceImages([...new Set(photoStringCards.map((card) => card.templateId))].slice(0, 50), supabase).catch(() => []);
    for (const card of photoStringCards) {
      const reference = references.find((image) => image.templateId === card.templateId && image.status === "active");
      if (reference) card.catalogImageUrl = reference.url;
    }
  }
  return {
    owner: { userId: owner.userId, handle: owner.handle, displayName: String(owner.displayName ?? owner.handle) },
    room: {
      id: roomRaw.id,
      placements,
      ...(isRecord(roomRaw.style) ? { style: nativeRoomStyleFromRow({ style: roomRaw.style }) } : {}),
      ...(isRecord(roomRaw.layout) ? { layout: publicVisualRoomLayout(roomRaw.layout) } : {}),
      photoStringCards,
    },
    private: false,
    ...(viewerUserId ? { viewerUserId } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
