import { useState } from "react";
import { useRouter } from "expo-router";
import type { NativeFeedPost, NativePostComment } from "../api";
import { useSocialRepository } from "../data";
import type { MobileCopy } from "../i18n";
import { SeoullyPost } from "./SeoullyPost";

export function SeoullyFeedPost({
  item,
  copy,
  locale,
  onChange,
  onRemoveRepost,
}: {
  item: NativeFeedPost;
  copy: MobileCopy;
  locale: "en" | "ko";
  onChange: (post: NativeFeedPost) => void;
  onRemoveRepost?: () => void;
}) {
  const router = useRouter();
  const social = useSocialRepository();
  const [comments, setComments] = useState<NativePostComment[] | null>(null);
  const [commentCursor, setCommentCursor] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const viewerId = social.viewerId();

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice((current) => (current === text ? null : current)), 1400);
  }

  function openCollector(userId?: string) {
    if (!userId) return;
    router.push({ pathname: "/collector", params: { userId } });
  }

  async function toggleLike() {
    if (busy) return;
    const nextLiked = !item.likedByMe;
    const optimistic = { ...item, likedByMe: nextLiked, likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)) };
    onChange(optimistic);
    setBusy(true);
    try { await social.setPostLiked(item.id, nextLiked); }
    catch { onChange(item); }
    finally { setBusy(false); }
  }

  async function toggleComments() {
    if (comments) {
      setComments(null);
      setCommentCursor(null);
      return;
    }
    await loadComments();
  }

  async function loadComments(cursor?: string) {
    setCommentError(null);
    try {
      const page = await social.loadPostComments(item.id, cursor);
      setComments((current) => cursor ? [...(current ?? []), ...page.items.filter((comment) => !(current ?? []).some((existing) => existing.id === comment.id))] : page.items);
      setCommentCursor(page.nextCursor);
    } catch { setCommentError(copy.commentsUnavailable); }
  }

  async function submitComment() {
    const body = commentBody.trim();
    if (!body || busy) return;
    setBusy(true);
    setCommentError(null);
    try {
      const comment = await social.addPostComment(item.id, body);
      setComments((current) => [...(current ?? []), comment]);
      setCommentBody("");
      onChange({ ...item, commentCount: item.commentCount + 1 });
    } catch {
      setCommentError(copy.commentFailed);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRepost() {
    if (busy) return;
    const next = !item.repostedByMe;
    onChange({ ...item, repostedByMe: next });
    setBusy(true);
    try {
      const result = await social.setPostReposted(item.id, next);
      if (!result.persisted) onChange(item);
      if (result.persisted && !next && item.repostOf) onRemoveRepost?.();
      flash(result.persisted ? (next ? copy.flashReposted : copy.flashUnreposted) : copy.repostUnavailable);
    } catch {
      onChange(item);
      flash(copy.repostUnavailable);
    } finally {
      setBusy(false);
    }
  }

  function share() {
    router.push({
      pathname: "/send-to",
      params: {
        postId: item.id,
        caption: item.caption ?? "",
        handle: item.author.handle,
        displayName: item.author.displayName,
        mediaUrl: item.media[0]?.url ?? "",
      },
    });
  }

  async function toggleSave() {
    if (busy) return;
    const next = !item.savedByMe;
    onChange({ ...item, savedByMe: next });
    setBusy(true);
    try {
      const tags = item.taggedCollectibles ?? [];
      await Promise.all(tags.map((tag) => social.setWishlist(tag.templateId, next)));
      flash(next ? copy.flashWishlisted : copy.flashUnwishlisted);
    } catch {
      onChange(item);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SeoullyPost
      item={item}
      copy={copy}
      locale={locale}
      comments={comments}
      commentCursor={commentCursor}
      commentBody={commentBody}
      commentError={commentError}
      notice={notice}
      busy={busy}
      canRepost={social.capabilities.persistRepost && item.repostAvailable !== false && (!viewerId || item.author.userId !== viewerId || Boolean(item.repostOf))}
      onOpenCollector={openCollector}
      onToggleLike={() => { void toggleLike(); }}
      onToggleComments={() => { void toggleComments(); }}
      onToggleRepost={() => { void toggleRepost(); }}
      onShare={social.capabilities.deliverShare ? share : undefined}
      onToggleSave={item.taggedCollectibles && item.taggedCollectibles.length > 0 ? () => { void toggleSave(); } : undefined}
      onLoadMoreComments={() => { void loadComments(commentCursor ?? undefined); }}
      onChangeComment={setCommentBody}
      onSubmitComment={() => { void submitComment(); }}
      onRetryComments={() => { void loadComments(); }}
    />
  );
}
