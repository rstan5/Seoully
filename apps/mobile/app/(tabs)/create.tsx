import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { copy } from "../../src/i18n";
import { colors, spacing } from "../../src/theme";
export default function CreateScreen() { return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.title}>{copy().create}</Text><Text style={styles.body}>Create a post or add a collectible from your native collection flow.</Text></View></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: spacing.lg }, title: { color: colors.ink, fontSize: 32, fontWeight: "700" }, body: { color: colors.muted, fontSize: 16, marginTop: spacing.md } });
