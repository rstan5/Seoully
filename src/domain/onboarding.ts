/**
 * First-session progress.
 *
 * Lives beside the existing local session. Distinguishes a brand-new visitor
 * from someone mid-way through becoming a person here, and from a returning
 * collector who should never see welcome again.
 */

export type IdentityBeat = "photo" | "group" | "bias" | "interest" | "done";

export interface OnboardingProgress {
  profileComplete: boolean;
  firstHoldingComplete: boolean;
  roomIntroduced: boolean;
  firstSessionComplete: boolean;
  identityBeat: IdentityBeat;
}

export const EMPTY_ONBOARDING: OnboardingProgress = {
  profileComplete: false,
  firstHoldingComplete: false,
  roomIntroduced: false,
  firstSessionComplete: false,
  identityBeat: "photo",
};

type ProgressPatch = Partial<OnboardingProgress>;

export function normalizeOnboarding(raw: ProgressPatch | undefined): OnboardingProgress {
  if (!raw) return { ...EMPTY_ONBOARDING };
  const hadHolding = !!raw.firstHoldingComplete;
  // Older live snapshots finished at first holding. Treat those as complete
  // so Phase 6 users are not walked through the new beats on reload.
  const legacyComplete = raw.firstSessionComplete === undefined && hadHolding;
  return {
    profileComplete: !!raw.profileComplete,
    firstHoldingComplete: hadHolding,
    roomIntroduced: raw.roomIntroduced ?? (legacyComplete || hadHolding),
    firstSessionComplete: raw.firstSessionComplete ?? legacyComplete,
    identityBeat: raw.identityBeat ?? (raw.profileComplete ? "done" : "photo"),
  };
}
