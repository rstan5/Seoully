/** Comparable input stages share a top anchor; content scrolls below, never recenters. */
export const onboardingSpacing = { heading: 32, description: 6, content: 20 } as const;
export const onboardingHeading = { marginTop: onboardingSpacing.heading, marginBottom: 0 } as const;
export const onboardingDescription = { marginTop: onboardingSpacing.description } as const;

export function isGuidedOnboardingRoute(pathname: string, from?: string | string[]) {
  const leaf = pathname.split("/").filter(Boolean).at(-1);
  return leaf === "onboarding" || from === "onboarding" || (Array.isArray(from) && from.includes("onboarding"));
}
