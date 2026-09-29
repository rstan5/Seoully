import { isAuthConfigured, isProductApiConfigured, isSeoullyProductReady } from "./config-rules";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

const authConfigured = isAuthConfigured(supabaseUrl ?? "", supabasePublishableKey ?? "");
const productApiConfigured = isProductApiConfigured(apiUrl ?? "");

export const mobileConfig = {
  supabaseUrl: supabaseUrl ?? "",
  supabasePublishableKey: supabasePublishableKey ?? "",
  apiUrl: apiUrl ?? "",
  authConfigured,
  productApiConfigured,
  /** Complete Seoully product (auth + API). Never true when the API URL is missing. */
  isConfigured: isSeoullyProductReady(supabaseUrl ?? "", supabasePublishableKey ?? "", apiUrl ?? ""),
} as const;
