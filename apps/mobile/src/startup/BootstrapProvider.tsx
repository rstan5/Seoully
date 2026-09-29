import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { loadNativeOnboarding } from "../api";
import { mobileConfig } from "../config";
import { supabase } from "../supabase";
import {
  companionIsEligible,
  initialCompanionEligibility,
  ONBOARDING_FETCH_MS,
  runStartupBootstrap,
  withTimeout,
  type CompanionEligibilityInput,
  type NativeOnboardingStep,
  type StartupDestination,
  type StartupErrorKind,
  type StartupSnapshot,
} from "./eligibility";
import { startupTrace } from "./trace";

type BootstrapContextValue = {
  bootstrapComplete: boolean;
  destination: StartupDestination;
  authenticated: boolean;
  onboardingStep: NativeOnboardingStep | null;
  errorKind: StartupErrorKind | null;
  companionEligible: boolean;
  refresh: () => void;
  enterApp: () => void;
};

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

function snapshotToEligibility(snapshot: StartupSnapshot, complete: boolean): CompanionEligibilityInput {
  return {
    bootstrapComplete: complete,
    authenticated: snapshot.authenticated,
    onboardingStep: snapshot.onboardingStep,
    destination: snapshot.destination,
  };
}

async function restoreSession(): Promise<"signed_out" | "signed_in"> {
  startupTrace("auth restore begin");
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const signedIn = Boolean(data.session);
  startupTrace("auth restore complete", signedIn ? "signed_in" : "signed_out");
  return signedIn ? "signed_in" : "signed_out";
}

async function loadOnboardingBounded(): Promise<{ step: NativeOnboardingStep }> {
  startupTrace("profile begin");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ONBOARDING_FETCH_MS);
  try {
    const state = await withTimeout(loadNativeOnboarding(controller.signal), ONBOARDING_FETCH_MS, "api_unreachable");
    startupTrace("profile complete");
    startupTrace("onboarding", state.step);
    return { step: state.step };
  } catch (error) {
    if (controller.signal.aborted || (error instanceof Error && (error.name === "AbortError" || error.message === "api_unreachable"))) {
      throw new Error("api_unreachable");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function BootstrapProvider({ children }: PropsWithChildren) {
  const [eligibility, setEligibility] = useState<CompanionEligibilityInput>(initialCompanionEligibility);
  const [errorKind, setErrorKind] = useState<StartupErrorKind | null>(null);
  const generation = useRef(0);

  const applySnapshot = useCallback((snapshot: StartupSnapshot, token: number) => {
    if (token !== generation.current) return;
    startupTrace("destination", snapshot.destination);
    setErrorKind(snapshot.errorKind);
    setEligibility(snapshotToEligibility(snapshot, true));
    startupTrace("bootstrap complete");
  }, []);

  const refresh = useCallback(() => {
    const token = ++generation.current;
    setEligibility(initialCompanionEligibility());
    setErrorKind(null);
    startupTrace("config ready", `auth=${mobileConfig.authConfigured ? "yes" : "no"} api=${mobileConfig.productApiConfigured ? "yes" : "no"}`);
    startupTrace("fonts ready");
    void runStartupBootstrap({
      authConfigured: mobileConfig.authConfigured,
      productApiConfigured: mobileConfig.productApiConfigured,
      restoreSession,
      loadOnboarding: loadOnboardingBounded,
    }).then((snapshot) => applySnapshot(snapshot, token));
  }, [applySnapshot]);

  useEffect(() => {
    const timer = setTimeout(() => refresh(), 0);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      startupTrace("auth restore complete", "signed_out");
      generation.current += 1;
      applySnapshot({ destination: "welcome", authenticated: false, onboardingStep: null, errorKind: null }, generation.current);
    });
    return () => {
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [applySnapshot, refresh]);

  const enterApp = useCallback(() => {
    generation.current += 1;
    applySnapshot({ destination: "app", authenticated: true, onboardingStep: "done", errorKind: null }, generation.current);
  }, [applySnapshot]);

  const value = useMemo<BootstrapContextValue>(() => ({
    bootstrapComplete: eligibility.bootstrapComplete,
    destination: eligibility.destination,
    authenticated: eligibility.authenticated,
    onboardingStep: eligibility.onboardingStep,
    errorKind,
    companionEligible: companionIsEligible(eligibility),
    refresh,
    enterApp,
  }), [eligibility, enterApp, errorKind, refresh]);

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap() {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error("useBootstrap must be used inside BootstrapProvider");
  return value;
}
