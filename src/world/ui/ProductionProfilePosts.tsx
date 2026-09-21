"use client";

import { useEffect, useState } from "react";
import type { UserId } from "@/domain/types";
import { productionProfilePosts } from "@/server/social/actions";
import type { SocialPostDTO } from "@/server/dal/social";
import { ProductionPostCard } from "@/world/ui/ProductionPostCard";

export function ProductionProfilePosts({ userId, viewerId, onViewProfile }: { userId: UserId; viewerId: UserId; onViewProfile: (userId: UserId) => void }) {
  const [posts, setPosts] = useState<SocialPostDTO[]>([]);
  useEffect(() => { let cancelled = false; void productionProfilePosts(userId, { limit: 20 }).then((result) => { if (!cancelled && result.ok) setPosts(result.page.items); }); return () => { cancelled = true; }; }, [userId]);
  return <div>{posts.map((post) => <ProductionPostCard key={post.id} post={post} viewerId={viewerId} onViewProfile={onViewProfile} />)}</div>;
}
