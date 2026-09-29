import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  companionIsEligible,
  initialCompanionEligibility,
  runStartupBootstrap,
  withTimeout,
} from "../apps/mobile/src/startup/eligibility";

const repoRoot = process.cwd();
function read(rel: string) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}
function assertContains(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), `${label} missing ${JSON.stringify(needle)}`);
}
function assertNotContains(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), `${label} unexpectedly contains ${JSON.stringify(needle)}`);
}

const hidden = {
  bootstrapComplete: true,
  authenticated: true,
  onboardingStep: "group" as const,
  destination: "onboarding" as const,
};

assert.equal(companionIsEligible(initialCompanionEligibility()), false);
assert.equal(companionIsEligible({
  bootstrapComplete: true,
  authenticated: false,
  onboardingStep: null,
  destination: "welcome",
}), false);
for (const step of ["group", "bias", "interest"] as const) {
  assert.equal(companionIsEligible({ ...hidden, onboardingStep: step }), false, step);
}
assert.equal(companionIsEligible({
  bootstrapComplete: true,
  authenticated: true,
  onboardingStep: "done",
  destination: "app",
}), true);
assert.equal(companionIsEligible({
  bootstrapComplete: false,
  authenticated: false,
  onboardingStep: null,
  destination: "loading",
}), false);
assert.equal(companionIsEligible({
  bootstrapComplete: true,
  authenticated: true,
  onboardingStep: null,
  destination: "error",
}), false);

async function hang(): Promise<never> {
  return new Promise(() => {});
}

async function main() {
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: async () => { throw new Error("auth_restore_timeout"); },
    loadOnboarding: hang,
  })).destination, "error");
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: async () => "signed_in",
    loadOnboarding: async () => { throw new Error("onboarding_unavailable"); },
  })).errorKind, "onboarding");
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: async () => "signed_in",
    loadOnboarding: async () => { throw new Error("api_unreachable"); },
  })).errorKind, "api");
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: false,
    restoreSession: async () => "signed_in",
    loadOnboarding: hang,
  })).errorKind, "api");
  assert.equal((await runStartupBootstrap({
    authConfigured: false,
    productApiConfigured: false,
    restoreSession: hang,
    loadOnboarding: hang,
  })).errorKind, "config");
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: async () => "signed_out",
    loadOnboarding: hang,
  })).destination, "welcome");
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: async () => "signed_in",
    loadOnboarding: async () => ({ step: "group" }),
  })).destination, "onboarding");
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: async () => "signed_in",
    loadOnboarding: async () => ({ step: "interest" }),
  })).onboardingStep, "interest");
  assert.equal((await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: async () => "signed_in",
    loadOnboarding: async () => ({ step: "done" }),
  })).destination, "app");
  await assert.rejects(() => withTimeout(hang(), 20, "auth_restore_timeout"), /auth_restore_timeout/);
  const timed = await runStartupBootstrap({
    authConfigured: true,
    productApiConfigured: true,
    restoreSession: () => withTimeout(hang(), 20, "auth_restore_timeout"),
    loadOnboarding: hang,
  });
  assert.equal(timed.destination, "error");
  assert.equal(timed.errorKind, "auth");
  assert.notEqual(timed.destination, "app");

  const companion = read("apps/mobile/src/ui/SeoullyCompanion.tsx");
  assertContains(companion, "boot.companionEligible", "companion uses product eligibility");
  assertNotContains(companion, "sessionReady", "companion no session-only visibility");
  assertContains(read("apps/mobile/app/index.tsx"), "boot.refresh", "retry bootstrap");
  assertContains(read("apps/mobile/src/startup/BootstrapProvider.tsx"), "AbortController", "onboarding fetch abort");
  assertContains(read("apps/mobile/src/startup/trace.ts"), "[startup]", "dev trace");
  assertNotContains(read("apps/mobile/src/startup/trace.ts"), "access_token", "no token logging");
  assertContains(read("apps/mobile/app/_layout.tsx"), "BootstrapProvider", "root bootstrap");
  assertContains(read("apps/mobile/src/startup/AuthRouteTree.tsx"), "Stack.Protected", "root owns auth trees");
  assertNotContains(read("apps/mobile/app/(tabs)/_layout.tsx"), "Redirect", "tabs no redirect loop");
  assertContains(read("apps/mobile/app/onboarding.tsx"), "boot.enterApp", "done enters app");
  console.log("check:startup passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
