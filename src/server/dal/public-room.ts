import "server-only";

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
  room: { id: string; placements: PublicRoomPlacement[] } | null;
  private: boolean;
  viewerUserId?: string;
}

export async function getPublicRoomByHandle(input: unknown): Promise<PublicRoomDTO | null> {
  const handle = handleSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const viewer = await getCurrentIdentity().catch(() => null);
  const { data, error } = await supabase.rpc("get_public_room_by_handle", { p_handle: handle });
  if (error) throw new Error("public_room_read_failed");
  if (!data || typeof data !== "object") return null;
  const raw = data as Record<string, unknown>;
  const owner = raw.owner as Record<string, unknown> | null;
  if (!owner || typeof owner.userId !== "string" || typeof owner.handle !== "string") return null;
  const privateRoom = raw.private === true;
  const roomRaw = raw.room as Record<string, unknown> | null;
  if (privateRoom || !roomRaw) return {
    owner: { userId: owner.userId, handle: owner.handle, displayName: String(owner.displayName ?? owner.handle) },
    room: null,
    private: true,
    ...(viewer ? { viewerUserId: viewer.user.id } : {}),
  };
  const rows = Array.isArray(roomRaw.placements) ? roomRaw.placements : [];
  const placements: PublicRoomPlacement[] = [];
  for (const value of rows.slice(0, 500)) {
    const row = value as Record<string, unknown>;
    const holding = row.holding as Record<string, unknown> | null;
    const template = holding?.template as Record<string, unknown> | null;
    if (!holding || !template || typeof row.id !== "string" || typeof holding.templateId !== "string") continue;
    const mediaPath = typeof holding.mediaPath === "string" ? holding.mediaPath : null;
    const mediaBucket = typeof holding.mediaBucket === "string" ? holding.mediaBucket : null;
    let personalMediaUrl: string | undefined;
    if (mediaPath && mediaBucket) {
      const signed = await supabase.storage.from(mediaBucket).createSignedUrl(mediaPath, 300);
      if (signed.data?.signedUrl) personalMediaUrl = signed.data.signedUrl;
    }
    placements.push({
      id: row.id,
      zoneId: String(row.zoneId ?? ""),
      slot: Number(row.slot ?? 0),
      offset: isRecord(row.offset) ? row.offset as Record<string, number> : null,
      transform: isRecord(row.transform) ? row.transform as Record<string, number> : null,
      surfaceId: typeof row.surfaceId === "string" ? row.surfaceId : null,
      holding: {
        templateId: holding.templateId,
        tradeStatus: String(holding.tradeStatus ?? "not-for-trade"),
        template,
        ...(personalMediaUrl ? { personalMediaUrl } : {}),
      },
    });
  }
  return {
    owner: { userId: owner.userId, handle: owner.handle, displayName: String(owner.displayName ?? owner.handle) },
    room: { id: String(roomRaw.id), placements },
    private: false,
    ...(viewer ? { viewerUserId: viewer.user.id } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
