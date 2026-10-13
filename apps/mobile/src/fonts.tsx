import { Baloo2_400Regular } from "@expo-google-fonts/baloo-2/400Regular";
import { Baloo2_600SemiBold } from "@expo-google-fonts/baloo-2/600SemiBold";
import { Baloo2_700Bold } from "@expo-google-fonts/baloo-2/700Bold";
import { NotoSansKR_400Regular } from "@expo-google-fonts/noto-sans-kr/400Regular";
import { NotoSansKR_600SemiBold } from "@expo-google-fonts/noto-sans-kr/600SemiBold";
import { NotoSansKR_700Bold } from "@expo-google-fonts/noto-sans-kr/700Bold";
import { useFonts } from "expo-font";
import type { PropsWithChildren } from "react";
import { SeoullyLoadingState } from "./ui/SeoullyLoadingState";

export function FontProvider({ children }: PropsWithChildren) {
  const [loaded, error] = useFonts({
    SeoullyHeartBaloo2400: require("../../../public/fonts/inline-heart/SeoullyHeartBaloo2400.ttf"),
    SeoullyHeartBaloo2600: require("../../../public/fonts/inline-heart/SeoullyHeartBaloo2600.ttf"),
    SeoullyHeartBaloo2700: require("../../../public/fonts/inline-heart/SeoullyHeartBaloo2700.ttf"),
    SeoullyHeartNotoSansKR400: require("../../../public/fonts/inline-heart/SeoullyHeartNotoSansKR400.ttf"),
    SeoullyHeartNotoSansKR600: require("../../../public/fonts/inline-heart/SeoullyHeartNotoSansKR600.ttf"),
    SeoullyHeartNotoSansKR700: require("../../../public/fonts/inline-heart/SeoullyHeartNotoSansKR700.ttf"),
    DancingScript: require("../assets/fonts/DancingScript.ttf"),
    Baloo2_400Regular,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    NotoSansKR_400Regular,
    NotoSansKR_600SemiBold,
    NotoSansKR_700Bold,
  });
  if (!loaded && !error) {
    return <SeoullyLoadingState fullScreen label="Seoully" />;
  }
  return children;
}
