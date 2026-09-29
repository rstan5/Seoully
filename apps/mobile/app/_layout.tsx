import { useEffect } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { FontProvider } from "../src/fonts";
import { DataModeProvider } from "../src/data";
import { LocaleProvider } from "../src/locale";
import { supabase } from "../src/supabase";
import { AuthRouteTree } from "../src/startup/AuthRouteTree";
import { BootstrapProvider } from "../src/startup/BootstrapProvider";
import { SeoullyCompanion } from "../src/ui/SeoullyCompanion";

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
    <SafeAreaProvider>
      <LocaleProvider>
        <DataModeProvider>
          <FontProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1 }}>
              <BootstrapProvider>
                <AuthRouteTree />
                <SeoullyCompanion />
              </BootstrapProvider>
            </View>
          </FontProvider>
        </DataModeProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
