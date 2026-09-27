import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme";

export function ScreenBack({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.back}>
    <Text style={styles.backText}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
  backText: { color: colors.plum, fontWeight: "700" },
});
