import { StyleSheet, View } from "react-native";
import { SeoullyText } from "./SeoullyText";

export function SeoullyEmptyState({
  body,
  align = "center",
}: {
  title?: string;
  body: string;
  align?: "center" | "start";
}) {
  return (
    <View style={[styles.wrap, align === "start" && styles.start]}>
      <SeoullyText variant="secondary" style={[styles.body, align === "start" && styles.startBody]}>{body}</SeoullyText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 28, paddingHorizontal: 20 },
  start: { alignItems: "flex-start", marginTop: 10, paddingHorizontal: 0 },
  body: { maxWidth: 300, textAlign: "center" },
  startBody: { maxWidth: "100%", textAlign: "left" },
});
