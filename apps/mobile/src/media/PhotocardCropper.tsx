import { PHOTOCARD, centeredPhotocardCrop } from "./photocard";
/* eslint-disable react-hooks/refs -- Gesture refs are read and written only inside PanResponder callbacks. */
import { useCallback, useMemo, useRef, useState } from "react";
import { Image, Modal, PanResponder, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";
import { SeoullyText } from "../ui/SeoullyText";

const CARD_RATIO = PHOTOCARD.aspect;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

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
}) {
  const window = useWindowDimensions();
  const viewportWidth = Math.max(210, Math.min(330, window.width - spacing.lg * 2, (window.height - 270) * CARD_RATIO));
  const viewportHeight = viewportWidth / CARD_RATIO;
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, zoom: 1 });
  const origin = useRef<Transform>(transform);
  const pinchDistance = useRef(0);
  const pinchCenter = useRef({ x: 0, y: 0 });

  const constrain = useCallback((next: Transform) => {
    if (!asset) return next;
    const baseScale = viewportWidth / centeredPhotocardCrop(asset.width, asset.height).width;
    const displayWidth = asset.width * baseScale * next.zoom;
    const displayHeight = asset.height * baseScale * next.zoom;
    const maxX = Math.max(0, (displayWidth - viewportWidth) / 2);
    const maxY = Math.max(0, (displayHeight - viewportHeight) / 2);
    return { zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next.zoom)), x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, [asset, viewportHeight, viewportWidth]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      origin.current = transform;
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2) {
        pinchDistance.current = distance(touches[0]!, touches[1]!);
        pinchCenter.current = midpoint(touches[0]!, touches[1]!);
      }
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2 && pinchDistance.current > 0) {
        const center = midpoint(touches[0]!, touches[1]!);
        const zoom = clamp(origin.current.zoom * distance(touches[0]!, touches[1]!) / pinchDistance.current, MIN_ZOOM, MAX_ZOOM);
        setTransform(constrain({ zoom, x: origin.current.x + center.x - pinchCenter.current.x, y: origin.current.y + center.y - pinchCenter.current.y }));
      } else {
        setTransform(constrain({ ...origin.current, x: origin.current.x + gesture.dx, y: origin.current.y + gesture.dy }));
      }
    },
  }), [constrain, transform]);

  if (!asset) return null;
  const baseScale = viewportWidth / centeredPhotocardCrop(asset.width, asset.height).width;
  const displayWidth = asset.width * baseScale * transform.zoom;
  const displayHeight = asset.height * baseScale * transform.zoom;
  const adjustZoom = (delta: number) => setTransform((current) => constrain({ ...current, zoom: clamp(current.zoom + delta, MIN_ZOOM, MAX_ZOOM) }));
  const useCrop = () => {
    const totalScale = baseScale * transform.zoom;
    const originX = Math.max(0, Math.round((displayWidth / 2 - viewportWidth / 2 - transform.x) / totalScale));
    const originY = Math.max(0, Math.round((displayHeight / 2 - viewportHeight / 2 - transform.y) / totalScale));
    onUse({
      originX,
      originY,
      width: Math.min(asset.width - originX, Math.round(viewportWidth / totalScale)),
      height: Math.min(asset.height - originY, Math.round(viewportHeight / totalScale)),
    });
  };

  return <Modal animationType="slide" visible onRequestClose={onCancel}>
    <SafeAreaView edges={["top"]} style={styles.screen}>
      <SeoullyText variant="title">{title}</SeoullyText>
      <SeoullyText variant="secondary" style={styles.hint}>{hint}</SeoullyText>
      <View {...panResponder.panHandlers} style={[styles.viewport, { width: viewportWidth, height: viewportHeight }]}>
        <Image source={{ uri: asset.uri }} style={{ position: "absolute", width: displayWidth, height: displayHeight, left: (viewportWidth - displayWidth) / 2 + transform.x, top: (viewportHeight - displayHeight) / 2 + transform.y }} />
        <View pointerEvents="none" style={styles.frame} />
      </View>
      <View style={styles.zoomRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={zoomOutLabel} onPress={() => adjustZoom(-0.2)} style={styles.zoomButton}>
          <SeoullyText variant="title" color={colors.plum}>−</SeoullyText>
        </Pressable>
        <SeoullyText variant="caption" style={styles.zoomValue}>{Math.round(transform.zoom * 100)}%</SeoullyText>
        <Pressable accessibilityRole="button" accessibilityLabel={zoomInLabel} onPress={() => adjustZoom(0.2)} style={styles.zoomButton}>
          <SeoullyText variant="title" color={colors.plum}>+</SeoullyText>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" onPress={useCrop} style={styles.primary}>
        <SeoullyText variant="button" color={colors.onPrimary}>{useLabel}</SeoullyText>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onCancel} style={styles.back}>
        <SeoullyText variant="button" color={colors.muted}>{backLabel}</SeoullyText>
      </Pressable>
    </SafeAreaView>
  </Modal>;
}

function distance(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) {
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}
function midpoint(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }) {
  return { x: (a.pageX + b.pageX) / 2, y: (a.pageY + b.pageY) / 2 };
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const styles = StyleSheet.create({
  screen: { alignItems: "center", backgroundColor: colors.canvas, flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  hint: { marginBottom: spacing.lg, marginTop: spacing.xs, textAlign: "center" },
  viewport: { backgroundColor: colors.ink, borderRadius: 18, overflow: "hidden" },
  frame: { borderColor: colors.surface, borderRadius: 18, borderWidth: 2, bottom: 0, left: 0, position: "absolute", right: 0, top: 0 },
  zoomRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  zoomButton: { alignItems: "center", borderColor: colors.border, borderRadius: 999, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  zoomValue: { minWidth: 52, textAlign: "center" },
  primary: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", marginTop: spacing.lg, minHeight: 52, width: "100%" },
  back: { padding: spacing.md },
});
