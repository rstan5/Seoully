import { useEffect } from "react";
import { View } from "react-native";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SeoullyLoadingHost } from "../src/ui/SeoullyLoadingState";
import { FontProvider } from "../src/fonts";
import { DataModeProvider } from "../src/data";
import { LocaleProvider } from "../src/locale";
import { supabase } from "../src/supabase";
import { createCallbackHandler } from "../src/auth/callback";
import { AuthRouteTree } from "../src/startup/AuthRouteTree";
import { BootstrapProvider } from "../src/startup/BootstrapProvider";
import { GlobalLanguageControl, LanguageControlProvider } from "../src/ui/GlobalLanguageControl";
import { ProfileIdentityScope } from "../src/ui/ProfileIdentity";
import { SeoullyCompanionHost } from "../src/ui/SeoullyCompanionHost";

export default function RootLayout() {
  useEffect(() => {
    const callback = createCallbackHandler((code, options) => supabase.auth.exchangeCodeForSession(code, options));
    void Linking.getInitialURL().then(url => callback.handle(url)).catch(() => {});
    const subscription = Linking.addEventListener("url", ({ url }) => { void callback.handle(url); });
    return () => { callback.dispose(); subscription.remove(); };
  }, []);
  return (
    <SafeAreaProvider>
      <SeoullyLoadingHost>
      <LocaleProvider>
        <DataModeProvider>
          <FontProvider>
            <StatusBar style="dark" />
            <View style={{ flex: 1 }}>
              <BootstrapProvider>
                <ProfileIdentityScope>
                  <LanguageControlProvider>
                    <AuthRouteTree />
                    <SeoullyCompanionHost />
                    <GlobalLanguageControl />
                  </LanguageControlProvider>
                </ProfileIdentityScope>
              </BootstrapProvider>
            </View>
          </FontProvider>
        </DataModeProvider>
      </LocaleProvider>
      </SeoullyLoadingHost>
    </SafeAreaProvider>
  );
}
