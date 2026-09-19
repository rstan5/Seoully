"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { repository } from "@/domain/memory-repository";
import { relationCopy } from "@/locale/copy";
import { useLocale, useT } from "@/locale/store";
import { formatMessageWhen } from "@/locale/translate";
import { LanguageToggle } from "@/world/ui/LanguageToggle";
import { useRepoRevision } from "@/domain/use-repository";
import type { CollectibleTemplate, Member, PostId, TemplateId, UserId } from "@/domain/types";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { SocialAvatar } from "@/world/ui/SocialAvatar";

export function CollectorThread({
  peerId,
  viewerId,
  highlightTrade = false,
  aboutTemplateIds = [],
  aboutPostId,
  onClose,
}: {
  peerId: UserId;
  viewerId: UserId;
  highlightTrade?: boolean;
  aboutTemplateIds?: TemplateId[];
  aboutPostId?: PostId;
  onClose: () => void;
}) {
  const revision = useRepoRevision();
  const [draft, setDraft] = useState("");
  const [sentPost, setSentPost] = useState(false);
  const t = useT();
  const locale = useLocale();

  const data = useMemo(() => {
    const peer = repository.getUser(peerId);
    const profile = repository.getProfile(peerId);
    const viewer = repository.getUser(viewerId);
    if (!peer || !profile || !viewer) return null;
    const thread = repository.getThread(viewerId, peerId);
    const messages = thread ? repository.listMessages(thread.id) : [];
    const compatibility = repository.getCompatibility(viewerId, peerId);
    const attachedIds = uniqueIds([
      ...aboutTemplateIds,
      ...(thread?.pendingTemplateIds ?? []),
    ]);
    const about = attachedIds.map(resolveObject).filter(isObject);
    const theyOwnYourWant = about.some((item) =>
      compatibility.wishlistMatches.includes(item.template.id),
    );
    const youOwnTheirWant = about.some((item) =>
      compatibility.reciprocalMatches.includes(item.template.id),
    );
    return {
      peer,
      profile,
      thread,
      messages,
      about,
      attachedIds,
      theyOwnYourWant,
      youOwnTheirWant,
    };
  }, [peerId, viewerId, revision, aboutTemplateIds, highlightTrade]);

  useEffect(() => {
    if (data?.thread) repository.markThreadRead(data.thread.id);
  }, [data?.thread]);

  useEffect(() => {
    setSentPost(false);
  }, [aboutPostId, peerId]);

  if (!data) return null;
  const { peer, profile, messages, about, attachedIds, theyOwnYourWant, youOwnTheirWant } = data;
  const context = highlightTrade || (theyOwnYourWant && youOwnTheirWant)
    ? t("compat.tradeMatchDot")
    : relationCopy(theyOwnYourWant, youOwnTheirWant, t);
  const aboutPost = !sentPost && aboutPostId ? repository.getPost(aboutPostId) : undefined;

  const send = (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body && !aboutPost && attachedIds.length === 0) return;
    repository.sendMessage({
      senderId: viewerId,
      recipientId: peerId,
      body,
      ...(attachedIds.length > 0 ? { templateIds: attachedIds } : {}),
      ...(aboutPost ? { postId: aboutPost.id } : {}),
    });
    setDraft("");
    if (aboutPost) setSentPost(true);
  };

  return (
    <div className="s-thread">
      <header className="s-thread-head">
        <button type="button" onClick={onClose}>
          {t("thread.back")}
        </button>
        <SocialAvatar user={peer} profile={profile} size={36} />
        <div>
          <strong>{peer.displayName}</strong>
          <span>@{peer.handle}</span>
        </div>
        <LanguageToggle />
      </header>

      {about.length > 0 && context && (
        <section className="s-thread-about">
          <p>{context}</p>
        </section>
      )}

      <ol className="s-thread-log">
        {messages.map((message) => {
          const mine = message.senderId === viewerId;
          const objects = (message.templateIds ?? []).map(resolveObject).filter(isObject);
          return (
            <li key={message.id} className={mine ? "is-mine" : "is-theirs"}>
              <div className="s-thread-bubble">
                {message.body ? <p>{message.body}</p> : null}
                {message.postId && <SharedPostPeek postId={message.postId} />}
                {objects.length > 0 && (
                  <div className="s-thread-objects">
                    {objects.map((item) => (
                      <div key={item.template.id} className="s-thread-chip">
                        <ObjectTile
                          template={item.template}
                          {...(item.member ? { member: item.member } : {})}
                          height={52}
                        />
                        <em>{item.template.name}</em>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <time dateTime={message.createdAt}>{formatMessageWhen(message.createdAt, locale)}</time>
            </li>
          );
        })}
      </ol>

      <form className="s-thread-compose" onSubmit={send}>
        {aboutPost && (
          <div className="s-thread-attach" aria-label={t("thread.sharedPost")}>
            <SharedPostPeek postId={aboutPost.id} />
          </div>
        )}
        {about.length > 0 && (
          <div className="s-thread-attach" aria-label={t("thread.attached")}>
            {about.map((item) => (
              <div key={item.template.id} className="s-thread-chip">
                <ObjectTile
                  template={item.template}
                  {...(item.member ? { member: item.member } : {})}
                  height={40}
                />
                <span>{item.template.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="s-thread-compose-row">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={
              aboutPost
                ? t("thread.addMessage")
                : about.length > 0
                  ? t("thread.placeholderAbout", { name: peer.displayName })
                  : t("thread.placeholder")
            }
            aria-label={t("thread.messageAria")}
          />
          <button type="submit" disabled={!draft.trim() && !aboutPost && attachedIds.length === 0}>
            {t("thread.send")}
          </button>
        </div>
      </form>
    </div>
  );
}

function uniqueIds(ids: TemplateId[]): TemplateId[] {
  return [...new Set(ids)];
}

function resolveObject(templateId: TemplateId): {
  template: CollectibleTemplate;
  member?: Member;
} | null {
  const template = repository.getTemplate(templateId);
  if (!template) return null;
  const member = template.memberId ? repository.getMember(template.memberId) : undefined;
  return { template, ...(member ? { member } : {}) };
}

function isObject(
  value: { template: CollectibleTemplate; member?: Member } | null,
): value is { template: CollectibleTemplate; member?: Member } {
  return value !== null;
}

function SharedPostPeek({ postId }: { postId: PostId }) {
  const t = useT();
  const post = repository.getPost(postId);
  if (!post) return null;
  const origin = post.repostOf ? repository.getPost(post.repostOf) ?? post : post;
  const author = repository.getUser(origin.authorId);
  const media = origin.media?.[0];
  return (
    <div className="s-thread-post">
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
