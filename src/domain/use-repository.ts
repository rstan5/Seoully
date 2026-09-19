"use client";

import { useSyncExternalStore } from "react";
import { repository } from "./memory-repository";

/**
 * Subscribe to in-memory mutations (follow, message) so identity UI re-renders
 * without putting social state into the camera store.
 */
export function useRepoRevision(): number {
  return useSyncExternalStore(
    (onStoreChange) => repository.subscribe(onStoreChange),
    () => repository.revision(),
    () => 0,
  );
}
