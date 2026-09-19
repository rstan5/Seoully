"use client";

import { useEffect, useMemo } from "react";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { TemplateId, UserId } from "@/domain/types";
import { noticeCopy } from "@/locale/copy";
import { useLocale, useT } from "@/locale/store";
import { formatShortDate } from "@/locale/translate";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { SocialShell } from "@/world/ui/SocialShell";

export function CollectorNotices({
  viewerId,
  onViewProfile,
  onOpenThread,
}: {
  viewerId: UserId;
  onViewProfile: (userId: UserId) => void;
  onOpenThread: (peerId: UserId, opts?: { trade?: boolean; templateIds?: TemplateId[] }) => void;
}) {
  const revision = useRepoRevision();
  const notices = useMemo(() => repository.listNotices(viewerId), [viewerId, revision]);
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    repository.markNoticesRead(viewerId);
  }, [viewerId]);

  return (
    <SocialShell tab="notices">
      <div className="s-notices">
        <h1>{t("notice.title")}</h1>
        {notices.length === 0 && (
          <p className="s-profile-empty">{t("notice.empty")}</p>
        )}
        <ul>
          {notices.map((notice) => {
            const actor = repository.getUser(notice.actorId);
            const profile = repository.getProfile(notice.actorId);
            if (!actor || !profile) return null;
            const objects = (notice.templateIds ?? [])
              .map((id) => repository.getTemplate(id))
              .filter((t): t is NonNullable<typeof t> => t !== undefined);
            return (
              <li key={notice.id} className="s-notice">
                <button type="button" className="s-notice-who" onClick={() => onViewProfile(actor.id)}>
                  <SocialAvatar user={actor} profile={profile} size={44} />
                  <span>
                    <strong>{actor.handle}</strong> {noticeCopy(notice, t)}
                    <em>{formatShortDate(notice.createdAt, locale)}</em>
                  </span>
                </button>
                {objects.length > 0 && (
                  <div className="s-notice-objects">
                    {objects.map((template) => {
                      const member = template.memberId
                        ? repository.getMember(template.memberId)
                        : undefined;
                      return (
                        <ObjectTile
                          key={template.id}
                          template={template}
                          {...(member ? { member } : {})}
                          height={44}
                        />
                      );
                    })}
                  </div>
                )}
                {notice.kind === "trade" && (
                  <button
                    type="button"
                    className="s-btn"
                    onClick={() =>
                      onOpenThread(actor.id, { trade: true, templateIds: notice.templateIds })
                    }
                  >
                    {t("notice.messageAbout")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </SocialShell>
  );
}
