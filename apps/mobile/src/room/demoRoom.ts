import {
  GROUP_BY_ID,
  MEMBER_BY_ID,
  RELEASE_BY_ID,
  TEMPLATE_BY_ID,
} from "seoully-domain/fixtures/catalog";
import {
  HOLDINGS_FIXTURE,
  PLACEMENTS_FIXTURE,
  ROOMS,
  SOO,
  USERS,
} from "seoully-domain/fixtures/collectors";
import type { CollectibleTemplate, Placement } from "seoully-domain/types";
import type { NativeCatalogTemplate, NativeHolding, NativeRoomPlacement, NativeRoomSnapshot, NativeRoomStyle } from "../api";
import { parseRoomLayout, serializeRoomLayout, type RoomLayoutState } from "./roomObjects";
import { defaultStyleForTheme, parseRoomStyle } from "./roomStyle";
import { demoAssetUri } from "../data/demo/assets";
import { createInitialRoomRenderable, nativeHomeForHolding, toPersistedTransform, zoneIdForNativeSurface } from "./model";

const session = new Map<string, NativeRoomPlacement[]>();
const styleSession = new Map<string, NativeRoomStyle>();
const layoutSession = new Map<string, RoomLayoutState>();

function nativeTemplate(template: CollectibleTemplate): NativeCatalogTemplate {
  return {
    id: template.id,
    groupId: template.groupId,
    memberId: template.memberId ?? null,
    releaseId: template.releaseId ?? null,
    kind: template.kind,
    name: template.name,
    descriptor: "",
    status: "published",
    groupName: GROUP_BY_ID.get(template.groupId)?.name ?? "",
    memberName: template.memberId ? MEMBER_BY_ID.get(template.memberId)?.stageName ?? null : null,
    releaseName: template.releaseId ? RELEASE_BY_ID.get(template.releaseId)?.title ?? null : null,
    colorway: template.colorway,
  };
}

function nativeHoldingsFor(ownerId: string): NativeHolding[] {
  return HOLDINGS_FIXTURE.filter((holding) => String(holding.ownerId) === ownerId).flatMap((holding) => {
    const template = TEMPLATE_BY_ID.get(holding.templateId);
    if (!template) return [];
    return [{
      id: holding.id,
      templateId: holding.templateId,
      acquiredAt: holding.acquisition.acquiredAt,
      tradeStatus: holding.tradeStatus === "not-for-trade" ? "not-for-trade" : "for-trade",
      ...(holding.personalMediaUrl ? { personalMediaUrl: demoAssetUri(holding.personalMediaUrl) } : {}),
      template: nativeTemplate(template),
    }];
  });
}

function fixturePlacements(ownerId: string, roomId: string, holdings: NativeHolding[]): NativeRoomPlacement[] {
  const existing = session.get(ownerId);
  if (existing) return existing.map((placement) => ({ ...placement }));
  const byId = new Map(holdings.map((holding) => [holding.id, holding]));
  const source = PLACEMENTS_FIXTURE.get(roomId) ?? [];
  const mapped: NativeRoomPlacement[] = [];
  source.forEach((placement: Placement, index) => {
    const holding = byId.get(placement.holdingId);
    if (!holding) return;
    if (holding.template.kind === "photocard") return;
    const home = nativeHomeForHolding(holding, roomId, placement.slot ?? index);
    const initial = createInitialRoomRenderable(holding, placement.slot ?? index, roomId);
    mapped.push({
      id: `demo-place-${holding.id}`,
      roomId,
      holdingId: holding.id,
      zoneId: home.zoneId,
      slot: placement.slot ?? index,
      offset: null,
      transform: toPersistedTransform({ ...initial, position: home.position }),
      surfaceId: home.surfaceId,
    });
  });
  session.set(ownerId, mapped);
  return mapped.map((placement) => ({ ...placement }));
}

export function buildFixtureRoomSnapshot(ownerId: string = String(SOO)): NativeRoomSnapshot {
  const room = ROOMS.find((item) => String(item.ownerId) === ownerId);
  const roomId = room?.id ?? `room-${ownerId}`;
  const holdings = nativeHoldingsFor(ownerId);
  return {
    room: {
      id: roomId,
      ownerUserId: ownerId,
      themeId: ownerId === String(SOO) ? "hearth" : "blossom",
      style: styleSession.get(ownerId) ?? defaultStyleForTheme(ownerId === String(SOO) ? "hearth" : "blossom"),
      layout: serializeRoomLayout(demoRoomLayout(ownerId)),
    },
    holdings,
    placements: fixturePlacements(ownerId, roomId, holdings),
  };
}

export function saveDemoPlacement(input: {
  roomId: string;
  holdingId: string;
  zoneId: string;
  slot: number;
  transform: { x: number; y: number; z: number; rotateX?: number; rotateY?: number; rotateZ?: number; scale?: number };
  surfaceId?: string;
}): NativeRoomPlacement {
  const room = ROOMS.find((item) => item.id === input.roomId);
  const ownerKey = String(room?.ownerId ?? SOO);
  const current = session.get(ownerKey) ?? [];
  const next: NativeRoomPlacement = {
    id: `demo-place-${input.holdingId}`,
    roomId: input.roomId,
    holdingId: input.holdingId,
    zoneId: input.zoneId || zoneIdForNativeSurface(input.roomId, input.surfaceId ?? `${input.roomId}-desk`),
    slot: input.slot,
    offset: null,
    transform: input.transform,
    surfaceId: input.surfaceId ?? null,
  };
  session.set(ownerKey, [...current.filter((item) => item.holdingId !== input.holdingId), next]);
  return next;
}

export function removeDemoPlacement(roomId: string, holdingId: string) {
  const room = ROOMS.find((item) => item.id === roomId);
  const ownerKey = String(room?.ownerId ?? SOO);
  const current = session.get(ownerKey) ?? [];
  session.set(ownerKey, current.filter((item) => item.holdingId !== holdingId));
}

export function saveDemoRoomStyle(ownerId: string, style: NativeRoomStyle) {
  const next = parseRoomStyle(style);
  styleSession.set(ownerId, next);
  return next;
}

export function demoRoomLayout(ownerId: string): RoomLayoutState {
  return layoutSession.get(ownerId) ?? parseRoomLayout({});
}

export function saveDemoRoomLayout(ownerId: string, layout: RoomLayoutState) {
  const next = {
    source: "authored" as const,
    objects: layout.objects.map((item) => ({ ...item })),
    firstRoomEditCompleted: layout.firstRoomEditCompleted,
  };
  layoutSession.set(ownerId, next);
  return next;
}

export function resetDemoRoomSession() {
  session.clear();
  styleSession.clear();
  layoutSession.clear();
}

export function demoRoomOwnerId() {
  return SOO;
}

export function demoCollectorDisplayName(ownerId: string) {
  return USERS.find((user) => String(user.id) === ownerId)?.displayName ?? "";
}
