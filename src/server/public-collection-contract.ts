/** Safe public Holding/wishlist JSON must never include private media fields. */
export const PUBLIC_HOLDING_FORBIDDEN_KEYS = [
  "personalMediaUrl",
  "personal_media_url",
  "storagePath",
  "storage_path",
  "bucket",
  "signedUrl",
  "signed_url",
  "mediaAssetId",
  "media_asset_id",
  "mediaAsset",
  "media_asset",
] as const;

export function publicRecordOmitsPrivateMedia(value: Record<string, unknown>): boolean {
  return PUBLIC_HOLDING_FORBIDDEN_KEYS.every((key) => {
    const found = value[key];
    return found === undefined || found === null;
  });
}
