import type { ConfigContext, ExpoConfig } from "expo/config";

/** Local Expo Go stays unchanged. Store builds require approved identifiers and origin. */
export default function appConfig({ config }: ConfigContext): ExpoConfig {
  if (process.env.SEOULLY_RELEASE_CONFIG !== "1") return config as ExpoConfig;
  const projectId = process.env.SEOULLY_EAS_PROJECT_ID;
  const bundleIdentifier = process.env.SEOULLY_IOS_BUNDLE_IDENTIFIER;
  const api = process.env.EXPO_PUBLIC_API_URL;
  if (!projectId || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(projectId)) throw new Error("Configure the approved EAS project ID before a store build.");
  if (!bundleIdentifier || !/^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*){2,}$/.test(bundleIdentifier) || bundleIdentifier.includes("placeholder")) throw new Error("Configure the registered Seoully iOS bundle identifier.");
  let origin: URL;
  try { origin = new URL(api ?? ""); } catch { throw new Error("Configure the production HTTPS product API origin."); }
  const host = origin.hostname.toLowerCase();
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || !host.includes(".") || host.includes(":") || /^[0-9.]+$/.test(host) || /(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)) throw new Error("Store builds require a public HTTPS API origin without a path.");
  if (process.env.EXPO_PUBLIC_SUPABASE_URL !== "https://ttmynanbwxlvcczeobgj.supabase.co") throw new Error("Store builds require the approved Seoully Supabase project.");
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  let publicKey = key.startsWith("sb_publishable_");
  if (!publicKey && key.split(".").length === 3) {
    try { publicKey = JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role === "anon"; } catch { /* invalid public key */ }
  }
  if (!publicKey) throw new Error("Store builds require a publishable Supabase key, never a privileged credential.");
  return {
    ...config,
    name: config.name ?? "Seoully", slug: config.slug ?? "seoully",
    ios: { ...config.ios, bundleIdentifier },
    extra: { ...config.extra, eas: { projectId } },
    runtimeVersion: { policy: "fingerprint" },
    updates: { url: `https://u.expo.dev/${projectId}` },
  };
}
