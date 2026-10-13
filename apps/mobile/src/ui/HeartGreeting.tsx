import { useEffect, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet } from "react-native";
import { SeoullyText } from "./SeoullyText";
import { useMotionPreference } from "./motion";
import { heartMotion } from "./heartMotion";

/** Companion speech, never a loading delay. Tap reveals the whole sentence. */
export function HeartGreeting({ text, large = false, showHeart = true, inlineHeart = false, onContinue }: { text: string; large?: boolean; showHeart?: boolean; inlineHeart?: boolean; onContinue?: () => void }) {
  const reduced = useMotionPreference();
  const [count, setCount] = useState(0);
  const [hover] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced !== false) return;
    const timer = setInterval(() => setCount(n => { const next = Math.min(text.length, n + 1); if (next === text.length) clearInterval(timer); return next; }), heartMotion.characterMs);
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(hover, { toValue: 1, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(hover, { toValue: 0, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => { clearInterval(timer); animation.stop(); hover.stopAnimation(); };
  }, [hover, reduced, text]);
  const shown = reduced ? text.length : count;
  return <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={() => { if (shown < text.length) setCount(text.length); else onContinue?.(); }} style={[styles.wrap, reduced === null && { opacity: 0 }]}>
    {showHeart ? <Animated.View style={{ transform: [{ translateY: reduced ? 0 : hover.interpolate({ inputRange: [0, 1], outputRange: [heartMotion.travel / 2, -heartMotion.travel / 2] }) }] }}>
      <Image accessible={false} source={require("../../assets/brand/seoully-heart-mark.png")} resizeMode="contain" style={{ width: large ? 128 : 76, height: large ? 128 : 76 }} />
    </Animated.View> : null}
    <SeoullyText variant="title" style={[styles.text, large && styles.large]}>{text.slice(0, shown)}<SeoullyText style={{ opacity: 0 }}>{text.slice(shown)}</SeoullyText>{inlineHeart ? <SeoullyText style={[styles.inlineHeart, { opacity: shown >= text.length ? 1 : 0 }]}> ♡</SeoullyText> : null}</SeoullyText>
  </Pressable>;
}
const styles = StyleSheet.create({ wrap: { alignItems: "center", gap: 32 }, text: { textAlign: "center" }, inlineHeart: { fontSize: 30, lineHeight: 49 }, large: { fontSize: 42, lineHeight: 49, letterSpacing: -1.2 } });
