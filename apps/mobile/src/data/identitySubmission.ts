import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
export type IdentitySubmission = { submissionId: string; kind: "group" | "member"; name: string; groupId?: string };
/** Persist before sending: a committed response lost on the network reuses its key. */
export async function prepareIdentitySubmission(userId: string, details: Omit<IdentitySubmission, "submissionId">): Promise<IdentitySubmission> {
  const key = `seoully:identity-submission:${userId}:${details.kind}`;
  const stored = await AsyncStorage.getItem(key);
  if (stored) {
    const previous = JSON.parse(stored) as IdentitySubmission;
    if (previous.kind === details.kind && previous.name === details.name && previous.groupId === details.groupId) return previous;
  }
  const submission = { ...details, submissionId: randomUUID() };
  await AsyncStorage.setItem(key, JSON.stringify(submission));
  return submission;
}
export async function finishIdentitySubmission(userId: string, submission: IdentitySubmission) {
  const key = `seoully:identity-submission:${userId}:${submission.kind}`;
  const stored = await AsyncStorage.getItem(key);
  if (stored && JSON.parse(stored).submissionId === submission.submissionId) await AsyncStorage.removeItem(key);
}
