/** Temporary development diagnostics. Never pass route params, IDs, URLs or response bodies. */
let correlation = 0;
let attempt: string | null = null;
type Fields = {
  stage?: string; route?: string; destination?: string; intent?: string; checkpoint?: string | null;
  authenticated?: boolean; profileReady?: boolean; completed?: boolean; holdingConfirmed?: boolean;
  available?: boolean; focused?: boolean; mounted?: boolean; stale?: boolean;
  status?: number; category?: string; lifecycle?: string; overlay?: boolean;
};
export function onboardingTrace(event: string, fields: Fields = {}) {
  if (typeof __DEV__ === "undefined" || !__DEV__) return;
  attempt ??= `launch-${Date.now().toString(36)}-${++correlation}`;
  console.log(`[onboarding-trace] ${JSON.stringify({ timestamp: new Date().toISOString(), attempt, event, ...fields })}`);
}
