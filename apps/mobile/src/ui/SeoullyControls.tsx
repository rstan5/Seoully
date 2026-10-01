import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, elevation, radii } from "../theme";
import { pressShift, useReduceMotion } from "./motion";
import { useProfileIdentity } from "./ProfileIdentity";
import { profileControlSurfaces } from "./profileContrast";
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
  const identity = useProfileIdentity();
  const chrome = identity ? profileControlSurfaces(identity) : null;
  const labelColor = variant === "primary"
    ? (identity?.onPrimary ?? colors.onPrimary)
    : (identity?.primaryDeep ?? colors.plum);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        identity && variant === "primary"
          ? { backgroundColor: identity.action, borderColor: chrome?.actionBorder, borderWidth: 1 }
          : null,
        variant === "ghost" && styles.ghost,
        identity && variant === "ghost"
          ? { backgroundColor: identity.primarySoft, borderColor: chrome?.ghostBorder, borderWidth: 1 }
          : null,
        variant === "enter" && styles.enter,
        identity && variant === "enter"
          ? { backgroundColor: identity.paper, borderColor: chrome?.enterBorder }
          : null,
        block && styles.block,
        fill && styles.fill,
        pressShift(pressed, reduceMotion),
      ]}
    >
      <SeoullyText
        variant={variant === "enter" ? "handle" : "button"}
        color={labelColor}
        numberOfLines={fill ? 2 : 1}
        style={styles.label}
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
  const identity = useProfileIdentity();
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityState={role === "checkbox" ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choice,
        identity ? { backgroundColor: identity.paper, borderColor: identity.line } : null,
        selected && styles.choiceSelected,
        identity && selected
          ? { backgroundColor: identity.primarySoft, borderColor: identity.primary }
          : null,
        pressShift(pressed, reduceMotion),
      ]}
    >
      <SeoullyText variant="caption" color={selected ? (identity?.primaryDeep ?? colors.plum) : (identity?.ink ?? colors.ink)}>{label}</SeoullyText>
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
  const identity = useProfileIdentity();
  const chrome = identity ? profileControlSurfaces(identity) : null;
  const backgroundColor = identity
    ? (tone === "group" ? identity.primarySoft : identity.secondarySoft)
    : undefined;
  const color = identity
    ? (tone === "group" ? identity.primaryDeep : tone === "type" ? chrome?.chipTypeInk : chrome?.chipBiasInk)
    : colors.ink;
  return (
    <View style={[
      styles.chip,
      tone === "bias" && styles.chipBias,
      tone === "type" && styles.chipType,
      backgroundColor ? { backgroundColor } : null,
    ]}>
      <SeoullyText variant="caption" color={color}>{label}</SeoullyText>
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
  const identity = useProfileIdentity();
  const accent = identity?.primaryDeep ?? colors.plum;
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
          <SeoullyText variant="handle" color={accent}>{title}</SeoullyText>
          <View style={[styles.shelfCount, identity ? { backgroundColor: identity.primarySoft } : null]}>
            <SeoullyText variant="caption" color={accent}>{count}</SeoullyText>
          </View>
        </Pressable>
      ) : (
        <SeoullyText variant="handle" color={accent}>{title}</SeoullyText>
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
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 8,
    ...elevation.raise,
  },
  label: {
    textAlign: "center",
    width: "100%",
  },
  block: {
    alignSelf: "stretch",
    width: "100%",
  },
  fill: {
    flex: 1,
    minWidth: 0,
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
