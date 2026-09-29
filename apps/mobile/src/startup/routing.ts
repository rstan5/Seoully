import type { StartupDestination } from "./eligibility";

export { parseOnboardingStep, resolveAuthDestination } from "./eligibility";

/** Sole owner of Welcome / Onboarding / App tree switches. Child layouts must not Redirect. */
export const AUTH_ROUTE_OWNER = "root-stack-protected";

export type AuthRouteTree = "loading" | "welcome" | "onboarding" | "app" | "error";

export function authRouteTree(destination: StartupDestination): AuthRouteTree {
  return destination;
}

export function screensForDestination(destination: StartupDestination) {
  return {
    welcome: destination === "welcome",
    onboarding: destination === "onboarding",
    app: destination === "app",
    shared: destination === "onboarding" || destination === "app",
  };
}

export function childLayoutMayRedirect(_destination: StartupDestination): boolean {
  void _destination;
  return false;
}

export function destinationAfterSignOut(): Extract<StartupDestination, "welcome"> {
  return "welcome";
}

export type AuthRouteEvent = "sign-out" | "sign-in-complete" | "sign-in-incomplete" | "restore-complete" | "restore-incomplete" | "restore-signed-out";

export function transitionAuthRoute(
  _from: StartupDestination,
  event: AuthRouteEvent,
): { destination: StartupDestination; visitsWelcome: number; visitsApp: number } {
  void _from;
  if (event === "sign-out" || event === "restore-signed-out") {
    return { destination: "welcome", visitsWelcome: 1, visitsApp: 0 };
  }
  if (event === "sign-in-complete" || event === "restore-complete") {
    return { destination: "app", visitsWelcome: 0, visitsApp: 1 };
  }
  return { destination: "onboarding", visitsWelcome: 0, visitsApp: 0 };
}
