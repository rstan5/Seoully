import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, sizes } from "../theme";
import { pressShift, useReduceMotion } from "./motion";

export function SeoullyIconButton({
  label,
  selected = false,
  disabled = false,
  onPress,
  children,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        selected && styles.selected,
        pressShift(pressed, reduceMotion),
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: sizes.iconButton / 2,
    height: sizes.iconButton,
    justifyContent: "center",
    margin: -4,
    width: sizes.iconButton,
  },
  selected: { backgroundColor: colors.mist },
});
