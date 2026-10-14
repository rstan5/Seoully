/** Expo Router 57 wraps the authored root Stack in its generated __root navigator. */
export type NavigationSnapshot = {
  key?: string;
  index?: number;
  routeNames?: readonly string[];
  routes: readonly { name: string; state?: NavigationSnapshot }[];
};

export function authoredRootState(state?: NavigationSnapshot): NavigationSnapshot | undefined {
  const active = state?.routes[state.index ?? 0];
  return active?.name === "__root" ? active.state : state;
}
