import { Image, StyleSheet, View } from "react-native";
import { faces } from "../theme";
import { SeoullyText } from "./SeoullyText";

/**
 * Baloo 2 Bold sits high in its line box. Header flex stays mathematically
 * centered; only the visible Latin wordmark is nudged down to the shared axis.
 */
export const BRAND_WORDMARK_OPTICAL_Y = 2;

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
    fontFamily: faces.en.bold,
    includeFontPadding: false,
    overflow: "visible",
    paddingRight: 1,
    transform: [{ translateY: BRAND_WORDMARK_OPTICAL_Y }],
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
