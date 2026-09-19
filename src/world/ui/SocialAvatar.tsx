"use client";

import type { Profile, User } from "@/domain/types";

/**
 * Circular avatar for the social layer. Room portraits stay paper prints.
 */
export function SocialAvatar({
  user,
  profile,
  size = 36,
}: {
  user: User;
  profile: Profile;
  size?: number;
}) {
  const src = profile.avatarUrl;

  return (
    <span
      className="s-avatar"
      style={{
        width: size,
        height: size,
        background: profile.avatarColor,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={user.displayName} width={size} height={size} />
      ) : null}
    </span>
  );
}
