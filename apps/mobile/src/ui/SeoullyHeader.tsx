import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, sizes } from "../theme";
import { BrandMark } from "./BrandMark";
import { pressShift, useReduceMotion } from "./motion";
import { SeoullyText } from "./SeoullyText";

export function SeoullyHeader({
  languageLabel,
  onToggleLanguage,
  trailing,
}: {
  languageLabel: string;
  onToggleLanguage: () => void;
  trailing?: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <View style={styles.top}>
      <BrandMark />
      <View style={styles.end}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={languageLabel}
          hitSlop={10}
          onPress={onToggleLanguage}
          style={({ pressed }) => [styles.lang, pressShift(pressed, reduceMotion)]}
        >
          <SeoullyText variant="button" color={colors.ink}>{languageLabel}</SeoullyText>
        </Pressable>
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: sizes.topBar,
    overflow: "visible",
    paddingHorizontal: 16,
    zIndex: 2,
  },
  end: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    marginLeft: 12,
  },
  lang: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
  },
});
