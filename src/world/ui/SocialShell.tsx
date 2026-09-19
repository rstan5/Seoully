"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";
import {
  DEFAULT_PROFILE_THEME,
  profileThemeVars,
  resolveProfileTheme,
} from "@/domain/profile-theme";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { UserId } from "@/domain/types";
import { useWorld } from "@/world/store/worldStore";
import { useT } from "@/locale/store";
import { BrandMark } from "@/world/ui/BrandMark";
import { LanguageToggle } from "@/world/ui/LanguageToggle";
import { IconBell } from "@/world/ui/SocialIcons";
import { SocialNav } from "@/world/ui/SocialNav";

export type SocialTab = "feed" | "search" | "inbox" | "profile" | "notices" | "compose";

/**
 * Social chrome over the already-mounted room. Profiles retain a restrained
 * glimpse of their owner's world; general browsing uses an opaque Seoully
 * paper environment instead.
 */
export function SocialShell({
  children,
  tab,
  themeUserId,
}: {
  children: ReactNode;
  tab?: SocialTab;
  themeUserId?: UserId;
}) {
  const showNotices = useWorld((s) => s.showNotices);
  const viewerId = useWorld((s) => s.viewerId);
  const revision = useRepoRevision();
  const unread = repository.unreadNoticeCount(viewerId);
  const t = useT();
  const theme = useMemo(() => {
    if (!themeUserId) {
      return {
        vars: profileThemeVars(DEFAULT_PROFILE_THEME),
        scheme: DEFAULT_PROFILE_THEME.scheme,
      };
    }
    const profile = repository.getProfile(themeUserId);
    const room = repository.getRoomByOwner(themeUserId);
    const tokens = resolveProfileTheme(profile?.appearance, room);
    return { vars: profileThemeVars(tokens), scheme: tokens.scheme };
  }, [themeUserId, revision]);

  return (
    <div
      className="social-app"
      data-scheme={theme.scheme}
      data-surface={themeUserId ? "profile" : "browse"}
      style={theme.vars as CSSProperties}
    >
      <div className="social-background" aria-hidden="true" />
      <div className="s-frame">
        {tab !== "compose" && (
          <header className="s-top">
            <span className="s-logo">
              <BrandMark />
            </span>
            <div className="s-top-end">
              <LanguageToggle />
              <button type="button" className="s-bell" aria-label={t("nav.notifications")} onClick={showNotices}>
                <IconBell />
                {unread > 0 && <span className="s-badge">{unread}</span>}
              </button>
            </div>
          </header>
        )}
        <div className="s-body">{children}</div>
        {tab !== "compose" && <SocialNav current={tab === "notices" ? undefined : tab} />}
      </div>
    </div>
  );
}
