"use server";

import { ensureMyRoom, getMyRoom, listMyRoomPlacements, removeMyRoomPlacement, upsertMyRoomPlacement } from "@/server/dal/rooms";

export async function ensureRoom() { try { return { ok: true as const, room: await ensureMyRoom() }; } catch (e) { return { ok: false as const, reason: e instanceof Error ? e.message : "room_create_failed" }; } }
export async function getRoom() { try { return { ok: true as const, room: await getMyRoom() }; } catch (e) { return { ok: false as const, reason: e instanceof Error ? e.message : "room_read_failed" }; } }
export async function listRoomPlacements(input: unknown) { try { return { ok: true as const, ...(await listMyRoomPlacements(input)) }; } catch (e) { return { ok: false as const, reason: e instanceof Error ? e.message : "room_placement_read_failed" }; } }
export async function upsertRoomPlacement(input: unknown) { try { return { ok: true as const, placement: await upsertMyRoomPlacement(input) }; } catch (e) { return { ok: false as const, reason: e instanceof Error ? e.message : "room_placement_write_failed" }; } }
export async function removeRoomPlacement(input: unknown) { try { return { ok: true as const, result: await removeMyRoomPlacement(input) }; } catch (e) { return { ok: false as const, reason: e instanceof Error ? e.message : "room_placement_delete_failed" }; } }
