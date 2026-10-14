import { PhotocardCollectorCount } from "./PhotocardCollectorCount";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { colors, elevation, radii, spacing } from "../theme";
import type { NativeFeedPost, NativePostComment } from "../api";
import type { MobileCopy } from "../i18n";
import { IconBookmark, IconComment, IconHeart, IconPlay, IconRepost, IconShare } from "./icons";
import { pressShift, useReduceMotion } from "./motion";
import { useProfileIdentity, useProfileInk } from "./ProfileIdentity";
import { SeoullyAvatar } from "./SeoullyAvatar";
import { SeoullyIconButton } from "./SeoullyIconButton";
import { SeoullyText } from "./SeoullyText";

export function formatPostTime(iso: string, locale: "en" | "ko") {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US", { month: "short", day: "numeric" });
}

export function SeoullyMedia({
  item,
  copy,
}: {
  item: NativeFeedPost;
  copy: MobileCopy;
}) {
  const [index, setIndex] = useState(0);
  const current = item.media[index];
  if (!current) return null;
  const video = current.mediaType === "video";
  return (
    <View style={styles.mediaWrap}>
      <Image accessibilityIgnoresInvertColors source={{ uri: current.url }} style={styles.media} />
      {video ? (
        <View pointerEvents="none" style={styles.play}>
          <IconPlay color="#fff" />
          {current.duration ? <SeoullyText variant="caption" color="#fff">{current.duration}</SeoullyText> : (
            <SeoullyText variant="caption" color="#fff">{copy.playVideo}</SeoullyText>
          )}
        </View>
      ) : null}
      {item.media.length > 1 ? (
        <View style={styles.dots}>
          {item.media.map((media, mediaIndex) => (
            <Pressable
              key={`${media.url}-${mediaIndex}`}
              accessibilityRole="button"
              accessibilityLabel={copy.playVideo}
              onPress={() => setIndex(mediaIndex)}
              style={[styles.dot, mediaIndex === index && styles.dotOn]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function SeoullyCollectorIdentity({
  name,
  handle,
  location,
  imageUrl,
  onPress,
}: {
  name: string;
  handle: string;
  location?: string | null;
  imageUrl?: string;
  onPress: () => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.who, pressShift(pressed, reduceMotion)]}
    >
      <SeoullyAvatar name={name} imageUrl={imageUrl} />
      <View>
        <SeoullyText variant="handle">{handle}</SeoullyText>
        {location ? <SeoullyText variant="metadata">{location}</SeoullyText> : null}
      </View>
    </Pressable>
  );
}

export function SeoullyCollectiblePreview({
  templateId,
  name,
  kind,
  colorway,
}: {
  templateId?: string;
  name: string;
  kind: string;
  colorway?: { base: string; accent: string; ink: string };
}) {
  const router = useRouter();
  const ink = useProfileInk();
  const identity = useProfileIdentity();
  const surface = identity
    ? { backgroundColor: identity.paper, borderColor: identity.line }
    : { backgroundColor: colors.blush, borderColor: colors.lilac };
  const kindColor = identity?.mute ?? colors.muted;
  return (
    <Pressable accessibilityRole={templateId ? "button" : undefined} accessibilityLabel={name} disabled={!templateId} onPress={() => templateId && router.push({ pathname: "/public-collectible", params: { templateId, name } })} style={[styles.collectible, surface]}>
      <View style={[styles.collectibleSwatch, colorway ? { backgroundColor: colorway.base, borderColor: colorway.accent } : null]} />
      <View style={styles.collectibleCopy}>
        <SeoullyText variant="caption" color={ink} numberOfLines={1}>{name}</SeoullyText>
        <SeoullyText variant="metadata" color={kindColor} numberOfLines={1}>{kind}</SeoullyText>
        {templateId ? <PhotocardCollectorCount templateId={templateId} kind={kind} /> : null}
      </View>
    </Pressable>
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
  notice,
  busy,
  onOpenCollector,
  onToggleLike,
  onToggleComments,
  onToggleRepost,
  onShare,
  onToggleSave,
  canRepost = true,
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
  notice?: string | null;
  busy: boolean;
  onOpenCollector: (userId?: string) => void;
  onToggleLike: () => void;
  onToggleComments: () => void;
  onToggleRepost: () => void;
  onShare?: () => void;
  onToggleSave?: () => void;
  canRepost?: boolean;
  onLoadMoreComments: () => void;
  onChangeComment: (value: string) => void;
  onSubmitComment: () => void;
  onRetryComments: () => void;
}) {
  const router = useRouter();
  const likeLabel = item.likeCount === 1 ? copy.likeOne : copy.likeMany.replace("{count}", String(item.likeCount));
  const captionAuthor = item.originAuthor ?? item.author;
  const showRepost = Boolean(canRepost);
  const collectible = Boolean(item.taggedCollectibles && item.taggedCollectibles.length > 0);
  const ink = useProfileInk();

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <SeoullyCollectorIdentity
          name={item.author.displayName}
          handle={item.author.handle}
          location={item.location}
          imageUrl={item.authorAvatarUrl}
          onPress={() => onOpenCollector(item.author.userId)}
        />
        <SeoullyText variant="metadata">{formatPostTime(item.createdAt, locale)}</SeoullyText>
      </View>
      {item.repostOf && item.originAuthor ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/post", params: { postId: item.repostOf!, authorId: item.originAuthor!.userId } })} style={styles.repostLine}>
          <SeoullyText variant="metadata">{item.reposter ? `${item.reposter.handle} · ` : ""}{copy.repostedFrom.replace("{handle}", item.originAuthor.handle)}</SeoullyText>
        </Pressable>
      ) : null}
      {item.media.length > 0 ? <SeoullyMedia item={item} copy={copy} /> : null}
      <View style={styles.actions}>
        <SeoullyIconButton label={item.likedByMe ? copy.unlike : copy.like} selected={item.likedByMe} disabled={busy} onPress={onToggleLike}>
          <IconHeart color={item.likedByMe ? colors.like : ink} filled={item.likedByMe} />
        </SeoullyIconButton>
        <SeoullyIconButton label={comments ? copy.hideComments : copy.comment} onPress={onToggleComments}>
          <IconComment color={ink} />
        </SeoullyIconButton>
        {showRepost ? (
          <SeoullyIconButton label={item.repostedByMe ? copy.unrepost : copy.repost} selected={item.repostedByMe} disabled={busy} onPress={onToggleRepost}>
            <IconRepost color={item.repostedByMe ? colors.repost : ink} />
          </SeoullyIconButton>
        ) : null}
        {onShare ? (
          <SeoullyIconButton label={copy.shareAction} onPress={onShare}>
            <IconShare color={ink} />
          </SeoullyIconButton>
        ) : null}
        {collectible && onToggleSave ? (
          <View style={styles.save}>
            <SeoullyIconButton label={item.savedByMe ? copy.unsaveWishlist : copy.saveWishlist} selected={item.savedByMe} onPress={onToggleSave}>
              <IconBookmark color={item.savedByMe ? colors.plum : ink} filled={item.savedByMe} />
            </SeoullyIconButton>
          </View>
        ) : null}
      </View>
      {item.likeCount > 0 ? <SeoullyText variant="handle" style={styles.block}>{likeLabel}</SeoullyText> : null}
      <SeoullyText variant="body" style={styles.caption}>
        <SeoullyText variant="handle" onPress={() => onOpenCollector(captionAuthor.userId)}>{captionAuthor.handle}</SeoullyText>
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
            <SeoullyCollectiblePreview key={tag.templateId} templateId={tag.templateId} name={tag.name} kind={tag.kind} colorway={tag.colorway} />
          ))}
        </View>
      ) : null}
      {notice ? <SeoullyText variant="metadata" style={styles.notice}>{notice}</SeoullyText> : null}
      {commentError ? (
        <Pressable accessibilityRole="button" onPress={onRetryComments} style={styles.retry}>
          <SeoullyText variant="secondary" color={colors.plum}>{commentError} · {copy.retry}</SeoullyText>
        </Pressable>
      ) : null}
      {item.commentCount > 0 && !comments ? (
        <Pressable accessibilityRole="button" onPress={onToggleComments} style={styles.viewComments}>
          <SeoullyText variant="metadata">
            {item.commentCount === 1 ? copy.viewComment : copy.viewCommentsMany.replace("{count}", String(item.commentCount))}
          </SeoullyText>
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
              style={[styles.input, { color: ink }]}
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
  repostLine: { marginTop: -4, paddingBottom: 8, paddingHorizontal: spacing.post },
  mediaWrap: {
    backgroundColor: colors.media,
    borderRadius: radii.card,
    marginHorizontal: 12,
    overflow: "hidden",
    ...elevation.card,
  },
  media: { aspectRatio: 4 / 3, width: "100%" },
  play: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  dots: {
    bottom: 10,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
  },
  dot: { backgroundColor: "rgba(255,255,255,0.45)", borderRadius: 3, height: 6, width: 6 },
  dotOn: { backgroundColor: "#fff" },
  actions: { alignItems: "center", flexDirection: "row", gap: 14, paddingHorizontal: spacing.post, paddingTop: 10 },
  save: { marginLeft: "auto" },
  block: { marginTop: 6, paddingHorizontal: spacing.post },
  caption: { marginTop: 6, paddingHorizontal: spacing.post },
  tags: { flexDirection: "row", flexWrap: "wrap", marginTop: 5, paddingHorizontal: spacing.post },
  collectibles: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, paddingHorizontal: spacing.post },
  collectible: {
    alignItems: "center",
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 7,
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingLeft: 4,
    paddingVertical: 4,
  },
  collectibleSwatch: {
    backgroundColor: colors.pinkSoft,
    borderColor: colors.lilac,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    height: 34,
    width: 22,
  },
  collectibleCopy: { maxWidth: 160 },
  notice: { marginTop: 6, paddingHorizontal: spacing.post },
  retry: { marginTop: 8, paddingHorizontal: spacing.post },
  viewComments: { marginTop: 6, paddingHorizontal: spacing.post },
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
