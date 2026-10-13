import { useEffect, useState } from "react";
import { Animated, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveNativeIdentity, type NativeIdentity } from "../api";
import { useCopy } from "../locale";
import { colors } from "../theme";
import { HeartGreeting } from "../ui/HeartGreeting";
import { useBlockingLoadingActive } from "../ui/SeoullyLoadingState";
import { useMotionPreference } from "../ui/motion";
import { withTimeout } from "./eligibility";

/** The real feed hydrates behind this opaque presentation surface. */
export function ReturningWelcome({ onFinished }: { onFinished: () => void }) {
  const copy = useCopy();
  const blocked = useBlockingLoadingActive();
  const reduced = useMotionPreference();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [name, setName] = useState<string | null>(null);
  const [typed, setTyped] = useState(false);
  const [held, setHeld] = useState(false);
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    let live = true;
    // A missing/slow optional identity read never stalls session restoration.
    void withTimeout(resolveNativeIdentity<NativeIdentity>(), 1200, "optional_identity_timeout")
      .then(identity => { if (live) setName(identity?.user.displayName?.trim() ?? ""); })
      .catch(() => { if (live) setName(""); });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    if (!typed || blocked) return;
    const timer = setTimeout(() => setHeld(true), 2000);
    return () => clearTimeout(timer);
  }, [blocked, typed]);
  useEffect(() => {
    if (!held || blocked || reduced === null) return;
    const animation = Animated.timing(opacity, { toValue: 0, duration: reduced ? 0 : 350, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) onFinished(); });
    return () => animation.stop();
  }, [blocked, held, onFinished, opacity, reduced]);
  const text = name ? copy.returningWelcomeNamed.replace("{name}", name) : copy.returningWelcome;
  const size = width < 360 || (name?.length ?? 0) > 60 ? 36 : 42;
  return <Animated.View style={[styles.cover, { opacity }]}>
    <ScrollView bounces={false} contentContainerStyle={[styles.center, { paddingVertical: Math.max(insets.top, insets.bottom, 24), paddingHorizontal: Math.max(insets.left, insets.right, 24) }]}>
      {name !== null && !blocked ? <HeartGreeting key={text} text={text} large showHeart={false} inlineHeart interactive={false} textStyle={{ fontSize: size, lineHeight: size * 49 / 42 }} onTypingComplete={() => setTyped(true)} /> : null}
    </ScrollView>
  </Animated.View>;
}
const styles = StyleSheet.create({
  cover: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.canvas, zIndex: 10 },
  center: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
});
