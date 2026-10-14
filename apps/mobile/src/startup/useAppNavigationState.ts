import { useCallback, useSyncExternalStore } from "react";
import { useNavigationContainerRef } from "expo-router";
import { authoredRootState } from "./navigationState";

/** Subscribe to real navigation commits, including protected route registration and child focus. */
export function useAppNavigationState() {
  const ref = useNavigationContainerRef();
  const subscribe = useCallback((changed: () => void) => {
    const state = ref.addListener("state", changed);
    const ready = ref.addListener("ready", changed);
    return () => { state(); ready(); };
  }, [ref]);
  const snapshot = useCallback(() => ref.isReady() ? ref.getRootState() : undefined, [ref]);
  return authoredRootState(useSyncExternalStore(subscribe, snapshot, snapshot));
}
