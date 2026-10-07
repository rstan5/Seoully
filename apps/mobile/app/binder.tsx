import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AccessibilityInfo, Animated, Easing, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSocialRepository } from "../src/data";
import type { NativeHolding } from "../src/api";
import { binderSectionStarts, binderSpreads, buildNativeBinderPages, spreadIndexForHolding, type NativeBinderPage, type NativeBinderSpread } from "../src/binder/model";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { useCachedSignedMedia } from "../src/media/cachedMedia";
import { useCopy } from "../src/locale";
import { colors, spacing } from "../src/theme";

type CardSelection = { holding: NativeHolding; origin: { x: number; y: number; width: number; height: number } };
const BINDER_SPREAD_KEY = "seoully.mobile.binder-spread.v1";

export default function BinderScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const params = useLocalSearchParams<{ holdingId?: string }>();
  const jumpedHolding = useRef<string | null>(null);
  const { width } = useWindowDimensions();
  const spreadWidth = Math.max(320, width - spacing.lg * 2);
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [selected, setSelected] = useState<CardSelection | null>(null);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [spreadReady, setSpreadReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hydratedKind, setHydratedKind] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cover] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); }, []);
  useEffect(() => {
    Animated.timing(cover, {
      toValue: 1,
      duration: reducedMotion ? 1 : 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [cover, reducedMotion]);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const items: NativeHolding[] = [];
      for (let offset = 0; offset < 2_000; offset += 100) {
        const page = await social.loadMyHoldings(offset, 100);
        items.push(...page.filter((item) => !items.some((existing) => existing.id === item.id)));
        if (page.length < 100) break;
      }
      setHoldings(items);
      setHydratedKind(social.kind);
      setError(null);
    } catch {
      setError(copy.binderUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.binderUnavailable, social]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));
  const listRef = useRef<FlatList<NativeBinderSpread>>(null);
  useEffect(() => {
    const task = setTimeout(() => {
      void AsyncStorage.getItem(BINDER_SPREAD_KEY).then((stored) => {
        const index = Number(stored);
        if (Number.isInteger(index) && index >= 0) setSpreadIndex(index);
        setSpreadReady(true);
      });
    }, 0);
    return () => clearTimeout(task);
  }, []);
  useEffect(() => {
    if (spreadReady) void AsyncStorage.setItem(BINDER_SPREAD_KEY, String(spreadIndex));
  }, [spreadIndex, spreadReady]);
  const spreads = useMemo(() => binderSpreads(buildNativeBinderPages(holdings, copy.binderGeneral)), [copy.binderGeneral, holdings]);
  const sections = useMemo(() => binderSectionStarts(spreads), [spreads]);
  useEffect(() => {
    const holdingId = typeof params.holdingId === "string" ? params.holdingId : "";
    if (!spreadReady || !holdingId || jumpedHolding.current === holdingId) return;
    const index = spreadIndexForHolding(spreads, holdingId);
    if (index < 0) return;
    jumpedHolding.current = holdingId;
    const task = setTimeout(() => setSpreadIndex(index), 0);
    return () => clearTimeout(task);
  }, [params.holdingId, spreadReady, spreads]);
  const visibleSpread = spreads.length ? Math.min(spreadIndex, spreads.length - 1) : 0;
  useEffect(() => {
    if (!spreads.length) return;
    const task = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: visibleSpread, animated: false });
    }, 0);
    return () => clearTimeout(task);
  }, [spreads.length, visibleSpread]);

  const photocards = holdings.filter((holding) => holding.template.kind === "photocard");
  const closeBinder = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(cover, {
      toValue: 0,
      duration: reducedMotion ? 1 : 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      if (router.canGoBack()) router.back();
      else router.replace("/room");
    });
  };

  if (social.kind !== "demo" && loading && hydratedKind !== social.kind && !error) return <SeoullyLoadingState fullScreen label={copy.binder} />;

  return <SafeAreaView edges={["top"]} style={styles.safe}><View style={styles.container}>
    <ScreenBack label={copy.closeBinder} onPress={closeBinder} />
    <Text style={styles.title}>{copy.binder}</Text>
    <Text style={styles.lead}>{copy.binderLead}</Text>
    {!loading && !photocards.length ? <Text style={styles.empty}>{copy.binderEmpty}</Text> : null}
    {sections.length > 1 ? <View><Text style={styles.sectionLabel}>{copy.jumpToSet}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sectionRow}>{sections.map((section) => <Pressable key={section.setId} accessibilityRole="button" accessibilityState={{ selected: spreads[visibleSpread]?.left.setId === section.setId }} onPress={() => listRef.current?.scrollToIndex({ index: section.spreadIndex, animated: true })} style={[styles.sectionChip, spreads[visibleSpread]?.left.setId === section.setId && styles.sectionChipSelected]}><Text style={[styles.sectionChipText, spreads[visibleSpread]?.left.setId === section.setId && styles.sectionChipTextSelected]}>{section.setName}</Text></Pressable>)}</ScrollView></View> : null}
    {loading && social.kind === "demo" ? <SeoullyLoadingState label={copy.binder} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {!loading || (social.kind !== "demo" && hydratedKind === social.kind) ? <View style={styles.binderStage}>
      <FlatList
      ref={listRef}
      data={spreads}
      horizontal
      pagingEnabled
      getItemLayout={(_, index) => ({ length: spreadWidth, offset: spreadWidth * index, index })}
      keyExtractor={(spread) => String(spread.index)}
      showsHorizontalScrollIndicator={false}
      snapToInterval={spreadWidth}
      decelerationRate="fast"
      onMomentumScrollEnd={(event) => setSpreadIndex(Math.round(event.nativeEvent.contentOffset.x / spreadWidth))}
      renderItem={({ item }) => <Spread spread={item} width={spreadWidth} emptyLabel={copy.binderEmptyPocket} focusedHoldingId={typeof params.holdingId === "string" ? params.holdingId : undefined} onSelect={setSelected} />}
      style={styles.binder}
    />
      <Animated.View pointerEvents="none" style={[styles.cover, {
        opacity: cover.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
        transform: [{ scale: cover.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }) }],
      }]}>
        <View style={styles.coverSpine} />
        <View style={styles.coverBoard}><Text style={styles.coverTitle}>{copy.binder}</Text></View>
      </Animated.View>
    </View> : null}
    <Text style={styles.pageCount}>{copy.binderPage} {visibleSpread + 1} / {spreads.length}</Text>
    <View style={styles.pageControls}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: visibleSpread === 0 }} disabled={visibleSpread === 0} onPress={() => listRef.current?.scrollToIndex({ index: visibleSpread - 1, animated: true })} style={[styles.pageButton, visibleSpread === 0 && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>{copy.previousSpread}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: visibleSpread >= spreads.length - 1 }} disabled={visibleSpread >= spreads.length - 1} onPress={() => listRef.current?.scrollToIndex({ index: visibleSpread + 1, animated: true })} style={[styles.pageButton, visibleSpread >= spreads.length - 1 && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>{copy.nextSpread}</Text></Pressable>
    </View>
    <CardInspection selection={selected} returnLabel={copy.returnToBinder} detailsLabel={copy.viewCollectible} onClose={() => setSelected(null)} />
  </View></SafeAreaView>;
}

function Spread({ spread, width, emptyLabel, focusedHoldingId, onSelect }: { spread: NativeBinderSpread; width: number; emptyLabel: string; focusedHoldingId?: string; onSelect: (selection: CardSelection) => void }) {
  return <View style={[styles.spread, { width }]}>
    <Page page={spread.left} emptyLabel={emptyLabel} focusedHoldingId={focusedHoldingId} onSelect={onSelect} side="left" />
    <View style={styles.spine} />
    <Page page={spread.right} emptyLabel={emptyLabel} focusedHoldingId={focusedHoldingId} onSelect={onSelect} side="right" />
  </View>;
}

function Page({ page, emptyLabel, focusedHoldingId, onSelect, side }: { page: NativeBinderPage; emptyLabel: string; focusedHoldingId?: string; onSelect: (selection: CardSelection) => void; side: "left" | "right" }) {
  return <View style={[styles.page, side === "left" ? styles.pageLeft : styles.pageRight]}>
    <Text numberOfLines={1} style={styles.setName}>{page.setName} · {page.pageInSet + 1}</Text>
    <View style={styles.pockets}>{page.pockets.map((pocket) =>
      <BinderPocket key={pocket.index} holding={pocket.holding} emptyLabel={emptyLabel} focused={Boolean(focusedHoldingId && pocket.holding?.id === focusedHoldingId)} onSelect={onSelect} />
    )}</View>
  </View>;
}

function BinderPocket({ holding, emptyLabel, focused, onSelect }: { holding?: NativeHolding; emptyLabel: string; focused?: boolean; onSelect: (selection: CardSelection) => void }) {
  const pocketRef = useRef<View>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const mediaUri = useCachedSignedMedia(holding?.id, holding?.personalMediaUrl);
  const faceUri = imageFailed ? undefined : mediaUri;
  const select = () => {
    if (!holding) return;
    pocketRef.current?.measureInWindow((x, y, width, height) => onSelect({ holding, origin: { x, y, width, height } }));
  };
  return <Pressable ref={pocketRef} accessibilityRole={holding ? "button" : "text"} accessibilityLabel={holding?.template.name ?? emptyLabel} disabled={!holding} onPress={select} style={[styles.pocket, focused && styles.pocketFocused]}>
    {faceUri ? <Image source={{ uri: faceUri }} style={styles.cardImage} onError={() => setImageFailed(true)} /> : holding ? <View style={styles.cardFallback} /> : null}
  </Pressable>;
}

function CardInspection({ selection, returnLabel, detailsLabel, onClose }: { selection: CardSelection | null; returnLabel: string; detailsLabel: string; onClose: () => void }) {
  const router = useRouter();
  const mediaUri = useCachedSignedMedia(selection?.holding.id, selection?.holding.personalMediaUrl);
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const closing = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => { void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion); }, []);
  useEffect(() => {
    if (!selection) return;
    closing.current = false;
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      damping: reducedMotion ? 30 : 17,
      stiffness: reducedMotion ? 320 : 190,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [progress, reducedMotion, selection]);
  const returnCard = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(progress, {
      toValue: 0,
      duration: reducedMotion ? 80 : 220,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => { if (finished) onClose(); });
  };
  const origin = selection?.origin;
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [origin ? origin.x + origin.width / 2 - width / 2 : 0, 0] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [origin ? origin.y + origin.height / 2 - height / 2 : 80, 0] });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [origin ? Math.max(0.18, origin.width / 300) : 0.7, 1] });
  return <Modal animationType="none" transparent visible={Boolean(selection)} onRequestClose={returnCard}>
    <Animated.View style={[styles.modalBackdrop, { opacity: progress }]}>
      <Animated.View style={[styles.inspection, { transform: [{ translateX }, { translateY }, { scale }] }]}>
        {mediaUri ? <Image resizeMode="contain" source={{ uri: mediaUri }} style={styles.inspectImage} /> : <View style={styles.inspectFallback} />}
        <Text style={styles.inspectTitle}>{selection?.holding.template.name}</Text>
        <Text style={styles.inspectMeta}>{[selection?.holding.template.groupName, selection?.holding.template.memberName, selection?.holding.template.releaseName].filter(Boolean).join(" · ")}</Text>
        <Pressable accessibilityRole="button" onPress={() => { if (selection) router.push({ pathname: "/collectible", params: { holdingId: selection.holding.id } }); }} style={styles.closeButton}><Text style={styles.closeText}>{detailsLabel}</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={returnCard} style={styles.closeButton}><Text style={styles.closeText}>{returnLabel}</Text></Pressable>
      </Animated.View>
    </Animated.View>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { flex: 1, paddingHorizontal: spacing.lg },
  title: { color: colors.ink, fontSize: 30, fontWeight: "700", marginTop: spacing.sm },
  lead: { color: colors.muted, fontSize: 14, marginTop: spacing.xs },
  sectionLabel: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: spacing.sm, textTransform: "uppercase" },
  sectionRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  sectionChip: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, justifyContent: "center", minHeight: 34, paddingHorizontal: spacing.md },
  sectionChipSelected: { backgroundColor: colors.plum, borderColor: colors.plum },
  sectionChipText: { color: colors.plum, fontSize: 12, fontWeight: "700" },
  sectionChipTextSelected: { color: colors.surface },
  loading: { marginTop: spacing.xl },
  error: { color: colors.plum, marginTop: spacing.md },
  empty: { color: colors.muted, fontSize: 13, marginTop: spacing.sm },
  binderStage: { flex: 1, marginTop: spacing.lg },
  binder: { flex: 1 },
  cover: { alignItems: "center", backgroundColor: colors.canvas, bottom: 0, flexDirection: "row", justifyContent: "center", left: 0, paddingHorizontal: spacing.lg, position: "absolute", right: 0, top: 0 },
  coverSpine: { backgroundColor: "#3a1520", borderRadius: 4, height: "72%", width: 18 },
  coverBoard: { alignItems: "center", backgroundColor: "#5a2233", borderRadius: 12, height: "72%", justifyContent: "center", marginLeft: 4, width: "62%" },
  coverTitle: { color: "#fff4f6", fontSize: 22, fontWeight: "700" },
  spread: { alignItems: "stretch", flexDirection: "row", paddingVertical: spacing.md },
  page: { backgroundColor: "#7d3e55", borderRadius: 10, flex: 1, padding: 7 },
  pageLeft: { borderBottomRightRadius: 4, borderTopRightRadius: 4, transform: [{ perspective: 700 }, { rotateY: "7deg" }] },
  pageRight: { borderBottomLeftRadius: 4, borderTopLeftRadius: 4, transform: [{ perspective: 700 }, { rotateY: "-7deg" }] },
  spine: { backgroundColor: "#4a2130", borderRadius: 4, marginHorizontal: 3, width: 10 },
  setName: { color: "#fff4f6", fontSize: 10, fontWeight: "700", height: 17, textAlign: "center" },
  pockets: { flexDirection: "row", flexWrap: "wrap", gap: 5, justifyContent: "center" },
  pocket: { aspectRatio: 55 / 85, backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.35)", borderRadius: 4, borderWidth: 1, overflow: "hidden", width: "29%" },
  pocketFocused: { borderColor: "#fff4f6", borderWidth: 2, transform: [{ translateY: -6 }] },
  cardImage: { height: "100%", width: "100%" },
  cardFallback: { alignItems: "center", backgroundColor: colors.blush, height: "100%", justifyContent: "center", padding: 2, width: "100%" },
  cardName: { color: colors.ink, fontSize: 8, textAlign: "center" },
  pageCount: { color: colors.muted, fontSize: 13, textAlign: "center" },
  pageControls: { flexDirection: "row", gap: spacing.sm, justifyContent: "center", paddingBottom: spacing.md, paddingTop: spacing.xs },
  pageButton: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, minWidth: 92, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  pageButtonDisabled: { opacity: 0.38 },
  pageButtonText: { color: colors.plum, fontSize: 12, fontWeight: "700", textAlign: "center" },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(35,17,24,0.72)", flex: 1, justifyContent: "center", padding: spacing.xl },
  inspection: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 20, maxWidth: 420, padding: spacing.lg, width: "100%" },
  inspectImage: { aspectRatio: 55 / 85, maxHeight: 480, width: "82%" },
  inspectFallback: { alignItems: "center", aspectRatio: 55 / 85, backgroundColor: colors.blush, borderRadius: 12, justifyContent: "center", padding: spacing.md, width: "82%" },
  inspectFallbackText: { color: colors.ink, fontSize: 18, fontWeight: "700", textAlign: "center" },
  inspectTitle: { color: colors.ink, fontSize: 20, fontWeight: "700", marginTop: spacing.md, textAlign: "center" },
  inspectMeta: { color: colors.muted, marginTop: spacing.xs, textAlign: "center" },
  closeButton: { backgroundColor: colors.plum, borderRadius: 12, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  closeText: { color: colors.surface, fontWeight: "700" },
});
