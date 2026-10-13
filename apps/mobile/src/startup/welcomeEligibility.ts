import type { StartupSnapshot } from "./eligibility";

/** Presentation eligibility only: never changes the authentication destination. */
export function isReturningWelcomeLaunch(initial: boolean, snapshot: StartupSnapshot, url: string | null): boolean {
  if (!initial || snapshot.destination !== "app" || !snapshot.authenticated || snapshot.onboardingStep !== "done" || snapshot.errorKind) return false;
  if (!url) return true;
  try {
    const parsed = new URL(url);
    // Expo Go's root launch URL is not a destination deep link.
    const path = parsed.pathname.replace(/^\/--\/?/, "/").replace(/^\/+|\/+$/g, "");
    return (parsed.protocol === "exp:" || parsed.protocol === "exps:") && !path && !parsed.search && !parsed.hash;
  } catch { return false; }
}
