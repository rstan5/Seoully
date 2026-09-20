"use server";

import { addToMyWishlist, isOnMyWishlist, listMyWishlist, removeFromMyWishlist } from "@/server/dal/wishlist";

export async function addWishlist(input: unknown) {
  try { return { ok: true as const, entry: await addToMyWishlist(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "wishlist_add_failed" }; }
}

export async function removeWishlist(input: unknown) {
  try { return { ok: true as const, result: await removeFromMyWishlist(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "wishlist_remove_failed" }; }
}

export async function listWishlist(input?: unknown) {
  try { return { ok: true as const, entries: await listMyWishlist(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "wishlist_read_failed" }; }
}

export async function checkWishlist(input: unknown) {
  try { return { ok: true as const, wanted: await isOnMyWishlist(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "wishlist_read_failed" }; }
}
