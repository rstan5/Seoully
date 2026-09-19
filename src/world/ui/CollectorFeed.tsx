"use client";

import { useMemo, useState } from "react";
import { sharedInterestCount } from "@/domain/compatibility";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { CollectionCompatibility, PostId, UserId } from "@/domain/types";
import { useT } from "@/locale/store";
import type { Translate } from "@/locale/translate";
import { PostCard } from "@/world/ui/PostCard";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { SocialShell } from "@/world/ui/SocialShell";

type FeedMode = "following" | "discover";

export function CollectorFeed({
  viewerId,
  onViewProfile,
  onShare,
}: {
  viewerId: UserId;
  onViewProfile: (userId: UserId) => void;
  onShare: (postId: PostId) => void;
}) {
  const revision = useRepoRevision();
  const [mode, setMode] = useState<FeedMode>(() =>
    repository.listFollowing(viewerId).length > 0 ? "following" : "discover",
  );
  const data = useMemo(() => {
    const followingIds = new Set(repository.listFollowing(viewerId));
    const posts = repository.listAllPosts().filter((post) => {
      if (post.authorId === viewerId) return false;
      const friend = followingIds.has(post.authorId);
      return mode === "following" ? friend : !friend;
    });
    const people = repository
      .listUsers()
      .filter((u) => u.id !== viewerId)
      .map((user) => ({
        user,
        profile: repository.getProfile(user.id),
        compat: repository.getCollectionCompatibility(viewerId, user.id),
        following: followingIds.has(user.id),
      }));
    return { posts, people };
  }, [viewerId, revision, mode]);
  const t = useT();

  return (
    <SocialShell tab="feed">
      {data.people.length > 0 && (
        <section className="s-suggested">
          {data.people.map(({ user, profile, compat, following }) => {
            if (!profile) return null;
            return (
              <button
                key={user.id}
                type="button"
                className="s-suggested-person"
                onClick={() => onViewProfile(user.id)}
              >
                <SocialAvatar user={user} profile={profile} size={56} />
                <span className="s-suggested-name">{user.handle}</span>
                <span className="s-suggested-meta">{t("feed.matchScore", { score: compat.score })}</span>
                <span className="s-suggested-sub">
                  {discoverMeta(compat, following, t)}
                </span>
              </button>
            );
          })}
        </section>
      )}

      <div className="s-feed-toggle" role="tablist" aria-label={t("feed.modeAria")}>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "following"}
          className={mode === "following" ? "is-on" : ""}
          onClick={() => setMode("following")}
        >
          {t("feed.modeFollowing")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "discover"}
          className={mode === "discover" ? "is-on" : ""}
          onClick={() => setMode("discover")}
        >
          {t("feed.modeDiscover")}
        </button>
      </div>

      <div className="s-feed">
        {data.posts.length === 0 && (
          <p className="s-profile-empty s-feed-empty">
            {mode === "following" ? t("feed.emptyFollowing") : t("feed.emptyDiscover")}
          </p>
        )}
        {data.posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            viewerId={viewerId}
            onViewProfile={onViewProfile}
            onShare={onShare}
          />
        ))}
      </div>
    </SocialShell>
  );
}

function discoverMeta(compat: CollectionCompatibility, following: boolean, t: Translate): string {
  const shared = sharedInterestCount(compat);
  const matches = compat.potentialTradeMatches.length;
  const parts: string[] = [];
  if (shared > 0) parts.push(t("feed.inCommon", { count: shared }));
  if (matches > 0) parts.push(t("feed.toTrade", { count: matches }));
  if (parts.length === 0 && following) return t("profile.following");
  if (following) parts.push(t("profile.following"));
  return parts.join(" · ");
}
