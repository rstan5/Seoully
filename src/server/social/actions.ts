"use server";

import {
  createComment as createProductionComment,
  createPost as createProductionPost,
  deletePost as deleteProductionPost,
  followUser as followProductionUser,
  getFollowState as getProductionFollowState,
  getProductionFeed,
  getProductionProfilePosts,
  searchProductionCollectibles,
  searchProductionUsers,
  likePost as likeProductionPost,
  listPostComments,
  unfollowUser as unfollowProductionUser,
  unlikePost as unlikeProductionPost,
} from "@/server/dal/social";

export async function productionFeed(input?: unknown) {
  try { return { ok: true as const, page: await getProductionFeed(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "social_read_failed" }; }
}

export async function productionProfilePosts(userId: unknown, input?: unknown) {
  try { return { ok: true as const, page: await getProductionProfilePosts(userId, input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "social_read_failed" }; }
}

export async function productionSearchUsers(query: unknown) {
  try { return { ok: true as const, users: await searchProductionUsers(query) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "social_search_failed" }; }
}

export async function productionSearchCollectibles(query: unknown) {
  try { return { ok: true as const, collectibles: await searchProductionCollectibles(query) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "social_search_failed" }; }
}

export async function productionFollow(userId: unknown) {
  try { return { ok: true as const, state: await followProductionUser(userId) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "follow_failed" }; }
}

export async function productionUnfollow(userId: unknown) {
  try { return { ok: true as const, state: await unfollowProductionUser(userId) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "unfollow_failed" }; }
}

export async function productionFollowState(userId: unknown) {
  try { return { ok: true as const, state: await getProductionFollowState(userId) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "follow_read_failed" }; }
}

export async function productionLike(postId: unknown) {
  try { return { ok: true as const, state: await likeProductionPost(postId) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "like_failed" }; }
}

export async function productionUnlike(postId: unknown) {
  try { return { ok: true as const, state: await unlikeProductionPost(postId) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "unlike_failed" }; }
}

export async function productionComments(postId: unknown, input?: unknown) {
  try { return { ok: true as const, page: await listPostComments(postId, input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "comments_read_failed" }; }
}

export async function productionComment(postId: unknown, body: unknown) {
  try { return { ok: true as const, comment: await createProductionComment(postId, body) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "comment_create_failed" }; }
}

export async function productionDeletePost(postId: unknown) {
  try { return { ok: true as const, result: await deleteProductionPost(postId) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "post_delete_failed" }; }
}

export async function productionCreatePost(input: Parameters<typeof createProductionPost>[0]) {
  try { return { ok: true as const, post: await createProductionPost(input) }; }
  catch (error) { return { ok: false as const, reason: error instanceof Error ? error.message : "post_create_failed" }; }
}
