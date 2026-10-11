import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartGreeting } from "./HeartGreeting";
import { companionPlacement, chrome } from "./shellLayout";
import { useMotionPreference } from "./motion";
import { heartMotion } from "./heartMotion";

/** One companion travels from its corner, speaks, then returns. Never grants progress. */
export function HeartFarewell({ text, onContinue }: { text: string; onContinue: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useMotionPreference();
  const [travel] = useState(() => new Animated.Value(1));
  const [hover] = useState(() => new Animated.Value(0));
  const departing = useRef(false);
  const corner = companionPlacement({ insets, hasBottomNav: false });
  const originY = height * 0.38;
  useEffect(() => {
    if (reduced === null) return;
    if (reduced) { travel.setValue(0); return; }
    const entrance = Animated.timing(travel, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(hover, { toValue: 1, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(hover, { toValue: 0, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    entrance.start(); floating.start();
    return () => { entrance.stop(); floating.stop(); travel.stopAnimation(); hover.stopAnimation(); };
  }, [hover, reduced, travel]);
  function leave() {
    if (departing.current) return;
    departing.current = true;
    if (reduced) { onContinue(); return; }
    Animated.timing(travel, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onContinue(); });
  }
  return <View style={[StyleSheet.absoluteFill, reduced === null && { opacity: 0 }]}>
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: originY, left: width / 2 - 38, transform: [
      { translateX: reduced ? 0 : travel.interpolate({ inputRange: [0, 1], outputRange: [0, width / 2 - corner.right - (chrome.companionSize + 8) / 2] }) },
      { translateY: reduced ? 0 : travel.interpolate({ inputRange: [0, 1], outputRange: [0, height - corner.bottom - chrome.companionSize / 2 - originY - 38] }) },
      { scale: reduced ? 1 : travel.interpolate({ inputRange: [0, 1], outputRange: [1, chrome.companionSize / 76] }) },
    ] }}>
      <Animated.View style={{ transform: [{ translateY: reduced ? 0 : hover.interpolate({ inputRange: [0, 1], outputRange: [0, -heartMotion.travel] }) }] }}>
        <Image accessible={false} source={require("../../assets/brand/seoully-heart-mark.png")} resizeMode="contain" style={{ width: 76, height: 76 }} />
      </Animated.View>
    </Animated.View>
    <Animated.View style={{ position: "absolute", top: originY + 104, left: 32, right: 32, opacity: reduced ? 1 : travel.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }}>
      <HeartGreeting showHeart={false} text={text} onContinue={leave} />
    </Animated.View>
  </View>;
}
