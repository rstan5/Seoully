"use server";

import { getCollectionBreakdown, getCollectionOverlap, getKnownCoverage, getMyCollection, getMyWishlist, getReciprocalRelationships, findCollectorsWantingMyItems, findOwnersOfMyWishlist, findOwnersOfTemplate, findWantersOfTemplate } from "@/server/dal/collection-graph";

export async function collectionGraphQuery(operation: string, input: unknown = {}) {
  try {
    const result = operation === "my-collection" ? await getMyCollection(input)
      : operation === "my-wishlist" ? await getMyWishlist(input)
      : operation === "owners" ? await findOwnersOfTemplate(input)
      : operation === "wanters" ? await findWantersOfTemplate(input)
      : operation === "owners-of-my-wishlist" ? await findOwnersOfMyWishlist(input)
      : operation === "wanting-my-items" ? await findCollectorsWantingMyItems(input)
      : operation === "reciprocal" ? await getReciprocalRelationships(input)
      : operation === "overlap" ? await getCollectionOverlap(input)
      : operation === "breakdown" ? await getCollectionBreakdown(input)
      : operation === "coverage" ? await getKnownCoverage(input)
      : (() => { throw new Error("unknown_graph_operation"); })();
    return { ok: true as const, result };
  } catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "graph_query_failed" }; }
}
