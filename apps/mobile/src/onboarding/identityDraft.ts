import AsyncStorage from "@react-native-async-storage/async-storage";

export type OnboardingIdentityDraft = { groupIds: string[]; biasIds: string[] };
const key = (userId: string) => `seoully:onboarding-identity:${userId}`;
// Serialize disk writes so rapid selections cannot restore an older draft.
const writes = new Map<string, Promise<void>>();
function enqueue(userId: string, work: () => Promise<void>) {
  const previous = writes.get(userId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  writes.set(userId, next);
  void next.finally(() => { if (writes.get(userId) === next) writes.delete(userId); }).catch(() => {});
  return next;
}
export async function readOnboardingIdentityDraft(userId: string): Promise<OnboardingIdentityDraft | null> {
  await writes.get(userId);
  const raw = await AsyncStorage.getItem(key(userId));
  if (!raw) return null;
  let value: OnboardingIdentityDraft | null;
  try { value = JSON.parse(raw) as OnboardingIdentityDraft | null; } catch { return null; }
  if (!value || !Array.isArray(value.groupIds) || !Array.isArray(value.biasIds)
    || value.groupIds.length > 24 || value.biasIds.length > 48
    || [...value.groupIds, ...value.biasIds].some(id => typeof id !== "string" || !/^[a-z0-9_-]{1,64}$/.test(id))) return null;
  return value;
}
export function saveOnboardingIdentityDraft(userId: string, draft: OnboardingIdentityDraft) {
  const snapshot = JSON.stringify(draft);
  return enqueue(userId, () => AsyncStorage.setItem(key(userId), snapshot));
}
export function clearOnboardingIdentityDraft(userId: string) {
  return enqueue(userId, () => AsyncStorage.removeItem(key(userId)));
}
