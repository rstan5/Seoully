import { topHeaderMetrics, topHeaderRow } from "../ui/shellLayout";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { colors } from "../theme";
import { SeoullyText } from "../ui/SeoullyText";

export function ScreenBack({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const header = topHeaderMetrics(useWindowDimensions().fontScale);
  return (
    <View style={[topHeaderRow, { minHeight: header.height, alignSelf: "flex-start" }]} pointerEvents="box-none">
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.back, { minHeight: header.controlHeight }]}>
        <SeoullyText variant="button" color={colors.plum}>{label}</SeoullyText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  back: { justifyContent: "center", minHeight: 44 },
});
