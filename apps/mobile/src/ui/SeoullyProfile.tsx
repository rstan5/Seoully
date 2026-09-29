import { Image, Pressable, StyleSheet, View } from "react-native";
import type { SocialTheme } from "../data/types";
import { PROFILE_VEIL, colors, elevation } from "../theme";
import { SeoullyAvatar } from "./SeoullyAvatar";
import { SeoullyChip } from "./SeoullyControls";
import { SeoullyText } from "./SeoullyText";

export function formatCollectingSince(iso: string, locale: "en" | "ko") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "long", year: "numeric" });
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.trim().replace("#", "");
  if (value.length !== 6) return `rgba(255, 241, 244, ${alpha})`;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return `rgba(255, 241, 244, ${alpha})`;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Profile composition (ONE WORLD):
 *
 *   <SeoullyRoomUnderlay />   // later: NativeRoomRenderer (actual Room/placements/objects)
 *   <SeoullyProfileVeil />    // ~85% mist, matching web --s-profile-veil
 *   identity / actions / shelves  // fully opaque children
 *
 * Temporary pre-Room: theme paper only. Do not draw fake objects, shelves, or placements.
 */
export function SeoullyRoomUnderlay({ theme }: { theme?: SocialTheme }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: theme?.paper ?? colors.canvas }]}
    />
  );
}

export function SeoullyProfileVeil({ theme }: { theme?: SocialTheme }) {
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: hexToRgba(theme?.mist ?? colors.mist, PROFILE_VEIL) }]}
    />
  );
}

export function SeoullyProfileHead({
  name,
  handle,
  counts,
  editLabel,
  onEdit,
  imageUrl,
}: {
  name: string;
  handle: string;
  counts: { label: string; value: number }[];
  editLabel?: string;
  onEdit?: () => void;
  imageUrl?: string;
}) {
  return (
    <View style={styles.head}>
      <View style={styles.avatarRing}>
        <SeoullyAvatar name={name} size={86} imageUrl={imageUrl} />
      </View>
      <View style={styles.copy}>
        <SeoullyText variant="title">{name}</SeoullyText>
        <SeoullyText variant="handle" color={colors.muted} style={styles.handle}>@{handle}</SeoullyText>
        {editLabel && onEdit ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onEdit} style={styles.edit}>
            <SeoullyText variant="caption" color={colors.plum}>{editLabel}</SeoullyText>
          </Pressable>
        ) : null}
        <View style={styles.counts}>
          {counts.map((count) => (
            <SeoullyText key={count.label} variant="caption" color="#555555">
              <SeoullyText variant="handle">{count.value}</SeoullyText>
              {" "}
              {count.label}
            </SeoullyText>
          ))}
        </View>
      </View>
    </View>
  );
}

export function SeoullyProfileMeta({
  bio,
  location,
  since,
  collectorType,
}: {
  bio?: string;
  location?: string;
  since?: string;
  collectorType?: string;
}) {
  return (
    <View>
      {bio ? <SeoullyText variant="body" style={styles.bio}>{bio}</SeoullyText> : null}
      {location ? <SeoullyText variant="secondary" style={styles.meta}>{location}</SeoullyText> : null}
      {since ? <SeoullyText variant="secondary" style={styles.meta}>{since}</SeoullyText> : null}
      {collectorType ? (
        <View style={styles.archetype}>
          <SeoullyChip label={collectorType} tone="type" />
        </View>
      ) : null}
    </View>
  );
}

