import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, elevation, radii } from "../theme";
import { pressShift, useReduceMotion } from "./motion";
import { SeoullyText } from "./SeoullyText";

export function SeoullyButton({
  label,
  variant = "primary",
  disabled = false,
  block = false,
  fill = false,
  onPress,
}: {
  label: string;
  variant?: "primary" | "ghost" | "enter";
  disabled?: boolean;
  block?: boolean;
  fill?: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "ghost" && styles.ghost,
        variant === "enter" && styles.enter,
        block && styles.block,
        fill && styles.fill,
        pressShift(pressed, reduceMotion),
      ]}
    >
      <SeoullyText
        variant={variant === "enter" ? "handle" : "button"}
        color={variant === "primary" ? colors.onPrimary : colors.plum}
      >
        {label}
      </SeoullyText>
    </Pressable>
  );
}

export function SeoullyChoiceChip({
  label,
  selected,
  role = "tab",
  onPress,
}: {
  label: string;
  selected: boolean;
  role?: "tab" | "checkbox";
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === "checkbox" ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceSelected,
        pressShift(pressed, reduceMotion),
      ]}
    >
      <SeoullyText variant="caption" color={selected ? colors.plum : colors.ink}>{label}</SeoullyText>
    </Pressable>
  );
}

export function SeoullyChip({
  label,
  tone = "group",
}: {
  label: string;
  tone?: "group" | "bias" | "type";
}) {
  return (
    <View style={[styles.chip, tone === "bias" && styles.chipBias, tone === "type" && styles.chipType]}>
      <SeoullyText variant="caption" color={colors.ink}>{label}</SeoullyText>
    </View>
  );
}

export function SeoullyShelf({
  title,
  count,
  expanded,
  onToggle,
  empty,
  children,
}: {
  title: string;
  count?: number;
  expanded?: boolean;
  onToggle?: () => void;
  empty?: string;
  children?: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const collapsible = count !== undefined && onToggle !== undefined;
  return (
    <View style={styles.shelf}>
      {collapsible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={({ pressed }) => [styles.shelfToggle, pressShift(pressed, reduceMotion)]}
        >
          <SeoullyText variant="handle" color={colors.plum}>{title}</SeoullyText>
          <View style={styles.shelfCount}>
            <SeoullyText variant="caption" color={colors.plum}>{count}</SeoullyText>
          </View>
        </Pressable>
      ) : (
        <SeoullyText variant="handle" color={colors.plum}>{title}</SeoullyText>
      )}
      {(!collapsible || expanded) ? (
        <View style={styles.shelfBody}>
          {children}
          {empty ? <SeoullyText variant="secondary" style={styles.shelfEmpty}>{empty}</SeoullyText> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    backgroundColor: colors.action,
    borderRadius: radii.button,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
    ...elevation.raise,
  },
  block: {
    alignSelf: "stretch",
    width: "100%",
  },
  fill: {
    flex: 1,
  },
  ghost: {
    backgroundColor: colors.lilacSoft,
  },
  enter: {
    alignSelf: "stretch",
    backgroundColor: colors.surface,
    borderColor: colors.lilac,
    borderWidth: 1,
    flexGrow: 0,
    minHeight: 44,
    width: "100%",
  },
  chip: {
    backgroundColor: colors.lilacSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipBias: { backgroundColor: colors.peach },
  chipType: { backgroundColor: colors.pinkSoft, paddingHorizontal: 12, paddingVertical: 6 },
  choice: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  choiceSelected: {
    backgroundColor: colors.lilacSoft,
    borderColor: colors.lilac,
  },
  shelf: { marginTop: 18, paddingHorizontal: 16 },
  shelfToggle: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    minHeight: 44,
  },
  shelfBody: { paddingTop: 6 },
  shelfEmpty: { marginTop: 10 },
  shelfCount: {
    alignItems: "center",
    backgroundColor: colors.lilacSoft,
    borderRadius: 999,
    justifyContent: "center",
    minHeight: 18,
    minWidth: 18,
    paddingHorizontal: 5,
  },
});
