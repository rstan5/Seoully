"use client";

import { useState, type FormEvent } from "react";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { Post, UserId } from "@/domain/types";
import { useLocale, useT } from "@/locale/store";
import { formatShortDate } from "@/locale/translate";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import {
  IconBookmark,
  IconComment,
  IconHeart,
  IconPlay,
  IconRepost,
  IconShare,
} from "@/world/ui/SocialIcons";

export function PostCard({
  post,
  viewerId,
  onViewProfile,
  onShare,
}: {
  post: Post;
  viewerId: UserId;
  onViewProfile: (userId: UserId) => void;
  onShare: (postId: Post["id"]) => void;
}) {
  const revision = useRepoRevision();
  const [openComments, setOpenComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const t = useT();
  const locale = useLocale();

  const author = repository.getUser(post.authorId);
  const profile = repository.getProfile(post.authorId);
  const origin = post.repostOf ? repository.getPost(post.repostOf) ?? post : post;
  const sourceAuthor = repository.getUser(origin.authorId);
  const liked = repository.isLiked(viewerId, origin.id);
  const likes = repository.likeCount(origin.id);
  const comments = repository.listComments(origin.id);
  const reposted = repository.hasReposted(viewerId, origin.id);
  void revision;

  if (!author || !profile) return null;

  const media = origin.media ?? [];
  const current = media[mediaIndex];
  const objects = origin.templateIds
    .map((id) => {
      const template = repository.getTemplate(id);
      if (!template) return null;
      const member = template.memberId ? repository.getMember(template.memberId) : undefined;
      return { template, member };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  const taggedCollectors = (origin.taggedUserIds ?? [])
    .map((id) => repository.getUser(id))
    .filter((user): user is NonNullable<typeof user> => !!user);
  const taggedCollectibles = (origin.taggedTemplateIds ?? [])
    .map((id) => repository.getTemplate(id))
    .filter((template): template is NonNullable<typeof template> => !!template);
  const collectible = objects.length > 0;
  const wished = collectible && objects.every(({ template }) => repository.isWanted(viewerId, template.id));
  const showRepost = origin.authorId !== viewerId || Boolean(post.repostOf);

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote((current) => (current === text ? null : current)), 1200);
  };

  const toggleLike = () => {
    if (liked) repository.unlikePost(viewerId, origin.id);
    else repository.likePost(viewerId, origin.id);
  };

  const toggleRepost = () => {
    if (reposted) {
      repository.unrepostPost(viewerId, origin.id);
      flash(t("post.flashUnreposted"));
      return;
    }
    repository.repostPost(viewerId, origin.id);
    flash(t("post.flashReposted"));
  };

  const toggleWishlist = () => {
    if (!collectible) return;
    if (wished) {
      for (const { template } of objects) repository.removeFromWishlist(viewerId, template.id);
      flash(t("post.flashUnwishlisted"));
      return;
    }
    for (const { template } of objects) repository.addToWishlist(viewerId, template.id);
    flash(t("post.flashWishlisted"));
  };

  const share = () => {
    onShare(origin.id);
  };

  const sendComment = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    repository.addComment({ postId: origin.id, authorId: viewerId, body });
    setDraft("");
    setOpenComments(true);
  };

  return (
    <article className="s-post">
      <header className="s-post-head">
        <button type="button" className="s-post-who" onClick={() => onViewProfile(author.id)}>
          <SocialAvatar user={author} profile={profile} size={36} />
          <span>
            <span className="s-post-name">{author.handle}</span>
            {post.location && !post.repostOf ? <span className="s-post-loc">{post.location}</span> : null}
          </span>
        </button>
        <span className="s-post-time">{formatShortDate(post.createdAt, locale)}</span>
      </header>
      {post.repostOf && sourceAuthor && (
        <button type="button" className="s-post-repost" onClick={() => onViewProfile(sourceAuthor.id)}>
          {t("post.repostedFrom", { handle: sourceAuthor.handle })}
        </button>
      )}

      {current && (
        <div className="s-post-media">
          {isPlayableVideo(current) ? (
            <video src={current.url} controls playsInline poster={current.poster} aria-label={current.alt ?? t("compose.mediaLabel")} />
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.poster ?? current.url} alt={current.alt ?? ""} />
            </>
          )}
          {current.kind === "video" && !isPlayableVideo(current) && (
            <span className="s-post-play">
              <IconPlay />
              {current.duration && <span>{current.duration}</span>}
            </span>
          )}
          {media.length > 1 && (
            <div className="s-post-dots">
              {media.map((item, i) => (
                <button
                  key={`${item.url}-${i}`}
                  type="button"
                  className={i === mediaIndex ? "is-on" : ""}
                  aria-label={t("post.photoN", { n: i + 1 })}
                  onClick={() => setMediaIndex(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {objects.length > 0 && (
        <div className="s-post-objects">
          {objects.map(({ template, member }) => (
            <ObjectTile
              key={template.id}
              template={template}
              {...(member ? { member } : {})}
              height={88}
              ghost={origin.kind === "hunt"}
            />
          ))}
        </div>
      )}

      <div className="s-post-actions">
        <button type="button" className={liked ? "is-on" : ""} aria-label={t("post.like")} onClick={toggleLike}>
          <IconHeart filled={liked} />
        </button>
        <button type="button" aria-label={t("post.comment")} onClick={() => setOpenComments((v) => !v)}>
          <IconComment />
        </button>
        {showRepost && (
          <button
            type="button"
            className={reposted ? "is-on is-repost" : ""}
            aria-label={t("post.repost")}
            onClick={toggleRepost}
          >
            <IconRepost />
          </button>
        )}
        <button type="button" aria-label={t("post.share")} onClick={share}>
          <IconShare />
        </button>
        {collectible && (
          <button
            type="button"
            className={`s-post-save${wished ? " is-on" : ""}`}
            aria-label={t("post.saveWishlist")}
            onClick={toggleWishlist}
          >
            <IconBookmark filled={wished} />
          </button>
        )}
      </div>

      {likes > 0 && <p className="s-post-likes">{likes === 1 ? t("post.likeOne") : t("post.likeMany", { count: likes })}</p>}

      <p className="s-post-caption">
        <button type="button" onClick={() => onViewProfile(sourceAuthor?.id ?? origin.authorId)}>
          {sourceAuthor?.handle ?? author.handle}
        </button>{" "}
        {origin.body}
      </p>

      {taggedCollectors.length > 0 && (
        <div className="s-post-tagged-collectors">
          <span>{taggedCollectors.length === 1 ? t("post.with") : t("post.collectorsTagged", { count: taggedCollectors.length })}</span>
          {taggedCollectors.map((user, index) => (
            <span key={user.id}>
              {index > 0 ? ", " : " "}
              <button type="button" onClick={() => onViewProfile(user.id)}>@{user.handle}</button>
            </span>
          ))}
        </div>
      )}

      {taggedCollectibles.length > 0 && (
        <div className="s-post-tagged-collectibles" aria-label={t("compose.tagCollectibles")}>
          {taggedCollectibles.map((template) => {
            const member = template.memberId ? repository.getMember(template.memberId) : undefined;
            const group = repository.getGroup(template.groupId);
            return (
              <div key={template.id} className="s-post-collectible-tag">
                <ObjectTile template={template} {...(member ? { member } : {})} height={34} />
                <span><strong>{template.name}</strong><em>{[member?.stageName, group?.name].filter(Boolean).join(" · ")}</em></span>
              </div>
            );
          })}
        </div>
      )}

      {note && <p className="s-post-shared">{note}</p>}

      {comments.length > 0 && !openComments && (
        <button type="button" className="s-post-view-comments" onClick={() => setOpenComments(true)}>
          {comments.length === 1 ? t("post.viewComment") : t("post.viewComments", { count: comments.length })}
        </button>
      )}

      {openComments && (
        <div className="s-post-comments">
          {comments.map((comment) => {
            const who = repository.getUser(comment.authorId);
            return (
              <p key={comment.id}>
                <button type="button" onClick={() => onViewProfile(comment.authorId)}>
                  {who?.handle ?? t("common.collector")}
                </button>{" "}
                {comment.body}
              </p>
            );
          })}
          <form className="s-post-comment-form" onSubmit={sendComment}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t("post.addComment")}
              aria-label={t("post.comment")}
            />
            <button type="submit" disabled={!draft.trim()}>
              {t("post.post")}
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function isPlayableVideo(media: NonNullable<Post["media"]>[number]): boolean {
  return media.kind === "video" && (
    media.url.startsWith("data:video/") || /\.(mp4|webm|ogg)(?:[?#].*)?$/i.test(media.url)
  );
}
