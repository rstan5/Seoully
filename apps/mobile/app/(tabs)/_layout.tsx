import { Tabs } from "expo-router";
import { copy } from "../../src/i18n";
import { colors } from "../../src/theme";

export default function TabsLayout() {
  const t = copy();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.plum, tabBarInactiveTintColor: colors.muted, tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border } }}>
    <Tabs.Screen name="index" options={{ title: t.feed }} />
    <Tabs.Screen name="search" options={{ title: t.search }} />
    <Tabs.Screen name="create" options={{ title: t.create }} />
    <Tabs.Screen name="messages" options={{ title: t.messages }} />
    <Tabs.Screen name="profile" options={{ title: t.profile }} />
  </Tabs>;
}
