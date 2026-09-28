import { Image, StyleSheet, View } from "react-native";
import { SeoullyText } from "./SeoullyText";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View accessibilityRole="header" style={styles.row}>
      <SeoullyText variant="display" style={compact ? styles.compact : undefined}>Seoully</SeoullyText>
      <Image
        accessibilityIgnoresInvertColors
        source={require("../../assets/brand/seoully-heart-mark.png")}
        style={[styles.heart, compact && styles.heartCompact]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", flexDirection: "row" },
  compact: { fontSize: 18, lineHeight: 22 },
  heart: { height: 26, marginLeft: 2, marginTop: 2, width: 32 },
  heartCompact: { height: 22, width: 27 },
});
