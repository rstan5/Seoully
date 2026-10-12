import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { KeyboardScreen } from "../components/KeyboardScreen";
import { colors, spacing } from "../theme";
import { SeoullyScreen } from "./SeoullyScreen";
import { SeoullyText } from "./SeoullyText";

/** Dedicated message destinations only; inline notices and loaders keep their own layout. */
export function SeoullyMessageScreen({ title, message, alert = false, children }: {
  title?: string;
  message?: string | null;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <SeoullyScreen edges={["top", "bottom", "left", "right"]}>
      <KeyboardScreen>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.viewport}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={styles.composition}>
            <View style={styles.copy}>
              {title ? <SeoullyText variant="title" style={styles.text}>{title}</SeoullyText> : null}
              {message ? <SeoullyText accessibilityRole={alert ? "alert" : undefined}
                variant="secondary" color={alert ? colors.plum : undefined} style={styles.text}>{message}</SeoullyText> : null}
            </View>
            <View style={styles.actions}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  // Grow to the safe viewport when content fits; scroll naturally at large text sizes.
  viewport: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: spacing.lg },
  composition: { width: "100%", maxWidth: 420, gap: spacing.lg },
  copy: { gap: spacing.sm },
  text: { textAlign: "center" },
  actions: { width: "100%", gap: spacing.sm },
});
