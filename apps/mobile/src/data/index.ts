import { useMemo } from "react";
import { useDataMode } from "./mode";
import { productionRepository } from "./production";
import type { SocialRepository } from "./types";

function demoRepository(): SocialRepository {
  if (__DEV__) {
    // Dev-only require so fixture modules and bundled demo images stay out of production.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require("./demo/repository") as typeof import("./demo/repository")).getDemoRepository();
  }
  throw new Error("demo_world_forbidden");
}

export function useSocialRepository(): SocialRepository {
  const { demo } = useDataMode();
  return useMemo(() => (demo ? demoRepository() : productionRepository), [demo]);
}

export { DataModeProvider, isDemoWorldAllowed, useDataMode } from "./mode";
export type { FeedMode, SocialCollector, SocialEntity, SocialRepository, SocialSuggested } from "./types";
