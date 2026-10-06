import { Baloo2_400Regular } from "@expo-google-fonts/baloo-2/400Regular";
import { Baloo2_600SemiBold } from "@expo-google-fonts/baloo-2/600SemiBold";
import { Baloo2_700Bold } from "@expo-google-fonts/baloo-2/700Bold";
import { NotoSansKR_400Regular } from "@expo-google-fonts/noto-sans-kr/400Regular";
import { NotoSansKR_600SemiBold } from "@expo-google-fonts/noto-sans-kr/600SemiBold";
import { NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr/700Bold";
import { useFonts } from "expo-font";
import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { colors } from "./theme";

export function FontProvider({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts({
    DancingScript: require("../assets/fonts/DancingScript.ttf"),
    Baloo2_400Regular,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    NotoSansKR_400Regular,
    NotoSansKR_600SemiBold,
    NotoSansKR_700Bold,
  });
  if (!loaded && !error) {
    return <View style={{ backgroundColor: colors.canvas, flex: 1 }} />;
  }
  return children;
}
