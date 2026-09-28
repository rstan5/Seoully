import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { SeoullyText } from "./SeoullyText";

export function SeoullyLoadingState({ label }: { label: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.plum} />
      <SeoullyText variant="secondary" style={styles.label}>{label}</SeoullyText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 12, marginTop: 36, paddingHorizontal: 24 },
  label: { textAlign: "center" },
});
