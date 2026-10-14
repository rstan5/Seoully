import { useMemo, useSyncExternalStore } from "react";
import { useNavigationContainerRef } from "expo-router";
import { authoredRootState, type NavigationSnapshot } from "./navigationState";

type NavigationSource = {
  isReady: () => boolean;
  getRootState: () => NavigationSnapshot | undefined;
  addListener: (event: "state" | "ready", changed: () => void) => () => void;
};

// This observer needs registration/focus only, never route params or user data.
function capture(state?: NavigationSnapshot): NavigationSnapshot | undefined {
  if (!state) return undefined;
  return {
    key: state.key,
    index: state.index,
    routeNames: state.routeNames ? [...state.routeNames] : undefined,
    routes: state.routes.map(route => ({ name: route.name, state: capture(route.state) })),
  };
}

export function createNavigationStateStore(ref: NavigationSource) {
  let snapshot: NavigationSnapshot | undefined;
  let signature: string | undefined;
  const listeners = new Set<() => void>();
  let detach: (() => void) | undefined;
  const refresh = () => {
    const next = capture(authoredRootState(ref.isReady() ? ref.getRootState() : undefined));
    const nextSignature = JSON.stringify(next);
    if (nextSignature === signature) return false;
    signature = nextSignature;
    snapshot = next;
    return true;
  };
  // getRootState can reconstruct a new tree on EVERY read. Never call it from getSnapshot.
  refresh();
  const changed = () => { if (refresh()) listeners.forEach(listener => listener()); };
  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => undefined,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!detach) {
        const state = ref.addListener("state", changed);
        const ready = ref.addListener("ready", changed);
        detach = () => { state(); ready(); };
      }
      // Catch commits between initial render and subscription, and while unsubscribed.
      changed();
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { detach?.(); detach = undefined; }
      };
    },
  };
}

/** Stable snapshots of committed, wrapper-aware app navigation. */
export function useAppNavigationState() {
  const ref = useNavigationContainerRef();
  const store = useMemo(() => createNavigationStateStore(ref), [ref]);
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
