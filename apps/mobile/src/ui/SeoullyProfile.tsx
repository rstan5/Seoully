import { Image, Pressable, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { SeoullyAvatar } from "./SeoullyAvatar";
import { SeoullyChip } from "./SeoullyControls";
import { SeoullyText } from "./SeoullyText";

export function formatCollectingSince(iso: string, locale: "en" | "ko") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "long", year: "numeric" });
}

export function SeoullyProfileHead({
  name,
  handle,
  counts,
  editLabel,
  onEdit,
}: {
  name: string;
  handle: string;
  counts: { label: string; value: number }[];
  editLabel?: string;
  onEdit?: () => void;
}) {
  return (
    <View style={styles.head}>
      <View style={styles.avatarRing}>
        <SeoullyAvatar name={name} size={86} />
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

export function SeoullyHighlight({
  name,
  countLabel,
  imageUrl,
}: {
  name: string;
  countLabel: string;
  imageUrl?: string;
}) {
  return (
    <View style={styles.highlight}>
      {imageUrl ? (
        <Image accessibilityIgnoresInvertColors source={{ uri: imageUrl }} style={styles.highlightMedia} />
      ) : (
        <View style={styles.highlightFallback} />
      )}
      <View style={styles.highlightCopy}>
        <SeoullyText variant="handle" numberOfLines={1}>{name}</SeoullyText>
        <SeoullyText variant="caption">{countLabel}</SeoullyText>
      </View>
    </View>
  );
}

export function SeoullyShelfRow({
  title,
  meta,
  imageUrl,
  action,
  onPress,
}: {
  title: string;
  meta?: string;
  imageUrl?: string;
  action?: string;
  onPress?: () => void;
}) {
  const body = (
    <>
      {imageUrl ? (
        <Image accessibilityIgnoresInvertColors source={{ uri: imageUrl }} style={styles.rowMedia} />
      ) : (
        <View style={styles.rowFallback} />
      )}
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
  highlight: { alignItems: "center", flexDirection: "row", gap: 10, minWidth: 140 },
  highlightMedia: { borderRadius: 8, height: 52, width: 40 },
  highlightFallback: { backgroundColor: colors.lilacSoft, borderRadius: 8, height: 52, width: 40 },
  highlightCopy: { flex: 1, minWidth: 0 },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    minHeight: 64,
    paddingVertical: 8,
  },
  rowMedia: { borderRadius: 8, height: 52, width: 40 },
  rowFallback: { backgroundColor: colors.lilacSoft, borderRadius: 8, height: 52, width: 40 },
  rowCopy: { flex: 1, gap: 2, minWidth: 0 },
});
