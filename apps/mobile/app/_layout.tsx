import { useEffect } from "react";
import { Stack } from "expo-router";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { LocaleProvider } from "../src/locale";
import { supabase } from "../src/supabase";

export default function RootLayout() {
  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url || !url.includes("code=")) return;
      try {
        await supabase.auth.exchangeCodeForSession(url);
      } catch {
        return;
      }
    }
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => { void handleUrl(url); });
    return () => subscription.remove();
  }, []);
  return (
    <LocaleProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </LocaleProvider>
  );
}
