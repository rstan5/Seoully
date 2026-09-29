import { AsyncLocalStorage } from "node:async_hooks";
import type { SupabaseClient } from "@supabase/supabase-js";

const store = new AsyncLocalStorage<SupabaseClient>();

export function runWithSupabaseClient<T>(client: SupabaseClient, fn: () => Promise<T>) {
  return store.run(client, fn);
}

export function requestSupabaseClient(): SupabaseClient | undefined {
  return store.getStore();
}
