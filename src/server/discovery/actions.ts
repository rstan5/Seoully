"use server";

import { discoverCollectors, discoverRooms, discoverCollectibles } from "@/server/discovery/service";

export async function discoveryQuery(surface: string, input: unknown = {}) {
  try {
    const result = surface === "collectors" ? await discoverCollectors(input)
      : surface === "rooms" ? await discoverRooms(input)
      : surface === "collectibles" ? await discoverCollectibles(input)
      : (() => { throw new Error("unknown_discovery_surface"); })();
    return { ok: true as const, result };
  } catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "discovery_failed" }; }
}
