import { useAppNavigationState } from "./useAppNavigationState";
import { onboardingTrace } from "./onboardingTrace";
import { startupTrace } from "./trace";
import { View } from "react-native";
import { ReturningWelcome } from "./ReturningWelcome";
import { useEffect, useRef } from "react";
import { Stack, useRouter } from "expo-router";
import { useCopy, useLocale } from "../locale";
import { ROOM_THEMES } from "../room/theme";
import { immersiveRoomFill } from "../ui/shellLayout";
import { SeoullyButton } from "../ui/SeoullyControls";
import { SeoullyLoadingState } from "../ui/SeoullyLoadingState";
import { SeoullyMessageScreen } from "../ui/SeoullyMessageScreen";
import { useBootstrap } from "./BootstrapProvider";
import { AUTH_ROUTE_OWNER, screensForDestination } from "./routing";

export { AUTH_ROUTE_OWNER };

export function AuthRouteTree() {
  const t = useCopy();
  const { locale } = useLocale();
  const boot = useBootstrap();
  const screens = screensForDestination(boot.destination);
  const navigation = useAppNavigationState();
  let current = navigation?.routes[navigation.index ?? 0];
  const routeNames: string[] = [];
  while (current) {
    routeNames.push(current.name);
    const child = current.state;
    current = child?.routes[child.index ?? 0] as typeof current;
  }
  const route = routeNames.join("/");
  useEffect(() => {
    onboardingTrace("guard", { route, destination: boot.destination, authenticated: boot.authenticated, checkpoint: boot.onboardingStep, intent: boot.appEntryTarget ?? "none" });
  }, [route, boot.destination, boot.authenticated, boot.onboardingStep, boot.appEntryTarget]);

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
      <SeoullyMessageScreen message={message} alert>
        <SeoullyButton label={t.retry} block multiline onPress={() => boot.refresh()} />
      </SeoullyMessageScreen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} accessibilityElementsHidden={boot.returningWelcome} importantForAccessibility={boot.returningWelcome ? "no-hide-descendants" : "auto"}>
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
    </View>
    {screens.app ? <AppEntryNavigation /> : null}
    {boot.returningWelcome ? <ReturningWelcome key={locale} displayName={boot.welcomeName} onFinished={boot.finishReturningWelcome} /> : null}
    </View>
  );
}

/** Dispatch when the root registry admits tabs. A surviving shared route need not mount tabs first. */
function AppEntryNavigation() {
  const boot = useBootstrap();
  const router = useRouter();
  const navigation = useAppNavigationState();
  const sent = useRef(false);
  const acknowledged = useRef(false);
  const activeRoute = navigation?.routes[navigation.index ?? 0];
  const appRoute = activeRoute?.name === "(tabs)" ? activeRoute : undefined;
  const appAvailable = Boolean(navigation?.key && navigation.routeNames?.includes("(tabs)"));
  const target = boot.appEntryTarget;
  const focused = appRoute?.state?.routes[appRoute.state.index ?? 0]?.name === (target === "profile" ? "profile" : "index");
  useEffect(() => {
    if (!boot.appEntryTarget) { sent.current = false; acknowledged.current = false; return; }
    onboardingTrace("app_intent", { available: appAvailable, focused: focused, intent: target ?? "none" });
    if (!appAvailable) return;
    // A queued replace is not acknowledgement: retain intent through guard reconciliation.
    if (focused) {
      if (!acknowledged.current) {
        acknowledged.current = true;
        startupTrace("profile handoff", "profile_focused");
        onboardingTrace("app_focus_ack", { route: target === "profile" ? "(tabs)/profile" : "(tabs)/index", completed: true });
        boot.consumeAppEntry();
      }
      return;
    }
    if (sent.current) return;
    sent.current = true;
    startupTrace("profile handoff", "navigation_dispatched");
    onboardingTrace("router_replace", { destination: target === "profile" ? "(tabs)/profile" : "(tabs)/index" });
    router.replace(target === "profile" ? "/(tabs)/profile" : "/(tabs)");
  }, [appAvailable, boot, focused, router, target]);
  return null;
}
