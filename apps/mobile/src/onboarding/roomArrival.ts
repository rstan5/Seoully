import AsyncStorage from "@react-native-async-storage/async-storage";

export type ArrivalMessage = "home" | "edit" | "profile" | "dismissed";
export function nextArrivalMessage(current: ArrivalMessage): ArrivalMessage {
  return current === "home" ? "edit" : current === "edit" ? "profile" : current;
}

// Presentation checkpoints ONLY. profiles.onboarding_step remains the completion authority.
const stages = ["heart", "room", "binder", "home", "edit", "profile", "dismissed"] as const;
export type RoomArrivalStage = typeof stages[number];
const writes = new Map<string, Promise<unknown>>();
const keyFor = (userId: string, holdingId: string) => `seoully:first-room-arrival:${userId}:${holdingId}`;
function parse(value: string | null): RoomArrivalStage {
  if (!value) return "heart";
  // Older builds claimed the entrance before playing it, but did not track segments.
  // Resume at the final action rather than replaying an unknown amount of that tour.
  if (value === "seen") return "profile";
  if (stages.includes(value as RoomArrivalStage)) return value as RoomArrivalStage;
  throw new Error("room_arrival_history_invalid");
}
export async function readRoomArrivalStage(userId: string, holdingId: string): Promise<RoomArrivalStage> {
  const key = keyFor(userId, holdingId);
  await writes.get(key);
  return parse(await AsyncStorage.getItem(key));
}
export function recordRoomArrivalStage(userId: string, holdingId: string, next: RoomArrivalStage): Promise<void> {
  const key = keyFor(userId, holdingId);
  const work = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(async () => {
    const current = parse(await AsyncStorage.getItem(key));
    // A late callback from an outgoing screen cannot restore an older segment.
    if (stages.indexOf(next) > stages.indexOf(current)) await AsyncStorage.setItem(key, next);
  });
  writes.set(key, work);
  void work.finally(() => { if (writes.get(key) === work) writes.delete(key); }).catch(() => {});
  return work;
}
