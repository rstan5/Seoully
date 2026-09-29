/** Deterministic Discover/Search helpers that do not require a live database. */

export function excludedDiscoverAuthorIds(viewerId: string, followedUserIds: string[]): string[] {
  return [...new Set([viewerId, ...followedUserIds.filter(Boolean)])];
}

export function sanitizeSearchNeedle(query: string): string {
  return query.replace(/[%(),]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

export function discoverHitOmitsPrivateCollectionFields(value: object): boolean {
  const keys = Object.keys(value);
  return !keys.includes("personalMediaUrl")
    && !keys.includes("signedUrl")
    && !keys.includes("wishlist")
    && !keys.includes("holdings");
}
