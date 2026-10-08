import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import { contributeCatalogItem } from "./api";
import { createCatalogSubmitter, type ManualCatalogDetails } from "./catalogSubmission";
import { supabase } from "./supabase";

const submit = createCatalogSubmitter(AsyncStorage, randomUUID, async (collector, input) => {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user.id !== collector) throw new Error("unauthenticated");
  return contributeCatalogItem(input);
});

export async function submitManualCatalog(details: ManualCatalogDetails, onConfirmed?: (result: Awaited<ReturnType<typeof contributeCatalogItem>>) => Promise<void>) {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("unauthenticated");
  return submit(data.session.user.id, details, onConfirmed);
}
