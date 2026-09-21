"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { repository } from "@/domain/memory-repository";
import type { CollectibleKind } from "@/domain/types";
import { Room } from "@/world/Room";
import { useWorld } from "@/world/store/worldStore";

type RoomPayload = { owner: { userId: string; handle: string; displayName: string }; viewerUserId?: string; private: boolean; room: { id: string; placements: Array<{ id: string; zoneId: string; slot: number; offset?: Record<string, number> | null; transform?: Record<string, number> | null; surfaceId?: string | null; holding: { templateId: string; template: { name: string; kind: string; groupName?: string; memberName?: string | null; releaseName?: string | null }; personalMediaUrl?: string } }> } | null };

export default function PublicRoomPage({ params }: { params: Promise<{ handle: string }> }) {
  const [handle, setHandle] = useState("");
  const [room, setRoom] = useState<RoomPayload | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { void params.then(({ handle: value }) => {
    const normalized = value.replace(/^@/, "").toLowerCase(); setHandle(normalized);
    void fetch(`/api/public/rooms/${encodeURIComponent(normalized)}`).then(async (response) => {
      if (!response.ok) { setError(true); return; }
      const payload = await response.json() as RoomPayload;
      setRoom(payload);
      const ownerView = Boolean(payload.viewerUserId && payload.viewerUserId === payload.owner.userId);
      let localRoom = ownerView ? repository.getRoomByOwner(payload.owner.userId as never) : undefined;
      if (!payload.private && payload.room) {
        if (!localRoom) localRoom = repository.adoptPublicRoomProjection({ userId: payload.owner.userId as never, handle: payload.owner.handle, displayName: payload.owner.displayName, placements: payload.room.placements.map((item) => ({ templateId: item.holding.templateId, name: item.holding.template.name, kind: item.holding.template.kind as CollectibleKind, groupName: item.holding.template.groupName ?? "", memberName: item.holding.template.memberName, releaseName: item.holding.template.releaseName, personalMediaUrl: item.holding.personalMediaUrl, zoneId: item.zoneId, slot: item.slot, offset: item.offset, transform: item.transform, surfaceId: item.surfaceId })) });
        useWorld.getState().adoptViewer((payload.viewerUserId ?? payload.owner.userId) as never, localRoom.id, { kind: "room" });
      }
      setIsOwner(ownerView && Boolean(repository.getRoomByOwner(payload.owner.userId as never) === localRoom));
    }).catch(() => setError(true));
  }); }, [params]);
  if (error) return <main className="onboard"><div className="onboard-frame"><h1>Room unavailable</h1><Link href={`/@${handle}`}>Back to profile</Link></div></main>;
  if (!room) return <main className="onboard"><div className="onboard-frame"><p>Opening Room…</p></div></main>;
  if (room.private || !room.room) return <main className="onboard"><div className="onboard-frame"><h1>Private Room</h1><p>This collector’s Room is private.</p><Link href={`/@${handle}`}>Back to profile</Link></div></main>;
  return <main><header className="public-room-header"><Link href={`/@${handle}`}>← @{room.owner.handle}</Link><button type="button" className="button" onClick={() => void share(`/@${handle}/room`)}>Share Room</button></header><Room roomId={repository.getRoomByOwner(room.owner.userId as never)?.id as never} readOnly={!isOwner} /> </main>;
}

async function share(path: string) {
  const url = `${window.location.origin}${path}`;
  if (navigator.share) { await navigator.share({ title: "Seoully Room", url }).catch(() => undefined); return; }
  await navigator.clipboard?.writeText(url);
}
