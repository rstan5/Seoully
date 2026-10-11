import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HeartGreeting } from "./HeartGreeting";
import { SeoullyButton } from "./SeoullyControls";
import { companionPlacement, chrome } from "./shellLayout";
import { useReduceMotion } from "./motion";

/** Runs only after persisted completion. Hands off to the existing corner companion. */
export function HeartFarewell({ text, label, onContinue }: { text: string; label: string; onContinue: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReduceMotion(true);
  const [travel] = useState(() => new Animated.Value(0));
  const [contentHeight, setContentHeight] = useState(0);
  const departing = useRef(false);
  useEffect(() => () => travel.stopAnimation(), [travel]);
  const corner = companionPlacement({ insets, hasBottomNav: true });
  const originY = height * 0.42;
  function leave() {
    if (departing.current) return;
    departing.current = true;
    if (reduced) { onContinue(); return; }
    Animated.timing(travel, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => { if (finished) onContinue(); });
  }
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
    <Animated.View onLayout={event => setContentHeight(event.nativeEvent.layout.height)} style={{ position: "absolute", top: originY, width: 280, left: width / 2 - 140, transform: [
      { translateX: travel.interpolate({ inputRange: [0, 1], outputRange: [0, width / 2 - corner.right - chrome.companionSize / 2] }) },
      { translateY: travel.interpolate({ inputRange: [0, 1], outputRange: [0, height - corner.bottom - chrome.companionSize / 2 - originY - contentHeight / 2 - (chrome.companionSize / 76) * (38 - contentHeight / 2)] }) },
      { scale: travel.interpolate({ inputRange: [0, 1], outputRange: [1, chrome.companionSize / 76] }) },
    ], opacity: travel.interpolate({ inputRange: [0, 0.9, 1], outputRange: [1, 1, 0] }) }}>
      <HeartGreeting text={text} onContinue={leave} />
      <SeoullyButton label={label} variant="ghost" onPress={leave} />
    </Animated.View>
  </View>;
}
