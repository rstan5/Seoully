import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme";

export function RetryNotice({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return <View accessibilityRole="alert" style={styles.notice}>
    <Text style={styles.message}>{message}</Text>
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}><Text style={styles.label}>{retryLabel}</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  notice: { alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  message: { color: colors.ink, lineHeight: 20 },
  button: { backgroundColor: colors.lilacSoft, borderColor: colors.lilac, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: spacing.md },
  label: { color: colors.plum, fontWeight: "600" },
});
