import AsyncStorage from "@react-native-async-storage/async-storage";

export type ArrivalMessage = "home" | "edit" | "profile" | "dismissed";
export function nextArrivalMessage(current: ArrivalMessage): ArrivalMessage {
  return current === "home" ? "edit" : current === "edit" ? "profile" : current;
}

// This is only presentation history, never evidence of ownership or first-home completion.
// Claim before animation: an interruption resumes the real destination rather than half a scene.
const claims = new Map<string, Promise<boolean>>();
export function claimRoomArrival(userId: string, holdingId: string): Promise<boolean> {
  const key = `seoully:first-room-arrival:${userId}:${holdingId}`;
  const pending = claims.get(key);
  if (pending) return pending.then(() => false);
  const work = (async () => {
    if (await AsyncStorage.getItem(key)) return false;
    await AsyncStorage.setItem(key, "seen");
    return true;
  })();
  claims.set(key, work);
  void work.finally(() => { if (claims.get(key) === work) claims.delete(key); }).catch(() => {});
  return work;
}
