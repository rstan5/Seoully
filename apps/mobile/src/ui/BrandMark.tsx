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
    alignItems: "center",
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
    textAlignVertical: "center",
  },
  heartSlot: {
    height: 22,
    justifyContent: "center",
    marginLeft: 4,
    overflow: "visible",
    width: 22,
  },
  heart: {
    height: 22,
    marginTop: -1,
    width: 22,
  },
});
