import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { loadNativeOnboarding } from "../../src/api";
import { useCopy } from "../../src/locale";
import { supabase } from "../../src/supabase";
import { colors } from "../../src/theme";
import { SeoullyTabBar } from "../../src/ui/SeoullyTabBar";
import { SeoullyText } from "../../src/ui/SeoullyText";

type Gate = "loading" | "ready" | "auth" | "onboarding" | "error";

async function resolveGate(): Promise<Gate> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return "auth";
  try {
    const onboarding = await loadNativeOnboarding();
    return onboarding.step === "done" ? "ready" : "onboarding";
  } catch {
    return "error";
  }
}

export default function TabsLayout() {
  const t = useCopy();
  const [gate, setGate] = useState<Gate>("loading");

  function checkGate() {
    setGate("loading");
    void resolveGate().then(setGate);
  }

  useEffect(() => {
    let mounted = true;
    void resolveGate().then((next) => {
      if (mounted) setGate(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (gate === "loading") {
    return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas }}><ActivityIndicator color={colors.plum} /></View>;
  }
  if (gate === "auth") return <Redirect href="/" />;
  if (gate === "onboarding") return <Redirect href="/onboarding" />;
  if (gate === "error") {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas, padding: 24 }}>
        <SeoullyText variant="secondary" color={colors.plum} style={{ textAlign: "center" }}>{t.onboardingUnavailable}</SeoullyText>
        <Pressable accessibilityRole="button" onPress={checkGate} style={{ marginTop: 18, minHeight: 44, justifyContent: "center" }}>
          <SeoullyText variant="button" color={colors.plum}>{t.retry}</SeoullyText>
        </Pressable>
      </View>
    );
  }

  return (
    <Tabs
      tabBar={(props) => <SeoullyTabBar {...props} />}
      screenOptions={{ headerShown: false, tabBarShowLabel: false }}
    >
      <Tabs.Screen name="index" options={{ title: t.feed, tabBarAccessibilityLabel: t.feed }} />
      <Tabs.Screen name="search" options={{ title: t.search, tabBarAccessibilityLabel: t.search }} />
      <Tabs.Screen name="room" options={{ href: null, title: t.room }} />
      <Tabs.Screen name="create" options={{ title: t.create, tabBarAccessibilityLabel: t.create }} />
      <Tabs.Screen name="messages" options={{ title: t.messages, tabBarAccessibilityLabel: t.messages }} />
      <Tabs.Screen name="profile" options={{ title: t.profile, tabBarAccessibilityLabel: t.profile }} />
    </Tabs>
  );
}
