"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProductionProfilePosts } from "@/world/ui/ProductionProfilePosts";

type Profile = {
  user: { id: string; handle: string; displayName: string; joinedAt: string };
  profile: { tagline: string; bio: string; location?: string };
  visibility: { collectionPublic: boolean; wishlistPublic: boolean };
  followerCount: number;
  followingCount: number;
  roomAvailable: boolean;
  collectionSummary?: { holdingCount: number; uniqueTemplateCount: number; groupCount: number };
};

export default function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const [handle, setHandle] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { void params.then(({ handle: value }) => {
    const normalized = value.replace(/^@/, "").toLowerCase();
    setHandle(normalized);
    void fetch(`/api/public/profiles/${encodeURIComponent(normalized)}`).then(async (response) => {
      if (!response.ok) { setError(true); return; }
      setProfile(await response.json() as Profile);
    }).catch(() => setError(true));
  }); }, [params]);
  if (error) return <main className="onboard"><div className="onboard-frame"><h1>Collector not found</h1><Link href="/">Back to Seoully</Link></div></main>;
  if (!profile) return <main className="onboard"><div className="onboard-frame"><p>Loading profile…</p></div></main>;
  return <main className="public-profile-page"><section className="profile-card">
    <p className="profile-kicker">@{profile.user.handle}</p>
    <h1>{profile.user.displayName}</h1>
    {profile.profile.tagline && <p>{profile.profile.tagline}</p>}
    {profile.profile.bio && <p>{profile.profile.bio}</p>}
    {profile.profile.location && <p>{profile.profile.location}</p>}
    <p>{profile.followerCount} followers · {profile.followingCount} following</p>
    <div className="profile-actions">
      {profile.roomAvailable && profile.visibility.collectionPublic && <Link className="button" href={`/@${handle}/room`}>Enter Room</Link>}
      <button type="button" className="button" onClick={() => void share(`/@${handle}`)}>Share profile</button>
    </div>
    {profile.visibility.collectionPublic ? <p>{profile.collectionSummary?.holdingCount ?? 0} holdings · {profile.collectionSummary?.uniqueTemplateCount ?? 0} unique collectibles · {profile.collectionSummary?.groupCount ?? 0} groups</p> : <p>This collector’s collection is private.</p>}
    <h2>Posts</h2>
    <ProductionProfilePosts userId={profile.user.id as never} viewerId={profile.user.id as never} onViewProfile={() => undefined} />
  </section></main>;
}

async function share(path: string) {
  const url = `${window.location.origin}${path}`;
  if (navigator.share) { await navigator.share({ title: "Seoully profile", url }).catch(() => undefined); return; }
  await navigator.clipboard?.writeText(url);
}
