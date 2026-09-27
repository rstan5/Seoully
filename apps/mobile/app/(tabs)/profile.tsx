import { useRouter } from "expo-router";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { copy } from "../../src/i18n";
import { supabase } from "../../src/supabase";
import { colors, spacing } from "../../src/theme";
export default function ProfileScreen() { const router = useRouter(); return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.title}>{copy().profile}</Text><Text style={styles.body}>Your collector identity and Room will live here.</Text><Pressable accessibilityRole="button" onPress={async () => { await supabase.auth.signOut(); router.replace("/"); }} style={styles.button}><Text style={styles.buttonText}>Sign out</Text></Pressable></View></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: spacing.lg }, title: { color: colors.ink, fontSize: 32, fontWeight: "700" }, body: { color: colors.muted, fontSize: 16, marginTop: spacing.md }, button: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", marginTop: spacing.xl, minHeight: 52 }, buttonText: { color: colors.surface, fontWeight: "700" } });
