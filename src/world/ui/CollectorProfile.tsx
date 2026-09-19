"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { isOpenToTrade } from "@/domain/compatibility";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type {
  CollectionCompatibility,
  HoldingView,
  Post,
  PostId,
  TemplateId,
  UserId,
} from "@/domain/types";
import { collectorTypeLabel, compatibilityLines, kindLabel } from "@/locale/copy";
import { useLocale, useT } from "@/locale/store";
import { formatMonthYear, formatShortDate, type Translate } from "@/locale/translate";
import { CollectibleMatch, type MatchOpen } from "@/world/ui/CollectibleMatch";
import { EditProfile } from "@/world/ui/EditProfile";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { PostCard } from "@/world/ui/PostCard";
import { IconHeart } from "@/world/ui/SocialIcons";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { SocialShell } from "@/world/ui/SocialShell";
import { useSession } from "@/world/store/sessionStore";
import { clearProfilePreset, getProfilePreset, type ProfilePresetSection } from "@/world/store/profilePreset";

export function CollectorProfile({
  userId,
  viewerId,
  onEnterRoom,
  onViewProfile,
  onMessage,
  onShare,
}: {
  userId: UserId;
  viewerId: UserId;
  onEnterRoom: (userId: UserId) => void;
  onViewProfile: (userId: UserId) => void;
  onMessage: (userId: UserId, opts?: { trade?: boolean; templateIds?: TemplateId[] }) => void;
  onShare: (postId: PostId) => void;
}) {
  const revision = useRepoRevision();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [openMatch, setOpenMatch] = useState<MatchOpen | null>(null);
  const [wantQuery, setWantQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [ownedExpanded, setOwnedExpanded] = useState(false);
  const [wishlistExpanded, setWishlistExpanded] = useState(false);
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    const apply = (request: { userId: string; section: ProfilePresetSection }) => {
      if (request.userId !== userId) return;
      if (request.section === "wishlist") setWishlistExpanded(true);
      else setOwnedExpanded(true);
      clearProfilePreset();
      window.requestAnimationFrame(() => {
        document.getElementById(request.section === "wishlist" ? "s-profile-wishlist" : "s-profile-owned")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    };
    const pending = getProfilePreset();
    if (pending) apply(pending);
    const onRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ userId: string; section: ProfilePresetSection }>).detail;
      if (detail) apply(detail);
    };
    window.addEventListener("seoully:assistant-profile", onRequest);
    return () => window.removeEventListener("seoully:assistant-profile", onRequest);
  }, [userId]);

  const data = useMemo(() => {
    const user = repository.getUser(userId);
    const profile = repository.getProfile(userId);
    if (!user || !profile) return null;
    const stats = repository.getStats(userId);
    const identity = repository.getCollectionIdentity(userId).slice(0, 4);
    const isSelf = userId === viewerId;
    const posts = repository.listPosts(userId);
    const compatibility = isSelf ? null : repository.getCollectionCompatibility(viewerId, userId);
    const matchIds = compatibility
      ? [...new Set([...compatibility.wishlistMatches, ...compatibility.reciprocalMatches])]
      : [];
    const matches = matchIds
      .map((id) => repository.getTemplate(id))
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
      .slice(0, 4);
    const owned = repository.listHoldingViews(userId);
    const stored = new Set(repository.listStoredHoldings(userId).map((view) => view.holding.id));
    const wants = repository
      .listWishlist(userId)
      .map((item) => ({ item, template: repository.getTemplate(item.templateId) }))
      .filter((row): row is typeof row & { template: NonNullable<typeof row.template> } => !!row.template);
    return {
      user,
      profile,
      stats,
      identity,
      posts,
      compatibility,
      matches,
      owned,
      stored,
      wants,
      isSelf,
      following: repository.isFollowing(viewerId, userId),
      followerCount: repository.listFollowers(userId).length,
      followingCount: repository.listFollowing(userId).length,
      groups: profile.favoriteGroupIds
        .map((id) => repository.getGroup(id))
        .filter((g): g is NonNullable<typeof g> => g !== undefined),
      biases: profile.biasMemberIds
        .map((id) => repository.getMember(id))
        .filter((m): m is NonNullable<typeof m> => m !== undefined),
      eras: profile.favoriteEraIds
        .map((id) => repository.getEra(id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined),
    };
  }, [userId, viewerId, revision]);

  if (!data) return null;
  const { user, profile, stats, isSelf, following } = data;

  if (editing && isSelf) {
    return (
      <SocialShell tab="compose">
        <EditProfile userId={userId} onClose={() => setEditing(false)} />
      </SocialShell>
    );
  }

  const toggleFollow = () => {
    if (following) repository.unfollow(viewerId, userId);
    else repository.follow(viewerId, userId);
  };

  if (openMatch && !isSelf) {
    return (
      <SocialShell>
        <CollectibleMatch
          viewerId={viewerId}
          otherId={userId}
          open={openMatch}
          onClose={() => setOpenMatch(null)}
          onMessage={(opts) => onMessage(userId, opts)}
        />
      </SocialShell>
    );
  }

  return (
    <SocialShell tab={isSelf ? "profile" : undefined} themeUserId={userId}>
      <div className="s-profile">
        <div className="s-profile-card">
          <header className="s-profile-head">
            <SocialAvatar user={user} profile={profile} size={86} />
            <div className="s-profile-copy">
              <h1>{user.displayName}</h1>
              <p className="s-profile-handle">@{user.handle}</p>
              <div className="s-profile-counts">
                <span>
                  <strong>{data.posts.length}</strong> {t("profile.posts")}
                </span>
                <span>
                  <strong>{data.followerCount}</strong> {t("profile.followers")}
                </span>
                <span>
                  <strong>{data.followingCount}</strong> {t("profile.followingCount")}
                </span>
                <span>
                  <strong>{stats.totalItems}</strong> {t("profile.collected")}
                </span>
                <span>
                  <strong>{data.wants.length}</strong> {t("profile.wishlist")}
                </span>
              </div>
            </div>
          </header>

          {profile.bio ? <p className="s-profile-bio">{profile.bio}</p> : null}
          {profile.location && <p className="s-profile-meta">{profile.location}</p>}
          {user.joinedAt && (
            <p className="s-profile-meta">{t("profile.collectingSince", { date: formatMonthYear(user.joinedAt, locale) })}</p>
          )}
          {profile.collectorType ? (
            <p className="s-profile-archetype">
              <span className="s-chip s-chip-type">{collectorTypeLabel(profile.collectorType, t)}</span>
            </p>
          ) : null}

          {isSelf && (
            <div className="s-profile-actions">
              <button type="button" className="s-btn" onClick={() => setEditing(true)}>
                {t("profile.edit")}
              </button>
              <button type="button" className="s-btn is-ghost" onClick={() => useSession.getState().openCollect()}>
                {t("profile.addToCollection")}
              </button>
            </div>
          )}

          {!isSelf && (
            <div className="s-profile-actions">
              <button
                type="button"
                className={`s-btn${following ? " is-ghost" : ""}`}
                onClick={toggleFollow}
              >
                {following ? t("profile.following") : t("profile.follow")}
              </button>
              <button type="button" className="s-btn is-ghost" onClick={() => onMessage(userId)}>
                {t("profile.message")}
              </button>
            </div>
          )}

          <button type="button" className="s-enter" onClick={() => onEnterRoom(userId)}>
            {t("profile.enterRoom")}
          </button>
        </div>

        {(data.groups.length > 0 || data.biases.length > 0 || data.eras.length > 0) && (
          <div className="s-chips">
            {data.groups.map((group) => (
              <span key={group.id} className="s-chip s-chip-group">
                {group.name}
              </span>
            ))}
            {data.biases.map((member) => (
              <span key={member.id} className="s-chip s-chip-bias">
                {member.stageName}
              </span>
            ))}
            {data.eras.map((era) => (
              <span key={era.id} className="s-chip s-chip-era">
                {era.name}
              </span>
            ))}
          </div>
        )}

        <section className="s-highlights">
          {data.identity.map((slice) => {
            const sample = slice.sampleIds
              .map((id) => repository.getTemplate(id))
              .filter((t): t is NonNullable<typeof t> => t !== undefined)[0];
            const member = sample?.memberId ? repository.getMember(sample.memberId) : undefined;
            return (
              <div key={slice.groupId} className="s-highlight">
                {sample && (
                  <ObjectTile
                    template={sample}
                    {...(member ? { member } : {})}
                    height={52}
                  />
                )}
                <span>
                  {slice.name}
                  <em>{t("profile.ownedCount", { count: slice.count })}</em>
                </span>
              </div>
            );
          })}
        </section>

        {data.compatibility && (
          <section className="s-compat">
            <p className="s-compat-score">
              <strong>{data.compatibility.score}%</strong>
              <span>{t("compat.title")}</span>
            </p>
            {compatibilityLines(data.compatibility, {
              group: (id) => repository.getGroup(id)?.name,
              member: (id) => repository.getMember(id)?.stageName,
              era: (id) => repository.getEra(id)?.name,
            }, t).length > 0 && (
              <ul className="s-compat-reasons">
                {compatibilityLines(data.compatibility, {
                  group: (id) => repository.getGroup(id)?.name,
                  member: (id) => repository.getMember(id)?.stageName,
                  era: (id) => repository.getEra(id)?.name,
                }, t).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
            {data.compatibility.potentialTradeMatches.length > 0 && (
              <div className="s-compat-trade">
                <p className="s-compat-trade-label">{t("compat.tradeMatch")}</p>
                <div className="s-compat-pair">
                  <MatchColumn
                    label={t("compat.youWant")}
                    ids={data.compatibility.wishlistMatches}
                    otherId={userId}
                    compatibility={data.compatibility}
                    onOpen={(templateId) => setOpenMatch({ kind: "item", templateId })}
                  />
                  <MatchColumn
                    label={t("compat.theyWant")}
                    ids={data.compatibility.reciprocalMatches}
                    otherId={userId}
                    compatibility={data.compatibility}
                    onOpen={(templateId) => setOpenMatch({ kind: "item", templateId })}
                  />
                </div>
                <button
                  type="button"
                  className="s-btn"
                  onClick={() =>
                    onMessage(userId, {
                      trade: true,
                      templateIds: [
                        ...data.compatibility!.wishlistMatches,
                        ...data.compatibility!.reciprocalMatches,
                      ],
                    })
                  }
                >
                  {t("compat.messageTrade")}
                </button>
              </div>
            )}
            {data.compatibility.potentialTradeMatches.length === 0 && data.matches.length > 0 && (
              <div className="s-compat-matches">
                {data.matches.map((template) => {
                  const member = template.memberId ? repository.getMember(template.memberId) : undefined;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      className="s-compat-match"
                      onClick={() => setOpenMatch({ kind: "item", templateId: template.id })}
                    >
                      <ObjectTile
                        template={template}
                        {...(member ? { member } : {})}
                        height={56}
                      />
                      <span>
                        <strong>{template.name}</strong>
                        <em>{matchCaption(template.id, data.compatibility!, userId, t)}</em>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {openPost ? (
          <div className="s-profile-post">
            <button type="button" className="s-back-posts" onClick={() => setOpenPost(null)}>
              {t("profile.postsTitle")}
            </button>
            <PostCard
              post={openPost}
              viewerId={viewerId}
              onViewProfile={onViewProfile}
              onShare={onShare}
            />
          </div>
        ) : (
          <CollectionShelf
            title={t("profile.postsTitle")}
            empty={isSelf ? t("profile.emptyPostsSelf") : t("profile.emptyPosts")}
            showEmpty={data.posts.length === 0}
          >
            {data.posts.length > 0 ? (
              <div className="s-grid">
                {data.posts.map((post) => {
                  const likes = repository.likeCount(post.id);
                  return (
                    <div key={post.id} className="s-grid-item">
                      <button
                        type="button"
                        className="s-grid-cell"
                        onClick={() => setOpenPost(post)}
                      >
                        <GridThumb post={post} />
                      </button>
                      <p className="s-grid-meta">
                        <time>{formatShortDate(post.createdAt, locale)}</time>
                        <span className="s-grid-likes" aria-label={t("profile.likes", { count: likes })}>
                          <IconHeart />
                          {likes}
                        </span>
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CollectionShelf>
        )}

        <CollectionShelf
          id="s-profile-owned"
          title={t("profile.owned")}
          empty={isSelf ? t("profile.emptyOwnedSelf") : t("profile.emptyOwned")}
          showEmpty={data.owned.length === 0}
          itemCount={data.owned.length}
          expanded={ownedExpanded}
          onToggle={() => setOwnedExpanded((expanded) => !expanded)}
        >
          <div className="s-shelf-list">
            {data.owned.map((view) => (
              <OwnedRow
                key={view.holding.id}
                view={view}
                stored={data.stored.has(view.holding.id)}
                isSelf={isSelf}
              />
            ))}
          </div>
        </CollectionShelf>

        <CollectionShelf
          id="s-profile-wishlist"
          title={t("profile.wishlistTitle")}
          className="is-wish"
          empty={isSelf ? t("profile.emptyWishSelf") : t("profile.emptyWish")}
          showEmpty={data.wants.length === 0 && wantQuery.trim().length === 0}
          itemCount={data.wants.length}
          expanded={wishlistExpanded}
          onToggle={() => setWishlistExpanded((expanded) => !expanded)}
        >
          {isSelf && (
            <WishlistSearch
              query={wantQuery}
              onQuery={setWantQuery}
              viewerId={viewerId}
            />
          )}
          <div className="s-shelf-list">
            {data.wants.map(({ item, template }) => {
              const member = template.memberId ? repository.getMember(template.memberId) : undefined;
              const group = repository.getGroup(template.groupId);
              return (
                <div key={`${item.userId}-${item.templateId}`} className="s-shelf-row">
                  <ObjectTile template={template} {...(member ? { member } : {})} height={52} />
                  <div className="s-shelf-copy">
                    <strong>{template.name}</strong>
                    <em>{[group?.name, member?.stageName, kindLabel(template.kind, t)].filter(Boolean).join(" · ")}</em>
                  </div>
                  {isSelf && (
                    <button
                      type="button"
                      className="s-shelf-action"
                      onClick={() => repository.removeFromWishlist(userId, template.id)}
                    >
                      {t("common.remove")}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </CollectionShelf>

        {!isSelf && (
          <p className="s-profile-connect">{t("profile.connect", { name: user.displayName })}</p>
        )}
      </div>
    </SocialShell>
  );
}

function MatchColumn({
  label,
  ids,
  otherId,
  compatibility,
  onOpen,
}: {
  label: string;
  ids: TemplateId[];
  otherId: UserId;
  compatibility: CollectionCompatibility;
  onOpen: (templateId: TemplateId) => void;
}) {
  const t = useT();
  if (ids.length === 0) return null;
  return (
    <div className="s-compat-column">
      <h3>{label}</h3>
      {ids.map((templateId) => {
        const template = repository.getTemplate(templateId);
        if (!template) return null;
        const member = template.memberId ? repository.getMember(template.memberId) : undefined;
        return (
          <button
            key={template.id}
            type="button"
            className="s-compat-match"
            onClick={() => onOpen(template.id)}
          >
            <ObjectTile template={template} {...(member ? { member } : {})} height={52} />
            <span>
              <strong>{template.name}</strong>
              <em>{matchCaption(template.id, compatibility, otherId, t)}</em>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function matchCaption(
  templateId: TemplateId,
  compatibility: CollectionCompatibility,
  otherId: UserId,
  t: Translate,
): string {
  const theyHave = compatibility.wishlistMatches.includes(templateId);
  const youHave = compatibility.reciprocalMatches.includes(templateId);
  const copy = theyHave && youHave
    ? t("compat.bothWant")
    : theyHave
      ? t("compat.onYourWishlist")
      : t("compat.theyWantThis");
  if (!theyHave) return copy;
  const marked = repository
    .listHoldings(otherId)
    .some((holding) => holding.templateId === templateId && isOpenToTrade(holding.tradeStatus));
  return marked ? `${copy} · ${t("compat.openToTrade")}` : copy;
}

function CollectionShelf({
  id,
  title,
  empty,
  showEmpty,
  className,
  itemCount,
  expanded,
  onToggle,
  children,
}: {
  id?: string;
  title: string;
  empty: string;
  showEmpty: boolean;
  className?: string;
  itemCount?: number;
  expanded?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  const t = useT();
  const collapsible = itemCount !== undefined && expanded !== undefined && onToggle !== undefined;
  return (
    <section id={id} className={`s-shelf${className ? ` ${className}` : ""}`}>
      {collapsible ? (
        <h2>
          <button
            type="button"
            className="s-shelf-toggle"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <span>{title}</span>
            <span className="s-shelf-count">{itemCount}</span>
            <span className="s-shelf-chevron" aria-hidden="true" />
            <span className="sr-only">{expanded ? ` ${t("common.collapse")}` : ` ${t("common.expand")}`}</span>
          </button>
        </h2>
      ) : (
        <h2>{title}</h2>
      )}
      {(!collapsible || expanded) && (
        <div className="s-shelf-content">
          {children}
          {showEmpty && <p className="s-profile-empty">{empty}</p>}
        </div>
      )}
    </section>
  );
}

function OwnedRow({
  view,
  stored,
  isSelf,
}: {
  view: HoldingView;
  stored: boolean;
  isSelf: boolean;
}) {
  const open = isOpenToTrade(view.holding.tradeStatus);
  const t = useT();
  return (
    <div className="s-shelf-row">
      <ObjectTile
        template={view.template}
        {...(view.member ? { member: view.member } : {})}
        height={52}
      />
      <div className="s-shelf-copy">
        <strong>{view.template.name}</strong>
        <em>
          {[view.group.name, view.member?.stageName, kindLabel(view.template.kind, t)].filter(Boolean).join(" · ")}
          {stored ? ` · ${t("common.stored")}` : ""}
          {!isSelf && open ? ` · ${t("compat.openToTrade")}` : ""}
        </em>
      </div>
      {isSelf && (
        <div className="s-shelf-actions">
          <button
            type="button"
            className={`s-shelf-action${open ? " is-on" : ""}`}
            onClick={() =>
              repository.setHoldingTradeStatus(view.holding.id, open ? "not-for-trade" : "for-trade")
            }
          >
            {open ? t("profile.openToTrade") : t("profile.notForTrade")}
          </button>
          <button
            type="button"
            className="s-shelf-action"
            onClick={() => repository.removeHolding(view.holding.id)}
          >
            {t("common.remove")}
          </button>
        </div>
      )}
    </div>
  );
}

function WishlistSearch({
  query,
  onQuery,
  viewerId,
}: {
  query: string;
  onQuery: (value: string) => void;
  viewerId: UserId;
}) {
  const hits = query.trim() ? repository.searchCatalog(query).slice(0, 6) : [];
  const t = useT();
  return (
    <div className="s-shelf-search">
      <label htmlFor="shelf-want">{t("profile.addToWishlist")}</label>
      <input
        id="shelf-want"
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={t("profile.wishlistPlaceholder")}
      />
      {hits.length > 0 && (
        <ul>
          {hits.map((template) => {
            const group = repository.getGroup(template.groupId);
            const member = template.memberId ? repository.getMember(template.memberId) : undefined;
            const wanted = repository.isWanted(viewerId, template.id);
            return (
              <li key={template.id}>
                <button
                  type="button"
                  disabled={wanted}
                  onClick={() => {
                    repository.addToWishlist(viewerId, template.id);
                    onQuery("");
                  }}
                >
                  <strong>{template.name}</strong>
                  <em>{[group?.name, member?.stageName, wanted ? t("common.saved") : kindLabel(template.kind, t)].filter(Boolean).join(" · ")}</em>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function GridThumb({ post }: { post: Post }) {
  const t = useT();
  const media = post.media?.[0];
  const mark = post.repostOf ? <span className="s-grid-repost">{t("post.reposted")}</span> : null;
  if (media) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={media.poster ?? media.url} alt="" />
        {media.kind === "video" && <span className="s-grid-video">▶</span>}
        {mark}
      </>
    );
  }
  const template = post.templateIds[0] ? repository.getTemplate(post.templateIds[0]) : undefined;
  if (template) {
    const member = template.memberId ? repository.getMember(template.memberId) : undefined;
    return (
      <>
        <span className="s-grid-object">
          <ObjectTile template={template} {...(member ? { member } : {})} height={110} />
        </span>
        {mark}
      </>
    );
  }
  return (
    <>
      <span className="s-grid-text">{post.body}</span>
      {mark}
    </>
  );
}
