import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { supabase } from "../supabase";
import type { FirstCollectibleDraft } from "./firstCollectible";

async function key() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("unauthenticated");
  return `seoully:first-collectible:v1:${data.session.user.id}`;
}
export async function readFirstCollectibleDraft(): Promise<FirstCollectibleDraft | null> {
  const raw = await AsyncStorage.getItem(await key());
  if (!raw) return null;
  const draft = JSON.parse(raw) as FirstCollectibleDraft;
  if (!draft.templateId || !draft.holdingId) throw new Error("invalid_first_collectible_draft");
  return draft;
}
let queueTail: Promise<unknown> = Promise.resolve();
export function queueFirstCollectible(templateId: string, newTemplate = false, templateInfo?: FirstCollectibleDraft["templateInfo"]) {
  const queued = queueTail.then(async () => {
    const existing = await readFirstCollectibleDraft();
    if (existing) return existing;
    const draft: FirstCollectibleDraft = { templateId, holdingId: randomUUID(), templateInfo: templateInfo ? { name: templateInfo.name, kind: templateInfo.kind, groupName: templateInfo.groupName, memberName: templateInfo.memberName, releaseName: templateInfo.releaseName } : undefined, photoUri: null, shareReference: false, newTemplate };
    await saveFirstCollectibleDraft(draft);
    return draft;
  });
  queueTail = queued.catch(() => undefined);
  return queued;
}
export async function saveFirstCollectibleDraft(draft: FirstCollectibleDraft) {
  await AsyncStorage.setItem(await key(), JSON.stringify(draft));
}
export async function clearFirstCollectibleDraft() {
  await AsyncStorage.removeItem(await key());
}
