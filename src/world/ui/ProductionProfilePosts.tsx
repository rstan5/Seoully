"use client";

import { useEffect, useState } from "react";
import type { UserId } from "@/domain/types";
import { productionProfilePosts } from "@/server/social/actions";
import type { SocialPostDTO } from "@/server/dal/social";
import { ProductionPostCard } from "@/world/ui/ProductionPostCard";

export function ProductionProfilePosts({ userId, viewerId, onViewProfile }: { userId: UserId; viewerId: UserId; onViewProfile: (userId: UserId) => void }) {
  const [posts, setPosts] = useState<SocialPostDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { let cancelled = false; void productionProfilePosts(userId, { limit: 20 }).then((result) => { if (!cancelled && result.ok) setPosts(result.page.items); if (!cancelled) setLoaded(true); }).catch(() => { if (!cancelled) setLoaded(true); }); return () => { cancelled = true; }; }, [userId]);
  return <div>{!loaded ? <p className="s-profile-empty">Loading posts…</p> : posts.length === 0 ? <p className="s-profile-empty">No posts yet.</p> : posts.map((post) => <ProductionPostCard key={post.id} post={post} viewerId={viewerId} onViewProfile={onViewProfile} />)}</div>;
}
