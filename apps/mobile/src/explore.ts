export const EXPLORE_DESTINATIONS = ["people", "rooms", "posts", "collectibles", "entities"] as const;
export type ExploreDestination = (typeof EXPLORE_DESTINATIONS)[number];

export function isExploreDestination(value: string | undefined | null): value is ExploreDestination {
  return Boolean(value && (EXPLORE_DESTINATIONS as readonly string[]).includes(value));
}
