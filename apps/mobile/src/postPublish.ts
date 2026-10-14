export const postFailureCodes = new Set(["unauthenticated", "invalid_media", "media_local_file_unreadable", "media_too_large", "unsupported_media_type", "invalid_user_tag", "invalid_collectible_tag", "invalid_post_content", "invalid_post_payload", "post_create_failed", "post_media_upload_failed", "post_media_record_failed", "post_user_tag_failed", "post_collectible_tag_failed", "post_read_failed", "network_failure", "post_create_failed"]);
export function postTrace(stage: string, status = 0, code = "") {
  if (typeof __DEV__ !== "undefined" && __DEV__) console.info("seoully_post_publish", { stage, status, code: postFailureCodes.has(code) ? code : "" });
}
export function postFailureMessage(error: unknown, copy: { postCreateFailed: string; postAuthFailed: string; postMediaFailed: string; postTagsFailed: string; postNetworkFailed: string }) {
  const code = error instanceof Error ? error.message.split(":").at(-1) : "";
  if (code === "unauthenticated") return copy.postAuthFailed;
  if (["invalid_media", "media_local_file_unreadable", "media_too_large", "unsupported_media_type", "post_media_upload_failed"].includes(code ?? "")) return copy.postMediaFailed;
  if (["invalid_user_tag", "invalid_collectible_tag", "invalid_post_payload"].includes(code ?? "")) return copy.postTagsFailed;
  if (code === "network_failure") return copy.postNetworkFailed;
  return copy.postCreateFailed;
}
