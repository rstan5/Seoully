import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, elevation, radii, sizes, spacing } from "../theme";
import type { NativeFeedPost, NativePostComment } from "../api";
import type { MobileCopy } from "../i18n";
import { IconComment, IconHeart } from "./icons";
import { pressShift, useReduceMotion } from "./motion";
import { SeoullyAvatar } from "./SeoullyAvatar";
import { SeoullyIconButton } from "./SeoullyIconButton";
import { SeoullyText } from "./SeoullyText";

export function formatPostTime(iso: string, locale: "en" | "ko") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
}

export function SeoullyMedia({ url, label }: { url: string; label?: string }) {
  return (
    <View style={styles.mediaWrap}>
      <Image accessibilityIgnoresInvertColors accessibilityLabel={label} source={{ uri: url }} style={styles.media} />
    </View>
  );
}

export function SeoullyCollectorIdentity({
  handle,
  location,
  onPress,
}: {
  handle: string;
  location?: string | null;
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.who, pressShift(pressed, reduceMotion)]}
    >
      <SeoullyAvatar name={handle} />
      <View>
        <SeoullyText variant="handle">{handle}</SeoullyText>
        {location ? <SeoullyText variant="metadata">{location}</SeoullyText> : null}
      </View>
    </Pressable>
  );
}

export function SeoullyCollectiblePreview({ name, kind }: { name: string; kind: string }) {
  return (
    <View style={styles.collectible}>
      <View style={styles.collectibleSwatch} />
      <View style={styles.collectibleCopy}>
        <SeoullyText variant="caption" color={colors.ink} numberOfLines={1}>{name}</SeoullyText>
        <SeoullyText variant="metadata" numberOfLines={1}>{kind}</SeoullyText>
      </View>
    </View>
  );
}

