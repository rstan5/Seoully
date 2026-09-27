import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { copy } from "../../src/i18n";
import { colors, spacing } from "../../src/theme";
export default function MessagesScreen() { return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.title}>{copy().messages}</Text><Text style={styles.body}>Your Seoully conversations will appear here.</Text></View></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: spacing.lg }, title: { color: colors.ink, fontSize: 32, fontWeight: "700" }, body: { color: colors.muted, fontSize: 16, marginTop: spacing.md } });
