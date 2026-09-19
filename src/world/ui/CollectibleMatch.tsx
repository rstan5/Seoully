"use client";

import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { TemplateId, UserId } from "@/domain/types";
import { relationCopy } from "@/locale/copy";
import { useT } from "@/locale/store";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { SocialAvatar } from "@/world/ui/SocialAvatar";

export type MatchOpen = { kind: "item"; templateId: TemplateId };

export function CollectibleMatch({
  viewerId,
  otherId,
  open,
  onClose,
  onMessage,
}: {
  viewerId: UserId;
  otherId: UserId;
  open: MatchOpen;
  onClose: () => void;
  onMessage: (opts?: { trade?: boolean; templateIds?: TemplateId[] }) => void;
}) {
  useRepoRevision();
  const t = useT();
  const other = repository.getUser(otherId);
  const profile = repository.getProfile(otherId);
  if (!other || !profile) return null;

  const template = repository.getTemplate(open.templateId);
  if (!template) return null;
  const member = template.memberId ? repository.getMember(template.memberId) : undefined;
  const group = repository.getGroup(template.groupId);
  const era = template.eraId ? repository.getEra(template.eraId) : undefined;
  const relation = repository.getMatchRelation(viewerId, otherId, template.id);
  if (!relation.theyOwnYourWant && !relation.youOwnTheirWant) return null;

  return (
    <div className="s-match">
      <button type="button" className="s-back-posts" onClick={onClose}>
        {t("match.back")}
      </button>
      <div className="s-match-hero">
        <ObjectTile template={template} {...(member ? { member } : {})} height={120} />
        <div>
          <h2>{template.name}</h2>
          <p>{[group?.name, member?.stageName, era?.name].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      {relationCopy(relation.theyOwnYourWant, relation.youOwnTheirWant, t) && (
        <p className="s-match-line">{relationCopy(relation.theyOwnYourWant, relation.youOwnTheirWant, t)}</p>
      )}
      {relation.potentialTrade && !(relation.theyOwnYourWant && relation.youOwnTheirWant) && (
        <p className="s-match-line">{t("compat.tradeMatchDot")}</p>
      )}

      <dl className="s-match-facts">
        <div>
          <dt>{t("match.ownership")}</dt>
          <dd>
            {relation.theyOwn ? t("match.theyOwn", { name: other.displayName }) : null}
            {relation.theyOwn && relation.youOwn ? " · " : null}
            {relation.youOwn ? t("match.youOwn") : null}
          </dd>
        </div>
        <div>
          <dt>{t("match.wishlist")}</dt>
          <dd>
            {relation.youWant ? t("compat.onYourWishlist") : null}
            {relation.youWant && relation.theyWant ? " · " : null}
            {relation.theyWant ? t("match.onTheirsWishlist", { name: other.displayName }) : null}
          </dd>
        </div>
        {relation.theirCopyOpenToTrade && (
          <div>
            <dt>{t("match.trade")}</dt>
            <dd>{t("compat.openToTrade")}</dd>
          </div>
        )}
      </dl>

      <div className="s-match-who">
        <SocialAvatar user={other} profile={profile} size={44} />
        <span>
          <strong>{other.displayName}</strong>
          <em>
            {relation.theyOwn ? t("match.ownsCollectible") : t("match.wantsCollectible")}
            {relation.theirCopyOpenToTrade ? ` · ${t("compat.openToTrade")}` : ""}
          </em>
        </span>
      </div>

      <button
        type="button"
        className="s-btn"
        onClick={() => onMessage({ templateIds: [template.id] })}
      >
        {t("profile.message")}
      </button>
    </div>
  );
}

