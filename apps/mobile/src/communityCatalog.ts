import AsyncStorage from "@react-native-async-storage/async-storage";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import { contributeCatalogItem, loadCatalogTemplate, uploadCatalogReferencePhoto } from "./api";
import { createCatalogPublisher, type CatalogPublicationDraft } from "./catalogPublication";
import type { ManualCatalogDetails } from "./catalogSubmission";
import { supabase } from "./supabase";

async function slot() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("unauthenticated");
  return `seoully:catalog-publication:v1:${data.session.user.id}`;
}
export async function loadCatalogPublication(): Promise<CatalogPublicationDraft | null> {
  const saved = await AsyncStorage.getItem(await slot());
  return saved ? JSON.parse(saved) as CatalogPublicationDraft : null;
}
export async function saveCatalogPublication(details: ManualCatalogDetails, uri: string) {
  const key = await slot();
  const saved = await AsyncStorage.getItem(key);
  const previous = saved ? JSON.parse(saved) as CatalogPublicationDraft : null;
  if (previous && JSON.stringify(previous.details) === JSON.stringify(details) && previous.referenceUri === uri) return previous;
  const submissionKey = randomUUID();
  const file = new File(Paths.document, `catalog-reference-${submissionKey}.jpg`);
  new File(uri).copy(file);
  const draft: CatalogPublicationDraft = { details, referenceUri: file.uri, submissionKey };
  try { await AsyncStorage.setItem(key, JSON.stringify(draft)); }
  catch (error) { removeReference(file.uri); throw error; }
  if (previous) removeReference(previous.referenceUri);
  return draft;
}
function removeReference(uri: string) {
  // Only our private draft copy; never delete a picker original or a personal photo.
  if (!uri.startsWith(Paths.document.uri) || !uri.includes("/catalog-reference-")) return;
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* OS cleanup may have already removed it. */ }
}
export async function clearCatalogPublication(draft: CatalogPublicationDraft) {
  const key = await slot();
  const saved = await AsyncStorage.getItem(key);
  const current = saved ? JSON.parse(saved) as CatalogPublicationDraft : null;
  if (current?.submissionKey !== draft.submissionKey) return;
  await AsyncStorage.removeItem(key);
  removeReference(draft.referenceUri);
}
export const publishCommunityCatalog = createCatalogPublisher({
  contribute: contributeCatalogItem, reference: uploadCatalogReferencePhoto, read: loadCatalogTemplate,
});
