import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, FlatList, Image, Modal, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { loadMyHoldings, type NativeHolding } from "../src/api";
import { binderSpreads, buildNativeBinderPages, type NativeBinderPage, type NativeBinderSpread } from "../src/binder/model";
import { RetryNotice } from "../src/components/RetryNotice";
import { useCopy } from "../src/locale";
import { colors, spacing } from "../src/theme";

type CardSelection = { holding: NativeHolding; origin: { x: number; y: number; width: number; height: number } };

export default function BinderScreen() {
  const copy = useCopy();
  const { width } = useWindowDimensions();
  const spreadWidth = Math.max(320, width - spacing.lg * 2);
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [selected, setSelected] = useState<CardSelection | null>(null);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setHoldings(await loadMyHoldings());
      setError(null);
    } catch {
      setError(copy.binderUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.binderUnavailable]);
  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));
  const listRef = useRef<FlatList<NativeBinderSpread>>(null);
  const spreads = useMemo(() => binderSpreads(buildNativeBinderPages(holdings, copy.binderGeneral)), [copy.binderGeneral, holdings]);

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <Text style={styles.title}>{copy.binder}</Text>
    <Text style={styles.lead}>{copy.binderLead}</Text>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {!loading ? <FlatList
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
      renderItem={({ item }) => <Spread spread={item} width={spreadWidth} emptyLabel={copy.binderEmptyPocket} onSelect={setSelected} />}
      style={styles.binder}
    /> : null}
    <Text style={styles.pageCount}>{copy.binderPage} {spreadIndex + 1} / {spreads.length}</Text>
    <View style={styles.pageControls}>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: spreadIndex === 0 }} disabled={spreadIndex === 0} onPress={() => listRef.current?.scrollToIndex({ index: spreadIndex - 1, animated: true })} style={[styles.pageButton, spreadIndex === 0 && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>{copy.previousSpread}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: spreadIndex >= spreads.length - 1 }} disabled={spreadIndex >= spreads.length - 1} onPress={() => listRef.current?.scrollToIndex({ index: spreadIndex + 1, animated: true })} style={[styles.pageButton, spreadIndex >= spreads.length - 1 && styles.pageButtonDisabled]}><Text style={styles.pageButtonText}>{copy.nextSpread}</Text></Pressable>
    </View>
    <CardInspection selection={selected} returnLabel={copy.returnToBinder} onClose={() => setSelected(null)} />
  </View></SafeAreaView>;
}

function Spread({ spread, width, emptyLabel, onSelect }: { spread: NativeBinderSpread; width: number; emptyLabel: string; onSelect: (selection: CardSelection) => void }) {
  return <View style={[styles.spread, { width }]}>
    <Page page={spread.left} emptyLabel={emptyLabel} onSelect={onSelect} />
    <View style={styles.spine} />
    <Page page={spread.right} emptyLabel={emptyLabel} onSelect={onSelect} />
  </View>;
}

function Page({ page, emptyLabel, onSelect }: { page: NativeBinderPage; emptyLabel: string; onSelect: (selection: CardSelection) => void }) {
  return <View style={styles.page}>
    <Text numberOfLines={1} style={styles.setName}>{page.setName}</Text>
    <View style={styles.pockets}>{page.pockets.map((pocket) =>
      <BinderPocket key={pocket.index} holding={pocket.holding} emptyLabel={emptyLabel} onSelect={onSelect} />
    )}</View>
  </View>;
}

function BinderPocket({ holding, emptyLabel, onSelect }: { holding?: NativeHolding; emptyLabel: string; onSelect: (selection: CardSelection) => void }) {
  const pocketRef = useRef<View>(null);
  const select = () => {
    if (!holding) return;
    pocketRef.current?.measureInWindow((x, y, width, height) => onSelect({ holding, origin: { x, y, width, height } }));
  };
  return <Pressable ref={pocketRef} accessibilityRole={holding ? "button" : "text"} accessibilityLabel={holding?.template.name ?? emptyLabel} disabled={!holding} onPress={select} style={styles.pocket}>
    {holding?.personalMediaUrl ? <Image source={{ uri: holding.personalMediaUrl }} style={styles.cardImage} /> : holding ? <View style={styles.cardFallback}><Text numberOfLines={3} style={styles.cardName}>{holding.template.name}</Text></View> : null}
  </Pressable>;
}

function CardInspection({ selection, returnLabel, onClose }: { selection: CardSelection | null; returnLabel: string; onClose: () => void }) {
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
        {selection?.holding.personalMediaUrl ? <Image resizeMode="contain" source={{ uri: selection.holding.personalMediaUrl }} style={styles.inspectImage} /> : <View style={styles.inspectFallback}><Text style={styles.inspectFallbackText}>{selection?.holding.template.name}</Text></View>}
        <Text style={styles.inspectTitle}>{selection?.holding.template.name}</Text>
        <Text style={styles.inspectMeta}>{[selection?.holding.template.groupName, selection?.holding.template.memberName, selection?.holding.template.releaseName].filter(Boolean).join(" · ")}</Text>
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
  loading: { marginTop: spacing.xl },
  error: { color: colors.plum, marginTop: spacing.md },
  binder: { marginTop: spacing.lg },
  spread: { alignItems: "stretch", flexDirection: "row", paddingVertical: spacing.md },
  page: { backgroundColor: "#7d3e55", borderRadius: 10, flex: 1, padding: 7 },
  spine: { backgroundColor: "#4a2130", borderRadius: 4, marginHorizontal: 3, width: 10 },
  setName: { color: "#fff4f6", fontSize: 10, fontWeight: "700", height: 17, textAlign: "center" },
  pockets: { flexDirection: "row", flexWrap: "wrap", gap: 5, justifyContent: "center" },
  pocket: { aspectRatio: 55 / 85, backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.35)", borderRadius: 4, borderWidth: 1, overflow: "hidden", width: "29%" },
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
