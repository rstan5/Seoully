const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const apiUrl = process.env.EXPO_PUBLIC_API_URL;

export const mobileConfig = {
  supabaseUrl: supabaseUrl ?? "",
  supabasePublishableKey: supabasePublishableKey ?? "",
  apiUrl: apiUrl ?? "",
  isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
} as const;
