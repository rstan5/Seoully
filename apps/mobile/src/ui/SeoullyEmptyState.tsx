import { StyleSheet, View } from "react-native";
import { BrandMark } from "./BrandMark";
import { SeoullyText } from "./SeoullyText";

export function SeoullyEmptyState({ title, body }: { title?: string; body: string }) {
  return (
    <View style={styles.wrap}>
      <BrandMark compact />
      {title ? <SeoullyText variant="handle" style={styles.title}>{title}</SeoullyText> : null}
      <SeoullyText variant="secondary" style={styles.body}>{body}</SeoullyText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 36, paddingHorizontal: 28 },
  title: { marginTop: 14, textAlign: "center" },
  body: { marginTop: 10, maxWidth: 280, textAlign: "center" },
});
