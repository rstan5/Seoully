import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Pressable, SafeAreaView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { loadMyHoldings, type NativeHolding } from "../src/api";
import { binderSpreads, buildNativeBinderPages, type NativeBinderPage, type NativeBinderSpread } from "../src/binder/model";
import { useCopy } from "../src/locale";
import { colors, spacing } from "../src/theme";

export default function BinderScreen() {
  const copy = useCopy();
  const { width } = useWindowDimensions();
  const spreadWidth = Math.max(320, width - spacing.lg * 2);
  const [holdings, setHoldings] = useState<NativeHolding[]>([]);
  const [selected, setSelected] = useState<NativeHolding | null>(null);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void loadMyHoldings()
      .then((items) => { if (active) setHoldings(items); })
      .catch(() => { if (active) setError(copy.binderUnavailable); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.binderUnavailable]);
  const spreads = useMemo(() => binderSpreads(buildNativeBinderPages(holdings)), [holdings]);

  return <SafeAreaView style={styles.safe}><View style={styles.container}>
    <Text style={styles.title}>{copy.binder}</Text>
    <Text style={styles.lead}>{copy.binderLead}</Text>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!loading ? <FlatList
      data={spreads}
      horizontal
      pagingEnabled
      keyExtractor={(spread) => String(spread.index)}
      showsHorizontalScrollIndicator={false}
      snapToInterval={spreadWidth}
      decelerationRate="fast"
      onMomentumScrollEnd={(event) => setSpreadIndex(Math.round(event.nativeEvent.contentOffset.x / spreadWidth))}
      renderItem={({ item }) => <Spread spread={item} width={spreadWidth} emptyLabel={copy.binderEmptyPocket} onSelect={setSelected} />}
      style={styles.binder}
    /> : null}
    <Text style={styles.pageCount}>{copy.binderPage} {spreadIndex + 1} / {spreads.length}</Text>
    <CardInspection holding={selected} closeLabel={copy.close} onClose={() => setSelected(null)} />
  </View></SafeAreaView>;
}

function Spread({ spread, width, emptyLabel, onSelect }: { spread: NativeBinderSpread; width: number; emptyLabel: string; onSelect: (holding: NativeHolding) => void }) {
  return <View style={[styles.spread, { width }]}>
    <Page page={spread.left} emptyLabel={emptyLabel} onSelect={onSelect} />
    <View style={styles.spine} />
    <Page page={spread.right} emptyLabel={emptyLabel} onSelect={onSelect} />
  </View>;
}

function Page({ page, emptyLabel, onSelect }: { page: NativeBinderPage; emptyLabel: string; onSelect: (holding: NativeHolding) => void }) {
  return <View style={styles.page}>
    <Text numberOfLines={1} style={styles.setName}>{page.setName}</Text>
    <View style={styles.pockets}>{page.pockets.map((pocket) =>
      <Pressable key={pocket.index} accessibilityRole={pocket.holding ? "button" : "text"} accessibilityLabel={pocket.holding?.template.name ?? emptyLabel} disabled={!pocket.holding} onPress={() => pocket.holding && onSelect(pocket.holding)} style={styles.pocket}>
        {pocket.holding?.personalMediaUrl ? <Image source={{ uri: pocket.holding.personalMediaUrl }} style={styles.cardImage} /> : pocket.holding ? <View style={styles.cardFallback}><Text numberOfLines={3} style={styles.cardName}>{pocket.holding.template.name}</Text></View> : null}
      </Pressable>
    )}</View>
  </View>;
}

function CardInspection({ holding, closeLabel, onClose }: { holding: NativeHolding | null; closeLabel: string; onClose: () => void }) {
  return <Modal animationType="fade" transparent visible={Boolean(holding)} onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><View style={styles.inspection}>
      {holding?.personalMediaUrl ? <Image resizeMode="contain" source={{ uri: holding.personalMediaUrl }} style={styles.inspectImage} /> : null}
      <Text style={styles.inspectTitle}>{holding?.template.name}</Text>
      <Text style={styles.inspectMeta}>{[holding?.template.groupName, holding?.template.memberName, holding?.template.releaseName].filter(Boolean).join(" · ")}</Text>
      <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}><Text style={styles.closeText}>{closeLabel}</Text></Pressable>
    </View></View>
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
  pageCount: { color: colors.muted, fontSize: 13, paddingBottom: spacing.md, textAlign: "center" },
  modalBackdrop: { alignItems: "center", backgroundColor: "rgba(35,17,24,0.72)", flex: 1, justifyContent: "center", padding: spacing.xl },
  inspection: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 20, maxWidth: 420, padding: spacing.lg, width: "100%" },
  inspectImage: { aspectRatio: 55 / 85, maxHeight: 480, width: "82%" },
  inspectTitle: { color: colors.ink, fontSize: 20, fontWeight: "700", marginTop: spacing.md, textAlign: "center" },
  inspectMeta: { color: colors.muted, marginTop: spacing.xs, textAlign: "center" },
  closeButton: { backgroundColor: colors.plum, borderRadius: 12, marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  closeText: { color: colors.surface, fontWeight: "700" },
});
