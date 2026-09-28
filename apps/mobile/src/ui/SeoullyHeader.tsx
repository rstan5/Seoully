import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { isDemoWorldAllowed, useDataMode } from "../data";
import { useCopy } from "../locale";
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
  const copy = useCopy();
  const reduceMotion = useReduceMotion();
  const { demo, setDemo } = useDataMode();
  const allowed = isDemoWorldAllowed();
  return (
    <View style={styles.top}>
      <BrandMark />
      <View style={styles.end}>
        {allowed ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: demo }}
            accessibilityLabel={demo ? copy.demoWorld : copy.productionData}
            onPress={() => setDemo(!demo)}
            style={({ pressed }) => [styles.demo, demo && styles.demoOn, pressShift(pressed, reduceMotion)]}
          >
            <SeoullyText variant="caption" color={demo ? colors.plum : colors.muted}>
              {demo ? copy.demoWorld : copy.productionData}
            </SeoullyText>
          </Pressable>
        ) : null}
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
  demo: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    marginRight: 6,
    minHeight: 28,
    paddingHorizontal: 8,
  },
  demoOn: {
    backgroundColor: colors.lilacSoft,
    borderColor: colors.lilac,
  },
  lang: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
  },
});
