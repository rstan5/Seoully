import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { supabase } from "../supabase";
import type { FirstCollectibleDraft } from "./firstCollectible";

async function key(scope?: string) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("unauthenticated");
  return `seoully:first-collectible:v1:${data.session.user.id}${scope ? `:add:${encodeURIComponent(scope)}` : ""}`;
}
export async function readFirstCollectibleDraft(scope?: string): Promise<FirstCollectibleDraft | null> {
  const raw = await AsyncStorage.getItem(await key(scope));
  if (!raw) return null;
  const draft = JSON.parse(raw) as FirstCollectibleDraft;
  if (!draft.templateId || !draft.holdingId) throw new Error("invalid_first_collectible_draft");
  return draft;
}
let queueTail: Promise<unknown> = Promise.resolve();
export function queueFirstCollectible(templateId: string, newTemplate = false, templateInfo?: FirstCollectibleDraft["templateInfo"], scope?: string) {
  const queued = queueTail.then(async () => {
    const existing = await readFirstCollectibleDraft(scope);
    if (existing) return existing;
    const draft: FirstCollectibleDraft = { templateId, holdingId: randomUUID(), templateInfo: templateInfo ? { name: templateInfo.name, kind: templateInfo.kind, groupName: templateInfo.groupName, memberName: templateInfo.memberName, releaseName: templateInfo.releaseName } : undefined, photoUri: null, shareReference: false, newTemplate };
    await saveFirstCollectibleDraft(draft, scope);
    return draft;
  });
  queueTail = queued.catch(() => undefined);
  return queued;
}
export async function saveFirstCollectibleDraft(draft: FirstCollectibleDraft, scope?: string) {
  await AsyncStorage.setItem(await key(scope), JSON.stringify(draft));
}
export async function clearFirstCollectibleDraft(scope?: string) {
  await AsyncStorage.removeItem(await key(scope));
}

/** Preserve the original onboarding slot and any interrupted pre-scope Add. */
export async function prepareAddCollectibleDraft(templateId: string, newTemplate: boolean, onboarding: boolean, templateInfo?: FirstCollectibleDraft["templateInfo"]) {
  if (!templateId) throw new Error("add_template_missing");
  if (onboarding) return { draft: await queueFirstCollectible(templateId, newTemplate, templateInfo), scope: undefined };
  const scoped = await readFirstCollectibleDraft(templateId);
  if (scoped) return { draft: scoped, scope: templateId };
  const legacy = await readFirstCollectibleDraft();
  // Resume a matching old operation with its SAME Holding UUID and photo.
  if (legacy?.templateId === templateId) return { draft: legacy, scope: undefined };
  return { draft: await queueFirstCollectible(templateId, newTemplate, templateInfo, templateId), scope: templateId };
}
