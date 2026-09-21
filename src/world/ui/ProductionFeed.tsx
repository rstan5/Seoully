"use client";

import { useEffect, useState } from "react";
import type { UserId } from "@/domain/types";
import { productionFeed } from "@/server/social/actions";
import type { SocialPostDTO } from "@/server/dal/social";
import { useT } from "@/locale/store";
import { SocialShell } from "@/world/ui/SocialShell";
import { ProductionPostCard } from "@/world/ui/ProductionPostCard";

export function ProductionFeed({ viewerId, onViewProfile }: { viewerId: UserId; onViewProfile: (userId: UserId) => void }) {
  const [posts, setPosts] = useState<SocialPostDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const t = useT();
  useEffect(() => { let cancelled = false; void productionFeed({ limit: 20 }).then((result) => { if (!cancelled && result.ok) setPosts(result.page.items); if (!cancelled) setLoaded(true); }); return () => { cancelled = true; }; }, []);
  return <SocialShell tab="feed"><div className="s-feed">{loaded && posts.length === 0 ? <p className="s-profile-empty s-feed-empty">{t("feed.emptyFollowing")}</p> : posts.map((post) => <ProductionPostCard key={post.id} post={post} viewerId={viewerId} onViewProfile={onViewProfile} />)}</div></SocialShell>;
}
