/** Pure configuration predicates. Keep free of Expo so honesty tests can import them. */

export function isAuthConfigured(supabaseUrl: string, publishableKey: string): boolean {
  return Boolean(supabaseUrl.trim() && publishableKey.trim());
}

export function isProductApiConfigured(apiUrl: string): boolean {
  const value = apiUrl.trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSeoullyProductReady(supabaseUrl: string, publishableKey: string, apiUrl: string): boolean {
  return isAuthConfigured(supabaseUrl, publishableKey) && isProductApiConfigured(apiUrl);
}
