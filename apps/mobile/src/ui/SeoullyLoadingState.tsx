import { onboardingTrace } from "../startup/onboardingTrace";
import { heartMotion, loadingHeartHalfCycleMs } from "./heartMotion";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { useReduceMotion } from "./motion";

const LoadingActive = createContext(false);
export const useBlockingLoadingActive = () => useContext(LoadingActive);

const LoadingHost = createContext<{ show: (label: string) => () => void } | null>(null);

/** One root overlay covers navigation chrome without native modal presentation changes. */
export function SeoullyLoadingHost({ children }: PropsWithChildren) {
  const [loads, setLoads] = useState<Map<symbol, string>>(() => new Map());
  const show = useCallback((label: string) => {
    const key = Symbol();
    setLoads((current) => new Map(current).set(key, label));
    return () => setLoads((current) => { const next = new Map(current); next.delete(key); return next; });
  }, []);
  const host = useMemo(() => ({ show }), [show]);
  const label = [...loads.values()].at(-1);
  const blocked = Boolean(label);
  useEffect(() => { onboardingTrace("blocking_overlay", { overlay: blocked }); }, [blocked]);
  return <LoadingHost.Provider value={host}><LoadingActive.Provider value={!!label}>
    <View style={styles.wrap}>
      <View style={styles.content} pointerEvents={label ? "none" : "auto"} accessibilityElementsHidden={!!label} importantForAccessibility={label ? "no-hide-descendants" : "auto"}>{children}</View>
      {label ? <View style={styles.overlay}><HeartLoadingSurface label={label} /></View> : null}
    </View>
  </LoadingActive.Provider></LoadingHost.Provider>;
}

/** Full-screen use is only for blocking hydration; inline use leaves current content interactive. */
export function SeoullyLoadingState({ label, fullScreen = false }: { label: string; fullScreen?: boolean }) {
  const host = useContext(LoadingHost);
  useLayoutEffect(() => fullScreen && host ? host.show(label) : undefined, [fullScreen, host, label]);
  return fullScreen && host ? <View style={styles.wrap} /> : <HeartLoadingSurface label={label} />;
}

function HeartLoadingSurface({ label }: { label: string }) {
  // Stay still until the accessibility preference has been read.
  const reduceMotion = useReduceMotion(true);
  const [float] = useState(() => new Animated.Value(0));
  useEffect(() => {
    float.setValue(0);
    if (reduceMotion) return;
    const hover = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: loadingHeartHalfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(float, { toValue: 0, duration: loadingHeartHalfCycleMs, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
    ]));
    hover.start();
    return () => { hover.stop(); float.stopAnimation(); };
  }, [float, reduceMotion]);

  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityState={{ busy: true }} style={styles.wrap}>
    <Animated.View style={{ transform: [{ translateY: reduceMotion ? 0 : float.interpolate({ inputRange: [0, 1], outputRange: [heartMotion.travel / 2, -heartMotion.travel / 2] }) }] }}>
      <Image accessibilityIgnoresInvertColors accessible={false} resizeMode="contain" source={require("../../assets/brand/seoully-heart-mark.png")} style={styles.heart} />
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  content: { flex: 1, alignSelf: "stretch" },
  overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, elevation: 100 },
  heart: { width: 76, height: 76 },
});
