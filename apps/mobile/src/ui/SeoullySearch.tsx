import type { ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, radii } from "../theme";
import { IconSearch } from "./icons";
import { pressShift, useReduceMotion } from "./motion";
import { SeoullyAvatar } from "./SeoullyAvatar";
import { SeoullyText } from "./SeoullyText";

export function SeoullySearchField({
  value,
  placeholder,
  label,
  clearLabel,
  onChange,
  onSubmit,
  onClear,
}: {
  value: string;
  placeholder: string;
  label: string;
  clearLabel: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  return (
    <View style={styles.field}>
      <View pointerEvents="none" style={styles.fieldIcon}>
        <IconSearch color={colors.muted} size={20} />
      </View>
      <TextInput
        accessibilityLabel={label}
        autoCorrect={false}
        autoCapitalize="none"
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        style={styles.input}
      />
      {value.trim() ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onClear} style={styles.clear}>
          <SeoullyText variant="button" color={colors.plum}>{clearLabel}</SeoullyText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SeoullyExploreDest({
  title,
  hint,
  icon,
  iconBackground,
  suggested = false,
  onPress,
}: {
  title: string;
  hint: string;
  icon: ReactNode;
  iconBackground: string;
  suggested?: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.dest,
        suggested && styles.destSuggested,
        pressShift(pressed, reduceMotion),
      ]}
    >
      <View style={[styles.destIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.destCopy}>
        <SeoullyText variant="handle" style={styles.destTitle}>{title}</SeoullyText>
        <SeoullyText variant="caption" numberOfLines={2} style={styles.destHint}>{hint}</SeoullyText>
      </View>
    </Pressable>
  );
}

export function SeoullySearchRow({
  title,
  meta,
  reason,
  leading,
  trailing,
  staticRow = false,
  onPress,
}: {
  title: string;
  meta?: string;
  reason?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  staticRow?: boolean;
  onPress?: () => void;
}) {
  const reduceMotion = useReduceMotion();
  const body = (
    <>
      {leading ?? null}
      <View style={styles.rowCopy}>
        <SeoullyText variant="handle" numberOfLines={1}>{title}</SeoullyText>
        {meta ? <SeoullyText variant="secondary" numberOfLines={1}>{meta}</SeoullyText> : null}
        {reason ? <SeoullyText variant="caption" color={colors.plum}>{reason}</SeoullyText> : null}
      </View>
      {trailing ?? null}
    </>
  );
  if (staticRow || !onPress) {
    return <View style={styles.row}>{body}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed, pressShift(pressed, reduceMotion)]}
    >
      {body}
    </Pressable>
  );
}

export function SeoullyExploreRoom({
  name,
  identity,
  match,
  reason,
  enterLabel,
  onEnter,
}: {
  name: string;
  identity?: string;
  match?: string;
  reason?: string;
  enterLabel: string;
  onEnter: () => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <View style={styles.room}>
      <View style={styles.who}>
        <SeoullyAvatar name={name} size={48} />
        <View style={styles.roomCopy}>
          <SeoullyText variant="title" style={styles.roomName} numberOfLines={1}>{name}</SeoullyText>
          {identity ? <SeoullyText variant="secondary" numberOfLines={1}>{identity}</SeoullyText> : null}
          {match ? <SeoullyText variant="handle" color={colors.plum}>{match}</SeoullyText> : null}
          {reason ? <SeoullyText variant="caption" color={colors.plum}>{reason}</SeoullyText> : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onEnter}
        style={({ pressed }) => [styles.enter, pressShift(pressed, reduceMotion)]}
      >
        <SeoullyText variant="handle" color={colors.onPrimary}>{enterLabel}</SeoullyText>
      </Pressable>
    </View>
  );
}

export function SeoullyCollectibleMark() {
  return <View style={styles.markFace} />;
}

const styles = StyleSheet.create({
  field: { justifyContent: "center", marginTop: 8 },
  fieldIcon: { left: 12, position: "absolute", zIndex: 1 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingLeft: 42,
    paddingRight: 72,
  },
  clear: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    minWidth: 44,
    paddingHorizontal: 10,
    position: "absolute",
    right: 6,
  },
  dest: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  destSuggested: {
    borderColor: colors.lilac,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 0,
  },
  destIcon: {
    alignItems: "center",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  destCopy: { flex: 1, gap: 2, minWidth: 0 },
  destTitle: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2 },
  destHint: { fontSize: 13, lineHeight: 17 },
  row: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: colors.mist },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  room: {
    backgroundColor: colors.mist,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  who: { flexDirection: "row", gap: 12 },
  roomCopy: { flex: 1, gap: 3, minWidth: 0 },
  roomName: { fontSize: 18, letterSpacing: -0.4, lineHeight: 22 },
  enter: {
    alignItems: "center",
    backgroundColor: colors.action,
    borderRadius: radii.button,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 44,
  },
  markFace: {
    backgroundColor: colors.lilacSoft,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    width: 32,
  },
});