export function SeoullyOwnedRow({
  title,
  meta,
  imageUrl,
  colorway,
  tradeLabel,
  removeLabel,
  onOpen,
  onToggleTrade,
  onRemove,
}: {
  title: string;
  meta?: string;
  imageUrl?: string;
  colorway?: { base: string; accent: string; ink: string };
  tradeLabel?: string;
  removeLabel?: string;
  onOpen?: () => void;
  onToggleTrade?: () => void;
  onRemove?: () => void;
}) {
  return (
    <View style={styles.owned}>
      <SeoullyShelfRow
        title={title}
        meta={meta}
        imageUrl={imageUrl}
        colorway={colorway}
        onPress={onOpen}
      />
      {tradeLabel || removeLabel ? (
        <View style={styles.ownedActions}>
          {tradeLabel && onToggleTrade ? (
            <Pressable accessibilityRole="button" onPress={onToggleTrade} style={styles.ownedAction}>
              <SeoullyText variant="caption" color={colors.plum}>{tradeLabel}</SeoullyText>
            </Pressable>
          ) : null}
          {removeLabel && onRemove ? (
            <Pressable accessibilityRole="button" onPress={onRemove} style={styles.ownedAction}>
              <SeoullyText variant="caption" color={colors.plum}>{removeLabel}</SeoullyText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function SeoullyObjectTile({
  colorway,
  imageUrl,
  height = 52,
}: {
  colorway?: { base: string; accent: string; ink: string };
  imageUrl?: string;
  height?: number;
}) {
  const width = height * 0.68;
  if (imageUrl) {
    return <Image accessibilityIgnoresInvertColors source={{ uri: imageUrl }} style={{ borderRadius: 4, height, width }} />;
  }
  return (
    <View style={{
      backgroundColor: colorway?.base ?? colors.lilacSoft,
      borderColor: colorway?.accent ?? colors.lilac,
      borderRadius: 4,
      borderWidth: StyleSheet.hairlineWidth,
      height,
      overflow: "hidden",
      width,
    }}>
      <View style={{ backgroundColor: colorway?.accent ?? colors.pink, height: 6, opacity: 0.7 }} />
    </View>
  );
}

export function SeoullyHighlight({
  name,
  countLabel,
  imageUrl,
  colorway,
}: {
  name: string;
  countLabel: string;
  imageUrl?: string;
  colorway?: { base: string; accent: string; ink: string };
}) {
  return (
    <View style={styles.highlight}>
      <SeoullyObjectTile colorway={colorway} imageUrl={imageUrl} />
      <SeoullyText variant="caption" color={colors.ink} numberOfLines={1} style={styles.highlightName}>{name}</SeoullyText>
      <SeoullyText variant="caption">{countLabel}</SeoullyText>
    </View>
  );
}

export function SeoullyShelfRow({
  title,
  meta,
  imageUrl,
  colorway,
  action,
  onPress,
}: {
  title: string;
  meta?: string;
  imageUrl?: string;
  colorway?: { base: string; accent: string; ink: string };
  action?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      <SeoullyObjectTile colorway={colorway} imageUrl={imageUrl} height={52} />
      <View style={styles.rowCopy}>
        <SeoullyText variant="handle" numberOfLines={1}>{title}</SeoullyText>
        {meta ? <SeoullyText variant="caption" numberOfLines={1}>{meta}</SeoullyText> : null}
      </View>
      {action ? <SeoullyText variant="caption" color={colors.plum}>{action}</SeoullyText> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: "center", flexDirection: "row", gap: 16 },
  avatarRing: {
    backgroundColor: colors.surface,
    borderColor: colors.lilac,
    borderRadius: 47,
    borderWidth: 2,
    padding: 2,
  },
  copy: { flex: 1, minWidth: 0 },
  handle: { marginTop: 2 },
  edit: { alignSelf: "flex-start", justifyContent: "center", minHeight: 32, paddingVertical: 4 },
  counts: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  bio: { lineHeight: 20, marginTop: 14 },
  meta: { marginTop: 4 },
  archetype: { marginTop: 14 },
  highlight: {
    alignItems: "center",
    backgroundColor: colors.cream,
    borderColor: "#f6e6e0",
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
    minWidth: 76,
    paddingHorizontal: 8,
    paddingVertical: 10,
    ...elevation.card,
  },
  highlightName: { fontSize: 11, textAlign: "center" },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
  },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
  owned: { paddingBottom: 4 },
  ownedActions: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingBottom: 8, paddingLeft: 64 },
  ownedAction: { justifyContent: "center", minHeight: 32, paddingVertical: 4 },
});
