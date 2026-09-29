/* eslint-disable react-hooks/refs -- PanResponder reads refs only inside gesture callbacks. */
import { lazy, Suspense, useCallback, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { loadCollectorRoom } from "../src/api";
import { useSocialRepository } from "../src/data";
import { collectibleKindLabel } from "../src/i18n";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { useCopy } from "../src/locale";
import { buildPublicRoomRenderables, type RoomRenderable } from "../src/room/model";
import { colors, spacing } from "../src/theme";

const NativeRoomRenderer = lazy(async () => {
  const mod = await import("../src/room/NativeRoomRenderer");
  return { default: mod.NativeRoomRenderer };
});

export default function CollectorRoomScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const { userId = "" } = useLocalSearchParams<{ userId?: string }>();
  const [items, setItems] = useState<RoomRenderable[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cameraYaw, setCameraYaw] = useState(0);
  const [cameraPitch, setCameraPitch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cameraOrigin = useRef({ yaw: 0, pitch: 0 });

  const refresh = useCallback(async () => {
    if (social.kind === "demo" || !social.capabilities.persistRoom) {
      setItems([]);
      setOwnerName("");
      setPrivateRoom(false);
      setError(copy.demoRoomUnavailable);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snapshot = await loadCollectorRoom(userId);
      if (snapshot.viewerUserId && snapshot.viewerUserId === snapshot.owner.userId) {
        router.replace("/room");
        return;
      }
      setOwnerName(snapshot.owner.displayName);
      setPrivateRoom(snapshot.private || !snapshot.room);
      setItems(snapshot.room ? buildPublicRoomRenderables(snapshot.room.id, snapshot.room.placements) : []);
      setError(null);
    } catch {
      setError(copy.roomUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.demoRoomUnavailable, copy.roomUnavailable, router, social.capabilities.persistRoom, social.kind, userId]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 4,
    onPanResponderGrant: () => { cameraOrigin.current = { yaw: cameraYaw, pitch: cameraPitch }; },
    onPanResponderMove: (_, gesture) => {
      setCameraYaw(clampCamera(cameraOrigin.current.yaw + gesture.dx * 0.003, -0.38, 0.38));
      setCameraPitch(clampCamera(cameraOrigin.current.pitch - gesture.dy * 0.003, -0.22, 0.28));
    },
  });
  const selected = items.find((item) => item.holding.id === selectedId) ?? null;

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <ScreenBack label={copy.back} onPress={() => router.back()} />
    <Text style={styles.title}>{ownerName ? `${ownerName}` : copy.room}</Text>
    <Text style={styles.lead}>{copy.collectorRoomLead}</Text>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {!loading && privateRoom ? <Text style={styles.empty}>{copy.roomPrivate}</Text> : null}
    {!loading && !privateRoom ? <View style={styles.stage} {...panResponder.panHandlers}>
      <Suspense fallback={<ActivityIndicator color={colors.plum} style={styles.loading} />}><NativeRoomRenderer items={items} selectedId={selectedId} focusedId={selectedId} themeId="hearth" cameraYaw={cameraYaw} cameraPitch={cameraPitch} onSelect={setSelectedId} onClearSelection={() => setSelectedId(null)} /></Suspense>
      <View pointerEvents="none" style={styles.hint}><Text style={styles.hintText}>{copy.roomOrbitHint}</Text></View>
    </View> : null}
    {selected ? <View style={styles.inspection}>
      <View style={styles.inspectionCopy}>
        <Text numberOfLines={1} style={styles.inspectionTitle}>{selected.holding.template.name}</Text>
        <Text numberOfLines={1} style={styles.inspectionMeta}>{[selected.holding.template.groupName, selected.holding.template.memberName, selected.holding.template.releaseName, collectibleKindLabel(selected.holding.template.kind, copy)].filter(Boolean).join(" · ")}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => setSelectedId(null)} style={styles.inspectAction}><Text style={styles.inspectActionText}>{copy.close}</Text></Pressable>
    </View> : null}
  </View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { flex: 1, paddingTop: spacing.sm },
  title: { color: colors.ink, fontSize: 28, fontWeight: "700", paddingHorizontal: spacing.lg },
  lead: { color: colors.muted, fontSize: 14, marginTop: spacing.xs, paddingHorizontal: spacing.lg },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.muted, padding: spacing.lg },
  stage: { flex: 1, minHeight: 360, overflow: "hidden" },
  hint: { alignSelf: "center", backgroundColor: colors.surface, borderRadius: 999, bottom: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: "absolute" },
  hintText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  inspection: { alignItems: "center", backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  inspectionCopy: { flex: 1 },
  inspectionTitle: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  inspectionMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  inspectAction: { borderColor: colors.plum, borderRadius: 10, borderWidth: 1, justifyContent: "center", minHeight: 38, paddingHorizontal: spacing.sm },
  inspectActionText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
});

function clampCamera(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
