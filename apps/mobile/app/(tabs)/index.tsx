import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { copy } from "../../src/i18n";
import { colors, spacing } from "../../src/theme";

export default function FeedScreen() {
  const t = copy();
  return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.eyebrow}>{t.brand}</Text><Text style={styles.title}>{t.feed}</Text><Text style={styles.body}>Your collector community will live here.</Text></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: spacing.lg }, eyebrow: { color: colors.plum, fontSize: 15, fontWeight: "700" }, title: { color: colors.ink, fontSize: 34, fontWeight: "700", marginTop: spacing.xs }, body: { color: colors.muted, fontSize: 16, marginTop: spacing.md } });
