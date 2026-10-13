import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import * as Linking from "expo-linking";
import { isReturningWelcomeLaunch } from "./welcomeEligibility";
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
  returningWelcome: boolean;
  welcomeName: string;
  profileEntryRequested: boolean;
  consumeProfileEntry: () => void;
  finishReturningWelcome: () => void;
  refresh: () => void;
  enterApp: (target?: "profile") => void;
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

async function loadOnboardingBounded(): Promise<{ step: NativeOnboardingStep; displayName?: string }> {
  startupTrace("profile begin");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ONBOARDING_FETCH_MS);
  try {
    const state = await withTimeout(loadNativeOnboarding(controller.signal), ONBOARDING_FETCH_MS, "api_unreachable");
    startupTrace("profile complete");
    startupTrace("onboarding", state.step);
    return { step: state.step, displayName: state.displayName };
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
  const coldLaunch = useRef(true);
  const linkInterrupted = useRef(false);
  const [returningWelcome, setReturningWelcome] = useState(false);
  const [welcomeName, setWelcomeName] = useState("");
  const [profileEntryRequested, setProfileEntryRequested] = useState(false);
  const consumeProfileEntry = useCallback(() => setProfileEntryRequested(false), []);
  const finishReturningWelcome = useCallback(() => setReturningWelcome(false), []);

  const applySnapshot = useCallback((snapshot: StartupSnapshot, token: number) => {
    if (token !== generation.current) return;
    startupTrace("destination", snapshot.destination);
    setWelcomeName(snapshot.displayName ?? "");
    setErrorKind(snapshot.errorKind);
    setEligibility(snapshotToEligibility(snapshot, true));
    startupTrace("bootstrap complete");
  }, []);

  const refresh = useCallback(() => {
    const initial = coldLaunch.current;
    coldLaunch.current = false;
    const initialUrl = initial ? withTimeout(Linking.getInitialURL(), 500, "initial_url_unavailable").catch(() => "unknown-deep-link") : Promise.resolve("not-cold");
    setReturningWelcome(false);
    setProfileEntryRequested(false);
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
    }).then(async (snapshot) => {
      if (token !== generation.current) return;
      if (!initial || snapshot.destination !== "app") { applySnapshot(snapshot, token); return; }
      const url = await initialUrl;
      if (token !== generation.current) return;
      setReturningWelcome(isReturningWelcomeLaunch(initial && !linkInterrupted.current, snapshot, url));
      applySnapshot(snapshot, token);
    });
  }, [applySnapshot]);

  useEffect(() => {
    const timer = setTimeout(() => refresh(), 0);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_OUT") return;
      startupTrace("auth restore complete", "signed_out");
      setReturningWelcome(false);
      setProfileEntryRequested(false);
      generation.current += 1;
      applySnapshot({ destination: "welcome", authenticated: false, onboardingStep: null, errorKind: null }, generation.current);
    });
    const links = Linking.addEventListener("url", () => { linkInterrupted.current = true; setReturningWelcome(false); setProfileEntryRequested(false); });
    return () => {
      links.remove();
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [applySnapshot, refresh]);

  const enterApp = useCallback((target?: "profile") => {
    setProfileEntryRequested(target === "profile");
    setReturningWelcome(false);
    generation.current += 1;
    applySnapshot({ destination: "app", authenticated: true, onboardingStep: "done", errorKind: null }, generation.current);
  }, [applySnapshot]);

  const value = useMemo<BootstrapContextValue>(() => ({
    bootstrapComplete: eligibility.bootstrapComplete,
    destination: eligibility.destination,
    authenticated: eligibility.authenticated,
    onboardingStep: eligibility.onboardingStep,
    errorKind,
    companionEligible: companionIsEligible(eligibility) && !returningWelcome,
    returningWelcome,
    welcomeName,
    profileEntryRequested,
    consumeProfileEntry,
    finishReturningWelcome,
    refresh,
    enterApp,
  }), [eligibility, enterApp, errorKind, refresh, returningWelcome, welcomeName, profileEntryRequested, consumeProfileEntry, finishReturningWelcome]);

  return <BootstrapContext.Provider value={value}>{children}</BootstrapContext.Provider>;
}

export function useBootstrap() {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error("useBootstrap must be used inside BootstrapProvider");
  return value;
}
