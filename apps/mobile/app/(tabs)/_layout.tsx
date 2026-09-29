import { Tabs } from "expo-router";
import { useCopy } from "../../src/locale";
import { SeoullyTabBar } from "../../src/ui/SeoullyTabBar";

export default function TabsLayout() {
  const t = useCopy();
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
      <Tabs.Screen name="notices" options={{ href: null, title: t.notices }} />
      <Tabs.Screen name="send-to" options={{ href: null, title: t.sendTo }} />
    </Tabs>
  );
}
