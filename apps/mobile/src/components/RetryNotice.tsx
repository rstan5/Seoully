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
  message: { color: colors.plum, lineHeight: 20 },
  button: { borderColor: colors.plum, borderRadius: 10, borderWidth: 1, minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md },
  label: { color: colors.plum, fontWeight: "700" },
});
