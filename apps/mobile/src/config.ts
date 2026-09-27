const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const mobileConfig = {
  supabaseUrl: supabaseUrl ?? "",
  supabasePublishableKey: supabasePublishableKey ?? "",
  isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
} as const;
