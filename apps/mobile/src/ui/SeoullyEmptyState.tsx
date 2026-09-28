import { StyleSheet, View } from "react-native";
import { SeoullyText } from "./SeoullyText";

export function SeoullyEmptyState({ body }: { title?: string; body: string }) {
  return (
    <View style={styles.wrap}>
      <SeoullyText variant="secondary" style={styles.body}>{body}</SeoullyText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 28, paddingHorizontal: 20 },
  body: { maxWidth: 300, textAlign: "center" },
});
