import { useEffect, useState } from "react";
import { Animated, AppState, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCopy } from "../locale";
import { colors } from "../theme";
import { HeartGreeting } from "../ui/HeartGreeting";
import { useBlockingLoadingActive } from "../ui/SeoullyLoadingState";
import { useMotionPreference } from "../ui/motion";
import { usePausedCountdown } from "../ui/usePausedCountdown";
import { startupTrace } from "./trace";

/** The real feed hydrates behind this opaque presentation surface. */
export function ReturningWelcome({ onFinished, displayName = "" }: { onFinished: () => void; displayName?: string }) {
  const copy = useCopy();
  const blocked = useBlockingLoadingActive();
  const reduced = useMotionPreference();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Freeze the authenticated startup Profile snapshot for the whole reveal.
  const [name] = useState(() => displayName.trim());
  const [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [typed, setTyped] = useState(false);
  const [held, setHeld] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    startupTrace("welcome identity", name ? "startup_profile" : "missing");
    const sub = AppState.addEventListener("change", state => setActive(state === "active"));
    return () => sub.remove();
  }, [name]);
  usePausedCountdown(2000, typed && !blocked && active, "welcome-hold", () => setHeld(true));
  useEffect(() => {
    if (!held || blocked || !active || reduced === null) return;
    const animation = Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 350, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) onFinished(); });
    return () => animation.stop();
  }, [active, blocked, held, onFinished, opacity, reduced]);
  const text = name ? copy.returningWelcomeNamed.replace("{name}", name) : copy.returningWelcome;
  const size = width < 360 || (name?.length ?? 0) > 60 ? 36 : 42;
  return <Animated.View style={[styles.cover, { opacity }]}>
    <ScrollView bounces={false} contentContainerStyle={[styles.center, { paddingVertical: Math.max(insets.top, insets.bottom, 24), paddingHorizontal: Math.max(insets.left, insets.right, 24) }]}>
      <HeartGreeting key={text} text={text} large showHeart={false} inlineHeart interactive={false} active={active && !blocked} textStyle={{ fontSize: size, lineHeight: size * 49 / 42 }} onTypingComplete={() => { startupTrace("welcome typing", "complete"); setTyped(true); }} />
    </ScrollView>
  </Animated.View>;
}
const styles = StyleSheet.create({
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.canvas, zIndex: 10 },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
});