export function SeoullyPost({
  item,
  copy,
  locale,
  comments,
  commentCursor,
  commentBody,
  commentError,
  busy,
  onOpenCollector,
  onToggleLike,
  onToggleComments,
  onLoadMoreComments,
  onChangeComment,
  onSubmitComment,
  onRetryComments,
}: {
  item: NativeFeedPost;
  copy: MobileCopy;
  locale: "en" | "ko";
  comments: NativePostComment[] | null;
  commentCursor: string | null;
  commentBody: string;
  commentError: string | null;
  busy: boolean;
  onOpenCollector: (userId?: string) => void;
  onToggleLike: () => void;
  onToggleComments: () => void;
  onLoadMoreComments: () => void;
  onChangeComment: (value: string) => void;
  onSubmitComment: () => void;
  onRetryComments: () => void;
}) {
  const image = item.media.find((media) => media.mediaType === "image");
  const likeLabel = item.likeCount === 1 ? copy.likeOne : copy.likeMany.replace("{count}", String(item.likeCount));

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <SeoullyCollectorIdentity
          handle={item.author.handle}
          location={item.location}
          onPress={() => onOpenCollector(item.author.userId)}
        />
        <SeoullyText variant="metadata">{formatPostTime(item.createdAt, locale)}</SeoullyText>
      </View>
      {image ? <SeoullyMedia url={image.url} /> : null}
      <View style={styles.actions}>
        <SeoullyIconButton label={item.likedByMe ? copy.unlike : copy.like} selected={item.likedByMe} disabled={busy} onPress={onToggleLike}>
          <IconHeart color={item.likedByMe ? colors.like : colors.ink} filled={item.likedByMe} />
        </SeoullyIconButton>
        <SeoullyIconButton label={comments ? copy.hideComments : copy.viewComments} onPress={onToggleComments}>
          <IconComment color={colors.ink} />
        </SeoullyIconButton>
      </View>
      {item.likeCount > 0 ? <SeoullyText variant="handle" style={styles.block}>{likeLabel}</SeoullyText> : null}
      <SeoullyText variant="body" style={styles.caption}>
        <SeoullyText variant="handle" onPress={() => onOpenCollector(item.author.userId)}>{item.author.handle}</SeoullyText>
        {"  "}
        {item.caption || copy.sharedMoment}
      </SeoullyText>
      {item.taggedUsers && item.taggedUsers.length > 0 ? (
        <View style={styles.tags}>
          <SeoullyText variant="metadata">{copy.with}{" "}</SeoullyText>
          {item.taggedUsers.map((user, index) => (
            <SeoullyText
              key={user.userId}
              variant="handle"
              color={colors.plum}
              onPress={() => onOpenCollector(user.userId)}
            >
              {user.handle}{index < item.taggedUsers!.length - 1 ? ", " : ""}
            </SeoullyText>
          ))}
        </View>
      ) : null}
      {item.taggedCollectibles && item.taggedCollectibles.length > 0 ? (
        <View style={styles.collectibles}>
          {item.taggedCollectibles.map((tag) => (
            <SeoullyCollectiblePreview key={tag.templateId} name={tag.name} kind={tag.kind} />
          ))}
        </View>
      ) : null}
      {commentError ? (
        <Pressable accessibilityRole="button" onPress={onRetryComments} style={styles.retry}>
          <SeoullyText variant="secondary" color={colors.plum}>{commentError} · {copy.retry}</SeoullyText>
        </Pressable>
      ) : null}
      {comments ? (
        <View style={styles.comments}>
          {comments.map((comment) => (
            <SeoullyText key={comment.id} variant="body" style={styles.comment}>
              <SeoullyText variant="handle" onPress={() => onOpenCollector(comment.author.userId)}>{comment.author.handle}</SeoullyText>
              {"  "}
              {comment.body}
            </SeoullyText>
          ))}
          {commentCursor ? (
            <Pressable accessibilityRole="button" onPress={onLoadMoreComments}>
              <SeoullyText variant="metadata" color={colors.plum}>{copy.loadMoreComments}</SeoullyText>
            </Pressable>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel={copy.commentPlaceholder}
              placeholder={copy.commentPlaceholder}
              placeholderTextColor={colors.muted}
              value={commentBody}
              onChangeText={onChangeComment}
              onSubmitEditing={onSubmitComment}
              style={styles.input}
            />
            <Pressable accessibilityRole="button" disabled={!commentBody.trim() || busy} onPress={onSubmitComment}>
              <SeoullyText variant="button" color={commentBody.trim() ? colors.plum : colors.muted}>{copy.postComment}</SeoullyText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    backgroundColor: "transparent",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 20,
  },
  head: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.post,
    paddingVertical: 10,
  },
  who: { alignItems: "center", flexDirection: "row", gap: spacing.inline },
  mediaWrap: {
    backgroundColor: colors.media,
    borderRadius: radii.card,
    marginHorizontal: 12,
    overflow: "hidden",
    ...elevation.card,
  },
  media: { aspectRatio: 4 / 3, width: "100%" },
  actions: { alignItems: "center", flexDirection: "row", gap: 14, paddingHorizontal: spacing.post, paddingTop: 10 },
  block: { marginTop: 6, paddingHorizontal: spacing.post },
  caption: { marginTop: 6, paddingHorizontal: spacing.post },
  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 5, paddingHorizontal: spacing.post },
  collectibles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, paddingHorizontal: spacing.post },
  collectible: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 7,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  collectibleSwatch: { backgroundColor: colors.pinkSoft, borderRadius: 8, height: sizes.avatarSm - 8, width: sizes.avatarSm - 8 },
  collectibleCopy: { maxWidth: 160 },
  retry: { marginTop: 8, paddingHorizontal: spacing.post },
  comments: { gap: 8, paddingBottom: 8, paddingHorizontal: spacing.post, paddingTop: 8 },
  comment: { lineHeight: 20 },
  composer: { alignItems: "center", flexDirection: "row", gap: 8, paddingTop: 8 },
  input: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 40,
    paddingVertical: 8,
  },
});
