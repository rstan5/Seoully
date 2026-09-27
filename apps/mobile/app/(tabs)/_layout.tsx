import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Redirect, Tabs } from "expo-router";
import { loadNativeOnboarding } from "../../src/api";
import { useCopy } from "../../src/locale";
import { supabase } from "../../src/supabase";
import { colors } from "../../src/theme";

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
        <Text style={{ color: colors.plum, textAlign: "center" }}>{t.onboardingUnavailable}</Text>
        <Pressable accessibilityRole="button" onPress={checkGate} style={{ marginTop: 18, minHeight: 44, justifyContent: "center" }}>
          <Text style={{ color: colors.plum, fontWeight: "700" }}>{t.retry}</Text>
        </Pressable>
      </View>
    );
  }

  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.plum, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border } }}>
    <Tabs.Screen name="index" options={{ title: t.feed }} />
    <Tabs.Screen name="search" options={{ title: t.search }} />
    <Tabs.Screen name="create" options={{ title: t.create }} />
    <Tabs.Screen name="messages" options={{ title: t.messages }} />
    <Tabs.Screen name="profile" options={{ title: t.profile }} />
  </Tabs>;
}
