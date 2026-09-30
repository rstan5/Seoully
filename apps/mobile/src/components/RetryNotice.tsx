import { Pressable, StyleSheet, View } from "react-native";
import { colors, spacing } from "../theme";
import { SeoullyText } from "../ui/SeoullyText";

export function RetryNotice({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return <View accessibilityRole="alert" style={styles.notice}>
    <SeoullyText variant="body">{message}</SeoullyText>
    <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
      <SeoullyText variant="button" color={colors.plum}>{retryLabel}</SeoullyText>
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  notice: { alignItems: "flex-start", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
  button: { backgroundColor: colors.lilacSoft, borderColor: colors.lilac, borderRadius: 12, borderWidth: 1, justifyContent: "center", minHeight: 40, paddingHorizontal: spacing.md },
});
