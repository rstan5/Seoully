import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, Pressable, StyleSheet, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme";
import { SeoullyText } from "./SeoullyText";
import { companionPlacement, chrome } from "./shellLayout";
import { useMotionPreference } from "./motion";
import { heartMotion } from "./heartMotion";
import { advanceHeartScene, heartSceneTiming, type HeartSceneState } from "./heartScene";

/** Opaque character scene between stages; never completes production onboarding. */
export function HeartFarewell({ text, ready = true, onContinue, destination = "corner" }: { text: string; ready?: boolean; onContinue: () => void; destination?: "corner" | "next" }) {
  const reduced = useMotionPreference();
  if (reduced === null) return <Pressable style={styles.cover} />;
  return <HeartScene key={String(reduced)} text={text} ready={ready} onContinue={onContinue} reduced={reduced} destination={destination} />;
}

function HeartScene({ text, ready, onContinue, reduced, destination = "corner" }: { text: string; ready: boolean; onContinue: () => void; reduced: boolean; destination?: "corner" | "next" }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const chars = useMemo(() => Array.from(text), [text]);
  const [scene, setScene] = useState<HeartSceneState>({ stage: reduced ? "reading" : "enter", count: reduced ? chars.length : 0 });
  const [journey] = useState(() => new Animated.Value(reduced ? 0 : -1));
  const [bubble] = useState(() => new Animated.Value(reduced ? 1 : 0));
  const [hover] = useState(() => new Animated.Value(0));
  const [bubbleHeight, setBubbleHeight] = useState(140);
  const finished = useRef(false);
  const send = (event: Parameters<typeof advanceHeartScene>[1]) => setScene(state => reduced && (event === "tap" || event === "readEnd") ? { ...state, stage: "waiting" } : advanceHeartScene(state, event, chars.length));
  const corner = companionPlacement({ insets, hasBottomNav: false });
  const heartSize = Math.min(112, width * 0.3);
  const bubbleWidth = Math.min(300, width - 48);
  const originY = Math.min(height - insets.bottom - heartSize - 20, Math.max(height * 0.46, insets.top + bubbleHeight + 24));

  const departing = scene.stage === "exit" || scene.stage === "waiting";
  useEffect(() => {
    if (reduced) return;
    if (departing) {
      const settle = Animated.timing(hover, { toValue: 0, duration: heartSceneTiming.exit, useNativeDriver: true });
      settle.start();
      return () => settle.stop();
    }
    const floating = Animated.loop(Animated.sequence([
      Animated.timing(hover, { toValue: 1, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(hover, { toValue: 0, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    floating.start();
    return () => { floating.stop(); hover.stopAnimation(); };
  }, [bubble, chars.length, departing, hover, journey, reduced]);

  useEffect(() => {
    const stage = scene.stage;
    if (stage === "waiting") return;
    if (stage === "typing") {
      const timer = setInterval(() => setScene(state => advanceHeartScene(state, "tick", chars.length)), heartSceneTiming.character);
      return () => clearInterval(timer);
    }
    if (stage === "reading") {
      journey.setValue(0); bubble.setValue(1);
      const timer = setTimeout(() => setScene(state => reduced ? { ...state, stage: "waiting" } : advanceHeartScene(state, "readEnd", chars.length)), heartSceneTiming.reading);
      return () => clearTimeout(timer);
    }
    const value = stage === "enter" || stage === "exit" ? journey : bubble;
    const target = stage === "enter" || stage === "retract" ? 0 : 1;
    const duration = stage === "enter" ? heartSceneTiming.entrance : stage === "exit" ? heartSceneTiming.exit : stage === "retract" ? heartSceneTiming.retract : heartSceneTiming.bubble;
    const animation = Animated.timing(value, { toValue: target, duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: true });
    animation.start(({ finished: done }) => { if (done) setScene(state => advanceHeartScene(state, "motionEnd", chars.length)); });
    return () => animation.stop();
  }, [bubble, chars.length, journey, reduced, scene.stage]);
  useEffect(() => {
    if (scene.stage !== "waiting" || !ready || finished.current) return;
    finished.current = true;
    onContinue();
  }, [onContinue, ready, scene.stage]);
  useEffect(() => () => { journey.stopAnimation(); bubble.stopAnimation(); }, [bubble, journey]);

  return <Pressable accessibilityRole="button" accessibilityLabel={text} onPress={() => send("tap")} style={styles.cover}>
    <Animated.View style={{ opacity: reduced === null ? 0 : 1, position: "absolute", top: originY, left: width / 2 - heartSize / 2, width: heartSize,
      transform: [
        { translateX: reduced ? 0 : journey.interpolate({ inputRange: [-1, 0, 1], outputRange: [width, 0, destination === "next" ? -width : width / 2 - corner.right - (chrome.companionSize + 8) / 2] }) },
        { translateY: reduced ? 0 : journey.interpolate({ inputRange: [-1, -0.5, 0, 1], outputRange: [36, -12, 0, destination === "next" ? 0 : height - corner.bottom - chrome.companionSize / 2 - originY - heartSize / 2] }) },
        { scale: reduced ? 1 : journey.interpolate({ inputRange: [-1, 0, 1], outputRange: [0.9, 1, destination === "next" ? 0.9 : chrome.companionSize / heartSize] }) },
      ] }}>
      <Animated.View style={{ transform: [{ translateY: reduced ? 0 : hover.interpolate({ inputRange: [0, 1], outputRange: [0, -heartMotion.travel] }) }] }}>
        <Image accessible={false} source={require("../../assets/brand/seoully-heart-mark.png")} resizeMode="contain" style={{ width: heartSize, height: heartSize }} />
        <Animated.View onLayout={event => setBubbleHeight(event.nativeEvent.layout.height)} style={[styles.bubble, { width: bubbleWidth, left: (heartSize - bubbleWidth) / 2, bottom: heartSize + 6,
          opacity: bubble, transform: [{ translateY: bubbleHeight / 2 + heartSize / 2 + 6 }, { scale: bubble }, { translateY: -bubbleHeight / 2 - heartSize / 2 - 6 }] }]}>
          <SeoullyText variant="secondary" style={styles.speech}>{chars.slice(0, reduced ? chars.length : scene.count).join("")}<SeoullyText variant="secondary" style={[styles.speech, { opacity: 0 }]}>{chars.slice(reduced ? chars.length : scene.count).join("")}</SeoullyText></SeoullyText>
          <Animated.View style={styles.tail} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  </Pressable>;
}
const styles = StyleSheet.create({
  cover: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: colors.canvas, zIndex: 50 },
  bubble: { position: "absolute", borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 12, shadowColor: colors.ink, shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  speech: { color: colors.ink, fontSize: 16, lineHeight: 23, textAlign: "center" },
  tail: { position: "absolute", bottom: -7, left: "50%", marginLeft: -6, width: 12, height: 12, backgroundColor: colors.surface, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.border, transform: [{ rotate: "45deg" }] },
});
