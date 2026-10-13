import { useGlobalSearchParams, usePathname } from "expo-router";
import { isGuidedOnboardingRoute } from "../onboarding/presentation";
import { useBootstrap } from "../startup/BootstrapProvider";
import { SeoullyCompanion } from "./SeoullyCompanion";

/** The guided journey owns its final corner handoff; do not mount a second helper. */
export function SeoullyCompanionHost() {
  const boot = useBootstrap();
  const path = usePathname();
  const { from } = useGlobalSearchParams<{ from?: string | string[] }>();
  if (!boot.companionEligible || isGuidedOnboardingRoute(path, from)) return null;
  return <SeoullyCompanion />;
}
