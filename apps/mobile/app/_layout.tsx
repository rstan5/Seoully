import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LocaleProvider } from "../src/locale";

export default function RootLayout() {
  return (
    <LocaleProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </LocaleProvider>
  );
}
