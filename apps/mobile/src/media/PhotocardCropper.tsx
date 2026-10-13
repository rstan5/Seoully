import { topHeaderMetrics, topHeaderRow } from "../ui/shellLayout";
import { useLanguageControlWidth, LanguageModal } from "../ui/GlobalLanguageControl";
import { PHOTOCARD } from "./photocard";
/* eslint-disable react-hooks/refs -- Gesture refs are read and written only inside PanResponder callbacks. */
import { useCallback, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { constrainCrop, cropRectangle, pinchCrop, type CropTransform } from "./cropGeometry";
import { colors, spacing } from "../theme";
import { SeoullyText } from "../ui/SeoullyText";

const CARD_RATIO = PHOTOCARD.aspect;

export type CropRect = { originX: number; originY: number; width: number; height: number };
type Asset = { uri: string; width: number; height: number };
type Transform = { x: number; y: number; zoom: number };

export function PhotocardCropper({
  asset,
  title,
  hint,
  useLabel,
  backLabel,
  zoomInLabel,
  zoomOutLabel,
  onUse,
  onCancel,
  busy = false,
  errorLabel,
  retryLabel,
}: {
  asset: Asset | null;
  title: string;
  hint: string;
  useLabel: string;
  backLabel: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  onUse: (crop: CropRect) => void;
  onCancel: () => void;
  busy?: boolean;
  errorLabel?: string;
  retryLabel?: string;
}) {
  const [area, setArea] = useState({ width: 0, height: 0 });
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">("loading");
  const [decodeAttempt, setDecodeAttempt] = useState(0);
  const measured = area.width > 0 && area.height > 0;
  const viewportWidth = Math.max(1, Math.min(330, area.width, area.height * CARD_RATIO));
  const viewportHeight = viewportWidth / CARD_RATIO;
  const header = topHeaderMetrics(useWindowDimensions().fontScale);
  const languageWidth = useLanguageControlWidth();
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, zoom: 1 });
  const current = useRef<CropTransform>({ x: 0, y: 0, zoom: 1 });
  const session = useRef<{ count: number; origin: CropTransform; point: { x: number; y: number }; distance: number } | null>(null);
  const frame = useRef<View>(null);
  const frameOrigin = useRef({ x: 0, y: 0 });
  const measureFrame = () => frame.current?.measureInWindow((x, y) => { frameOrigin.current = { x, y }; });
  const commit = useCallback((next: CropTransform) => {
    if (!asset) return;
    const value = constrainCrop(next, asset.width, asset.height, viewportWidth);
    current.current = value;
    setTransform(value);
  }, [asset, viewportWidth]);
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches;
      if (!touches.length) { session.current = null; return; }
      const point = touches.length > 1 ? midpoint(touches[0]!, touches[1]!) : { x: touches[0]!.pageX, y: touches[0]!.pageY };
      session.current = { count: Math.min(2, touches.length), origin: current.current,
        point: { x: point.x - frameOrigin.current.x - viewportWidth / 2, y: point.y - frameOrigin.current.y - viewportHeight / 2 },
        distance: touches.length > 1 ? distance(touches[0]!, touches[1]!) : 0 };
    },
    onPanResponderMove: (event) => {
      const touches = event.nativeEvent.touches;
      if (!touches.length) return;
      const point = touches.length > 1 ? midpoint(touches[0]!, touches[1]!) : { x: touches[0]!.pageX, y: touches[0]!.pageY };
      const relative = { x: point.x - frameOrigin.current.x - viewportWidth / 2, y: point.y - frameOrigin.current.y - viewportHeight / 2 };
      const count = Math.min(2, touches.length);
      const previous = session.current;
      if (!previous || previous.count !== count) {
        session.current = { count, origin: current.current, point: relative, distance: count === 2 ? distance(touches[0]!, touches[1]!) : 0 };
        return;
      }
      if (count === 2 && previous.distance > 0) commit(pinchCrop(previous.origin, distance(touches[0]!, touches[1]!) / previous.distance, previous.point, relative));
      else commit({ ...previous.origin, x: previous.origin.x + relative.x - previous.point.x, y: previous.origin.y + relative.y - previous.point.y });
    },
    onPanResponderRelease: () => { session.current = null; },
    onPanResponderTerminate: () => { session.current = null; },
  }), [commit, viewportHeight, viewportWidth]);

  if (!asset) return null;
  const baseScale = Math.max(viewportWidth / asset.width, viewportHeight / asset.height);
  const visible = constrainCrop(transform, asset.width, asset.height, viewportWidth);
  // Decode once at the maximum supported zoom. Gestures change transforms,
  // never the native decode target; do not mount a one-point thumbnail first.
  const displayWidth = asset.width * baseScale * 3;
  const displayHeight = asset.height * baseScale * 3;
  const adjustZoom = (delta: number) => commit({ ...current.current, zoom: current.current.zoom + delta });
  const useCrop = () => { if (busy || imageState !== "ready" || !measured) return; onUse(cropRectangle(current.current, asset.width, asset.height, viewportWidth)); };

  return <LanguageModal languageInk={colors.ink} animationType="slide" visible onRequestClose={() => { if (!busy) onCancel(); }}>
    <SafeAreaView edges={["top", "bottom"]} style={styles.screen}>
      <View style={[topHeaderRow, { minHeight: header.height, width: "100%", paddingRight: languageWidth + 18 }]}><SeoullyText control variant="title" style={{ flexShrink: 1 }}>{title}</SeoullyText></View>
      <SeoullyText variant="secondary" style={styles.hint}>{hint}</SeoullyText>
      <View style={styles.cropArea} onLayout={event => setArea(event.nativeEvent.layout)}>
      <View ref={frame} onLayout={measureFrame} {...panResponder.panHandlers} style={[styles.viewport, { width: viewportWidth, height: viewportHeight }]}>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}>{measured ? <Image key={`${asset.uri}:${viewportWidth}:${decodeAttempt}`} source={{ uri: asset.uri }} resizeMode="contain"
          onLoadStart={() => setImageState("loading")} onLoad={() => setImageState("ready")} onError={() => setImageState("error")}
          style={{ position: "absolute", width: displayWidth, height: displayHeight, left: (viewportWidth - displayWidth) / 2, top: (viewportHeight - displayHeight) / 2,
            transform: [{ translateX: visible.x }, { translateY: visible.y }, { scale: visible.zoom / 3 }] }} /> : null}</View>
        <View pointerEvents="none" style={styles.frame} />
      </View>
      </View>
      {imageState === "error" ? <View>
        <SeoullyText accessibilityRole="alert">{errorLabel}</SeoullyText>
        <Pressable accessibilityRole="button" onPress={() => { setImageState("loading"); setDecodeAttempt(n => n + 1); }} style={styles.back}><SeoullyText>{retryLabel}</SeoullyText></Pressable>
      </View> : null}
      <View style={styles.zoomRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={zoomOutLabel} onPress={() => adjustZoom(-0.2)} style={styles.zoomButton}>
          <SeoullyText variant="title" color={colors.plum}>−</SeoullyText>
        </Pressable>
        <SeoullyText variant="caption" style={styles.zoomValue}>{Math.round(transform.zoom * 100)}%</SeoullyText>
        <Pressable accessibilityRole="button" accessibilityLabel={zoomInLabel} onPress={() => adjustZoom(0.2)} style={styles.zoomButton}>
          <SeoullyText variant="title" color={colors.plum}>+</SeoullyText>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" disabled={busy || imageState !== "ready" || !measured} accessibilityState={{ disabled: busy || imageState !== "ready" || !measured }} onPress={useCrop} style={styles.primary}>
        <SeoullyText variant="button" color={colors.onPrimary}>{useLabel}</SeoullyText>
      </Pressable>
      <Pressable accessibilityRole="button" disabled={busy} onPress={onCancel} style={styles.back}>
        <SeoullyText variant="button" color={colors.muted}>{backLabel}</SeoullyText>
      </Pressable>
    </SafeAreaView>
  </LanguageModal>;
}

function distance(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}
function midpoint(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) {
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}

const styles = StyleSheet.create({
  screen: { alignItems: "center", backgroundColor: colors.canvas, flex: 1, paddingHorizontal: spacing.lg, paddingTop: 0, paddingBottom: spacing.sm },
  hint: { marginBottom: spacing.lg, marginTop: spacing.xs, textAlign: "center" },
  cropArea: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", marginVertical: spacing.sm },
  viewport: { backgroundColor: colors.ink, borderRadius: 18, overflow: "hidden" },
  frame: { borderColor: colors.surface, borderRadius: 18, borderWidth: 2, bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  zoomRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  zoomButton: { alignItems: "center", borderColor: colors.border, borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  zoomValue: { minWidth: 52, textAlign: "center" },
  primary: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", marginTop: spacing.lg, minHeight: 52, width: "100%" },
  back: { padding: spacing.md },
});
