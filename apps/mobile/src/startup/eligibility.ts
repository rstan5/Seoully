export type NativeOnboardingStep = "group" | "bias" | "interest" | "done";
export type StartupDestination = "loading" | "welcome" | "onboarding" | "app" | "error";
export type StartupErrorKind = "config" | "auth" | "api" | "onboarding";

export const AUTH_RESTORE_MS = 8000;
export const ONBOARDING_FETCH_MS = 10000;

export type CompanionEligibilityInput = {
  bootstrapComplete: boolean;
  authenticated: boolean;
  onboardingStep: NativeOnboardingStep | null;
  destination: StartupDestination;
};

/** Persistent Ask heart. Hidden until bootstrap proves a completed real-app session. */
export function companionIsEligible(input: CompanionEligibilityInput): boolean {
  return input.bootstrapComplete
    && input.authenticated
    && input.onboardingStep === "done"
    && input.destination === "app";
}

export function initialCompanionEligibility(): CompanionEligibilityInput {
  return {
    bootstrapComplete: false,
    authenticated: false,
    onboardingStep: null,
    destination: "loading",
  };
}

export type StartupSnapshot = {
  displayName?: string;
  destination: Exclude<StartupDestination, "loading">;
  authenticated: boolean;
  onboardingStep: NativeOnboardingStep | null;
  errorKind: StartupErrorKind | null;
};

export async function withTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(code)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function parseOnboardingStep(value: unknown): NativeOnboardingStep | null {
  if (value === "group" || value === "bias" || value === "interest" || value === "done") return value;
  return null;
}

/**
 * Canonical Live destination. Profile existence and Demo fixture steps are ignored.
 * Incomplete includes missing/invalid step so a profile row never implies `done`.
 */
export function resolveAuthDestination(input: {
  authenticated: boolean;
  onboardingStep: NativeOnboardingStep | null;
  profileExists?: boolean;
  demoOnboardingStep?: NativeOnboardingStep | null;
}): "welcome" | "onboarding" | "app" {
  void input.profileExists;
  void input.demoOnboardingStep;
  if (!input.authenticated) return "welcome";
  if (input.onboardingStep === "done") return "app";
  return "onboarding";
}

export async function runStartupBootstrap(deps: {
  authConfigured: boolean;
  productApiConfigured: boolean;
  restoreSession: () => Promise<"signed_out" | "signed_in">;
  loadOnboarding: () => Promise<{ step: NativeOnboardingStep; displayName?: string }>;
}): Promise<StartupSnapshot> {
  if (!deps.authConfigured) {
    return { destination: "error", authenticated: false, onboardingStep: null, errorKind: "config" };
  }
  let session: "signed_out" | "signed_in";
  try {
    session = await withTimeout(deps.restoreSession(), AUTH_RESTORE_MS, "auth_restore_timeout");
  } catch {
    return { destination: "error", authenticated: false, onboardingStep: null, errorKind: "auth" };
  }
  if (session === "signed_out") {
    return {
      destination: resolveAuthDestination({ authenticated: false, onboardingStep: null }),
      authenticated: false,
      onboardingStep: null,
      errorKind: null,
    };
  }
  if (!deps.productApiConfigured) {
    return { destination: "error", authenticated: true, onboardingStep: null, errorKind: "api" };
  }
  try {
    const onboarding = await deps.loadOnboarding();
    const step = parseOnboardingStep(onboarding.step);
    if (!step) {
      return { destination: "error", authenticated: true, onboardingStep: null, errorKind: "onboarding" };
    }
    return {
      ...(onboarding.displayName !== undefined ? { displayName: onboarding.displayName } : {}),
      destination: resolveAuthDestination({ authenticated: true, onboardingStep: step }),
      authenticated: true,
      onboardingStep: step,
      errorKind: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const kind: StartupErrorKind =
      message === "product_api_unconfigured"
      || message === "api_unreachable"
      || error instanceof TypeError
        ? "api"
        : "onboarding";
    return { destination: "error", authenticated: true, onboardingStep: null, errorKind: kind };
  }
}
