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
          hitSlop={8}
          onPress={onToggleLanguage}
          style={({ pressed }) => [styles.lang, pressShift(pressed, reduceMotion)]}
        >
          <SeoullyText variant="button" color={colors.ink} style={styles.langMuted}>{languageLabel}</SeoullyText>
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
    height: sizes.topBar,
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  end: { alignItems: "center", flexDirection: "row" },
  lang: { justifyContent: "center", minHeight: 44, paddingHorizontal: 6 },
  langMuted: { fontSize: 13, opacity: 0.7 },
});
