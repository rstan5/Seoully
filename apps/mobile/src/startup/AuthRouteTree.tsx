import { View } from "react-native";
import { Stack } from "expo-router";
import { useCopy } from "../locale";
import { ROOM_THEMES } from "../room/theme";
import { colors } from "../theme";
import { immersiveRoomFill } from "../ui/shellLayout";
import { SeoullyButton } from "../ui/SeoullyControls";
import { SeoullyLoadingState } from "../ui/SeoullyLoadingState";
import { SeoullyScreen } from "../ui/SeoullyScreen";
import { SeoullyText } from "../ui/SeoullyText";
import { useBootstrap } from "./BootstrapProvider";
import { AUTH_ROUTE_OWNER, screensForDestination } from "./routing";

export { AUTH_ROUTE_OWNER };

export function AuthRouteTree() {
  const t = useCopy();
  const boot = useBootstrap();
  const screens = screensForDestination(boot.destination);

  if (boot.destination === "loading") {
    return <SeoullyLoadingState fullScreen label={t.brand} />;
  }

  if (boot.destination === "error") {
    const message = boot.errorKind === "config"
      ? t.startupConfigInvalid
      : boot.errorKind === "auth"
        ? t.startupAuthFailed
        : boot.errorKind === "api"
          ? t.startupApiFailed
          : t.startupOnboardingFailed;
    return (
      <SeoullyScreen>
        <View style={{ flex: 1, gap: 16, justifyContent: "center", paddingHorizontal: 16 }}>
          <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum} style={{ textAlign: "center" }}>
            {message}
          </SeoullyText>
          <SeoullyButton label={t.retry} block onPress={() => boot.refresh()} />
        </View>
      </SeoullyScreen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Protected guard={screens.welcome}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={screens.onboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={screens.app}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="binder" />
        <Stack.Screen name="collection" />
        <Stack.Screen name="collector-room" options={{ contentStyle: immersiveRoomFill(ROOM_THEMES.hearth.void), gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="public-collectible" />
        <Stack.Screen name="room" options={{ contentStyle: immersiveRoomFill(ROOM_THEMES.hearth.void), gestureEnabled: false, fullScreenGestureEnabled: false }} />
        <Stack.Screen name="thread" />
      </Stack.Protected>
      <Stack.Protected guard={screens.shared}>
        <Stack.Screen name="add" />
        <Stack.Screen name="collect" />
        <Stack.Screen name="collectible" />
      </Stack.Protected>
    </Stack>
  );
}
