"use client";

import type { Profile, User } from "@/domain/types";

/**
 * A collector's portrait as a physical print, not a social-media avatar.
 *
 * Sized and mounted like a photo on an identity sheet: paper border, slight
 * crop, the person's color underneath. `avatarUrl` is already a URL so a
 * later upload pipeline can replace the fixture without touching this.
 */
export function Portrait({
  user,
  profile,
  size = 112,
}: {
  user: User;
  profile: Profile;
  size?: number;
}) {
  const src = profile.avatarUrl;

  return (
    <span
      className="portrait"
      style={{
        width: size,
        height: size * 1.22,
        ["--portrait-color" as string]: profile.avatarColor,
      }}
    >
      <span className="portrait-paper">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={user.displayName} width={size} height={size * 1.22} />
        ) : null}
      </span>
    </span>
  );
}
