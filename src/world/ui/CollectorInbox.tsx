"use client";

import { useMemo, useState } from "react";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { PostId, UserId } from "@/domain/types";
import { useLocale, useT } from "@/locale/store";
import { formatShortDate } from "@/locale/translate";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { SocialShell } from "@/world/ui/SocialShell";

export function CollectorInbox({
  viewerId,
  sharePostId,
  onOpenThread,
}: {
  viewerId: UserId;
  sharePostId?: PostId;
  onOpenThread: (peerId: UserId) => void;
}) {
  const revision = useRepoRevision();
  const [query, setQuery] = useState("");
  const sharing = Boolean(sharePostId);
  const t = useT();
  const locale = useLocale();

  const threads = useMemo(() => {
    return repository.listThreads(viewerId).map((thread) => {
      const peerId = thread.participantIds.find((id) => id !== viewerId) ?? thread.participantIds[0]!;
      return {
        thread,
        peer: repository.getUser(peerId),
        profile: repository.getProfile(peerId),
        last: repository.listMessages(thread.id).at(-1),
        unread: repository.isThreadUnread(thread.id, viewerId),
      };
    });
  }, [viewerId, revision]);

  const people = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return repository
      .listUsers()
      .filter((user) => user.id !== viewerId)
      .filter((user) => {
        if (!needle) return sharing;
        return (
          user.handle.toLowerCase().includes(needle) ||
          user.displayName.toLowerCase().includes(needle)
        );
      })
      .map((user) => ({
        user,
        profile: repository.getProfile(user.id),
      }));
  }, [viewerId, query, sharing, revision]);

  const showThreads = !sharing && query.trim().length === 0;

  return (
    <SocialShell tab="inbox">
      <div className="s-inbox">
        <h1>{sharing ? t("inbox.sendTo") : t("inbox.messages")}</h1>
        {sharing && sharePostId ? <SharePreview postId={sharePostId} /> : null}
        <input
          className="s-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("inbox.searchPeople")}
          aria-label={t("inbox.searchPeopleAria")}
          autoFocus={sharing}
        />
        {sharing && people.length === 0 && (
          <p className="s-profile-empty">
            {query.trim() ? t("inbox.noMatch") : t("inbox.searchCollector")}
          </p>
        )}
        {!sharing && threads.length === 0 && people.length === 0 && (
          <p className="s-profile-empty">{t("inbox.empty")}</p>
        )}
        {people.length > 0 && (
          <ul>
            {people.map(({ user, profile }) => {
              if (!profile) return null;
              return (
                <li key={user.id}>
                  <button
                    type="button"
                    className="s-inbox-row"
                    onClick={() => onOpenThread(user.id)}
                  >
                    <SocialAvatar user={user} profile={profile} size={52} />
                    <span>
                      <strong>{user.displayName}</strong>
                      <em>@{user.handle}</em>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {showThreads && (
          <ul>
            {threads.map(({ thread, peer, profile, last, unread }) => {
              if (!peer || !profile) return null;
              return (
                <li key={thread.id}>
                  <button
                    type="button"
                    className={`s-inbox-row${unread ? " is-unread" : ""}`}
                    onClick={() => onOpenThread(peer.id)}
                  >
                    <SocialAvatar user={peer} profile={profile} size={52} />
                    <span>
                      <strong>{peer.displayName}</strong>
                      <em>{last?.body ?? t("inbox.newConversation")}</em>
                    </span>
                    {last && <time>{formatShortDate(last.createdAt, locale)}</time>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SocialShell>
  );
}

function SharePreview({ postId }: { postId: PostId }) {
  const t = useT();
  const post = repository.getPost(postId);
  if (!post) return null;
  const origin = post.repostOf ? repository.getPost(post.repostOf) ?? post : post;
  const author = repository.getUser(origin.authorId);
  const media = origin.media?.[0];
  return (
    <div className="s-inbox-share">
      {media ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.poster ?? media.url} alt="" />
      ) : (
        <span className="s-search-dot" />
      )}
      <span>
        <strong>{author?.handle ?? t("common.post")}</strong>
        <em>{origin.body}</em>
      </span>
    </div>
  );
}
