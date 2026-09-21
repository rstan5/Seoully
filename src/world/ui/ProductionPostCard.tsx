"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { UserId } from "@/domain/types";
import { productionComment, productionComments, productionLike, productionUnlike } from "@/server/social/actions";
import type { SocialCommentDTO, SocialPostDTO } from "@/server/dal/social";
import { useT } from "@/locale/store";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { IconComment, IconHeart } from "@/world/ui/SocialIcons";

export function ProductionPostCard({ post, viewerId, onViewProfile }: { post: SocialPostDTO; viewerId: UserId; onViewProfile: (userId: UserId) => void }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<SocialCommentDTO[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useT();

  useEffect(() => { setLiked(post.likedByMe); setLikeCount(post.likeCount); }, [post.id, post.likedByMe, post.likeCount]);
  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    const result = liked ? await productionUnlike(post.id) : await productionLike(post.id);
    if (result.ok) { setLiked(result.state.liked); setLikeCount((count) => Math.max(0, count + (result.state.liked ? 1 : -1))); }
    setBusy(false);
  };
  const toggleComments = async () => {
    const next = !commentsOpen; setCommentsOpen(next);
    if (next && comments.length === 0) { const result = await productionComments(post.id, { limit: 25 }); if (result.ok) setComments(result.page.items); }
  };
  const submitComment = async (event: FormEvent) => {
    event.preventDefault(); const body = draft.trim(); if (!body || busy) return;
    setBusy(true); const result = await productionComment(post.id, body);
    if (result.ok) { setComments((items) => [...items, result.comment]); setDraft(""); }
    setBusy(false);
  };
  return (
    <article className="s-post">
      <header className="s-post-head">
        <button type="button" className="s-post-who" onClick={() => onViewProfile(post.author.userId as UserId)}>
          <SocialAvatar user={{ id: post.author.userId as UserId, handle: post.author.handle, displayName: post.author.displayName, joinedAt: post.createdAt.slice(0, 10) }} profile={{ userId: post.author.userId as UserId, tagline: "", bio: "", favoriteGroupIds: [], biasMemberIds: [], favoriteEraIds: [], collectorType: "Collector", avatarColor: "#f6aebf", roomId: "" as never }} size={36} />
          <span><span className="s-post-name">{post.author.handle}</span>{post.location ? <span className="s-post-loc">{post.location}</span> : null}</span>
        </button>
        <time className="s-post-time">{new Date(post.createdAt).toLocaleDateString()}</time>
      </header>
      {post.media[0] ? <div className="s-post-media">{post.media[0].mediaType === "video" ? <video src={post.media[0].url} controls playsInline /> : <img src={post.media[0].url} alt="" />}</div> : null}
      <div className="s-post-actions">
        <button type="button" className={liked ? "is-on" : ""} aria-label={t("post.like")} onClick={() => void toggleLike()}><IconHeart filled={liked} /></button>
        <button type="button" aria-label={t("post.comment")} onClick={() => void toggleComments()}><IconComment /></button>
      </div>
      {likeCount > 0 ? <p className="s-post-likes">{likeCount === 1 ? t("post.likeOne") : t("post.likeMany", { count: likeCount })}</p> : null}
      <p className="s-post-caption"><button type="button" onClick={() => onViewProfile(post.author.userId as UserId)}>{post.author.handle}</button>{" "}{post.caption}</p>
      {commentsOpen ? <div className="s-post-comments">{comments.map((comment) => <p key={comment.id}><button type="button" onClick={() => onViewProfile(comment.author.userId as UserId)}>{comment.author.handle}</button>{" "}{comment.body}</p>)}<form className="s-post-comment-form" onSubmit={(event) => void submitComment(event)}><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder={t("post.addComment")} /><button type="submit" disabled={!draft.trim() || busy}>{t("post.post")}</button></form></div> : null}
    </article>
  );
}
