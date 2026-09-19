"use client";

import type { ReactNode } from "react";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import { useWorld } from "@/world/store/worldStore";
import { useT } from "@/locale/store";
import { IconChat, IconHome, IconPlus, IconSearch, IconUser } from "@/world/ui/SocialIcons";

export type SocialTab = "feed" | "search" | "inbox" | "profile" | "compose";

/**
 * Instagram-style bottom navigation. Create is a plus, not a Reels tab.
 */
export function SocialNav({ current }: { current?: SocialTab }) {
  const viewerId = useWorld((s) => s.viewerId);
  const showFeed = useWorld((s) => s.showFeed);
  const showSearch = useWorld((s) => s.showSearch);
  const showCompose = useWorld((s) => s.showCompose);
  const showInbox = useWorld((s) => s.showInbox);
  const showProfile = useWorld((s) => s.showProfile);
  const revision = useRepoRevision();
  const unreadMessages = repository
    .listThreads(viewerId)
    .some((thread) => repository.isThreadUnread(thread.id, viewerId));
  const t = useT();
  void revision;

  return (
    <nav className="s-nav" aria-label={t("nav.social")}>
      <Tab label={t("nav.discover")} active={current === "feed"} onClick={showFeed}>
        <IconHome filled={current === "feed"} />
      </Tab>
      <Tab label={t("nav.search")} active={current === "search"} onClick={showSearch}>
        <IconSearch />
      </Tab>
      <Tab label={t("nav.create")} active={current === "compose"} onClick={showCompose} extra="s-nav-create">
        <IconPlus />
      </Tab>
      <Tab label={t("nav.messages")} active={current === "inbox"} onClick={showInbox} badge={unreadMessages}>
        <IconChat filled={current === "inbox"} />
      </Tab>
      <Tab label={t("nav.profile")} active={current === "profile"} onClick={() => showProfile(viewerId)}>
        <IconUser filled={current === "profile"} />
      </Tab>
    </nav>
  );
}

function Tab({
  label,
  active,
  onClick,
  badge = false,
  extra = "",
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
  extra?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`s-nav-tab${active ? " is-on" : ""}${extra ? ` ${extra}` : ""}`}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {children}
      {badge && <span className="s-nav-dot" />}
    </button>
  );
}
