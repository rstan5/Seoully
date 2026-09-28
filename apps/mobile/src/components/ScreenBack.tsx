import { Pressable, StyleSheet } from "react-native";
import { colors } from "../theme";
import { SeoullyText } from "../ui/SeoullyText";

export function ScreenBack({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.back}>
      <SeoullyText variant="button" color={colors.plum}>{label}</SeoullyText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
});
