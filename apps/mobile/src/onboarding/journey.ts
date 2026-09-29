export type DurableOnboardingStep = "group" | "bias" | "interest" | "done";
export type OnboardingPhase =
  | "group"
  | "bias"
  | "interest"
  | "collect"
  | "reveal"
  | "room"
  | "meet"
  | "app"
  | "edit";
export type OnboardingPatchAction = "groups" | "bias" | "interests" | "complete";

export const ONBOARDING_INTERESTS = [
  "photocards",
  "albums",
  "merch",
  "vinyl",
  "posters",
  "lightsticks",
  "everything",
] as const;

export function nextDurableStep(
  current: DurableOnboardingStep,
  action: OnboardingPatchAction,
  groupCount = 0,
): DurableOnboardingStep | null {
  if (current === "done") return "done";
  if (action === "groups") {
    if (current === "group") return groupCount > 0 ? "bias" : "interest";
    if (current === "bias" || current === "interest") return current;
    return null;
  }
  if (action === "bias") {
    if (current === "bias") return "interest";
    if (current === "interest") return "interest";
    return null;
  }
  if (action === "interests" && current === "interest") return "interest";
  if (action === "complete" && current === "interest") return "done";
  return null;
}

export function canCompleteOnboarding(holdingCount: number): boolean {
  return holdingCount > 0;
}

export function resolveOnboardingPhase(input: {
  durableStep: DurableOnboardingStep;
  editingTastes: boolean;
  holdingCount: number;
  requestedPhase?: string | null;
  hasHoldingHint?: boolean;
  interestsSaved?: boolean;
}): OnboardingPhase {
  if (input.durableStep === "done") return input.editingTastes ? "edit" : "app";
  if (input.editingTastes) {
    if (input.durableStep === "group") return "group";
    if (input.durableStep === "bias") return "bias";
    return "interest";
  }
  if (input.durableStep === "group") return "group";
  if (input.durableStep === "bias") return "bias";

  const owned = input.holdingCount > 0 || Boolean(input.hasHoldingHint);
  if (!owned) return input.interestsSaved ? "collect" : "interest";
  const requested = input.requestedPhase;
  if (requested === "meet") return "meet";
  if (requested === "room") return "room";
  return "reveal";
}

export function returningUserBypassesOnboarding(step: DurableOnboardingStep): boolean {
  return step === "done";
}

export function resumeAfterHoldingDoesNotCollect(phase: OnboardingPhase): boolean {
  return phase !== "collect";
}

/** Deterministic first-user walk used by Slice 8 checks. No production writes. */
export function walkFirstUserJourney(): {
  phases: OnboardingPhase[];
  durable: DurableOnboardingStep[];
  holdingsCreated: number;
  relaunch: OnboardingPhase;
} {
  const phases: OnboardingPhase[] = [];
  const durable: DurableOnboardingStep[] = [];
  let step: DurableOnboardingStep = "group";
  let holdings = 0;
  const push = (next: DurableOnboardingStep, extra?: { interestsSaved?: boolean; requested?: string }) => {
    step = next;
    durable.push(step);
    phases.push(resolveOnboardingPhase({
      durableStep: step,
      editingTastes: false,
      holdingCount: holdings,
      requestedPhase: extra?.requested,
      interestsSaved: extra?.interestsSaved,
    }));
  };

  phases.push(resolveOnboardingPhase({ durableStep: step, editingTastes: false, holdingCount: 0 }));
  durable.push(step);
  push(nextDurableStep(step, "groups", 1)!);
  push(nextDurableStep(step, "bias")!);
  push(nextDurableStep(step, "interests")!, { interestsSaved: true });
  holdings = 1;
  phases.push(resolveOnboardingPhase({
    durableStep: step,
    editingTastes: false,
    holdingCount: holdings,
    requestedPhase: "collect",
    interestsSaved: true,
  }));
  phases.push(resolveOnboardingPhase({
    durableStep: step,
    editingTastes: false,
    holdingCount: holdings,
    requestedPhase: "reveal",
    interestsSaved: true,
  }));
  phases.push(resolveOnboardingPhase({
    durableStep: step,
    editingTastes: false,
    holdingCount: holdings,
    requestedPhase: "room",
    interestsSaved: true,
  }));
  phases.push(resolveOnboardingPhase({
    durableStep: step,
    editingTastes: false,
    holdingCount: holdings,
    requestedPhase: "meet",
    interestsSaved: true,
  }));
  push(nextDurableStep(step, "complete")!);
  const relaunch = resolveOnboardingPhase({ durableStep: "done", editingTastes: false, holdingCount: holdings });
  return { phases, durable, holdingsCreated: holdings, relaunch };
}
