import { Image, StyleSheet, View } from "react-native";
import { SeoullyText } from "./SeoullyText";

export function BrandMark() {
  return (
    <View accessibilityRole="header" style={styles.row}>
      <SeoullyText variant="display" style={styles.wordmark}>Seoully</SeoullyText>
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
    alignItems: "flex-end",
    flexDirection: "row",
    flexShrink: 1,
    overflow: "visible",
    paddingRight: 4,
  },
  wordmark: {
    fontSize: 20,
    includeFontPadding: false,
    letterSpacing: -0.8,
    lineHeight: 22,
  },
  heartSlot: {
    height: 22,
    marginBottom: 1,
    marginLeft: 3,
    overflow: "visible",
    width: 28,
  },
  heart: {
    bottom: -2,
    height: 26,
    left: 0,
    position: "absolute",
    width: 28,
  },
});
