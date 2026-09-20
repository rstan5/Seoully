"use server";

import { createSharedCatalogContribution } from "@/server/dal/catalog";

export async function contributeCatalogItem(input: unknown) {
  try {
    return { ok: true as const, contribution: await createSharedCatalogContribution(input) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "catalog_contribution_failed";
    return { ok: false as const, reason };
  }
}
