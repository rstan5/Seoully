import { Image, StyleSheet, View } from "react-native";
import { SeoullyText } from "./SeoullyText";

/**
 * Wordmark + heart as one logo. Web `.brand-mark` / `.brand-heart` (1.46em × 1.2em,
 * heart image 116% tall, baseline-aligned). Never shrink or clip the pair.
 */
export function BrandMark() {
  return (
    <View accessibilityRole="header" style={styles.row}>
      <SeoullyText variant="display" maxFontSizeMultiplier={1.35} style={styles.wordmark}>
        Seoully
      </SeoullyText>
      <View style={styles.heartSlot}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require("../../assets/brand/seoully-heart-mark.png")}
          style={styles.heart}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: 4,
    overflow: "visible",
  },
  wordmark: {
    includeFontPadding: false,
    overflow: "visible",
    paddingRight: 1,
  },
  heartSlot: {
    height: 24,
    justifyContent: "flex-end",
    overflow: "visible",
    width: 29,
  },
  heart: {
    height: 28,
    width: 29,
  },
});
