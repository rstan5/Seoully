"use client";

import { AnimatePresence, motion } from "motion/react";
import { repository } from "@/domain/memory-repository";
import type { HoldingView, TemplateId, UserId } from "@/domain/types";
import { conditionLabel, kindLabel, rarityLabel, tradeLabel } from "@/locale/copy";
import { useLocale, useT } from "@/locale/store";
import { formatMonthYear, type Translate } from "@/locale/translate";
import { ease } from "@/design/motion";
import { useWorld } from "@/world/store/worldStore";

/**
 * Annotation that appears once an object has physically become the focus.
 *
 * Not a modal and not a caption bar. The object itself is the interface; this
 * is the collector's note written beside it — restrained, editorial, and
 * always secondary to the thing being held.
 */
export function InspectPlate({
  view,
  onMessage,
}: {
  view: HoldingView | null;
  onMessage?: (peerId: UserId, opts?: { templateIds?: TemplateId[] }) => void;
}) {
  const viewerId = useWorld((s) => s.viewerId);
  const t = useT();
  const locale = useLocale();
  const postedLine = view ? postedAbout(view, t) : null;
  const match =
    view && view.holding.ownerId !== viewerId
      ? repository.getMatchRelation(viewerId, view.holding.ownerId, view.template.id)
      : null;
  return (
    <AnimatePresence mode="wait">
      {view && (
        <motion.aside
          className="atmo inspect-plate"
          key={view.holding.id}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={ease.uiSlow}
        >
          <div className="u-eyebrow inspect-plate-kicker" style={{ color: accentOf(view) }}>
            {view.template.kind === "photocard" ? t("kind.photocard") : view.group.name}
            {view.era ? ` · ${view.era.name}` : ""}
          </div>
          <h2 className="inspect-plate-name">
            {view.member?.stageName ?? view.release?.title ?? view.template.name}
          </h2>
          {view.member && (
            <p className="inspect-plate-sub">
              {view.group.name}
              {view.release ? ` · ${view.release.title}` : ""}
            </p>
          )}
          {!view.member && view.release && (
            <p className="inspect-plate-sub">
              {view.group.name}
              {view.version ? ` · ${view.version.name}` : ""}
            </p>
          )}

          <dl className="inspect-plate-fields">
            {fieldsFor(view, t, locale).map((field) => (
              <div key={field.label} className="inspect-plate-field">
                <dt className="u-eyebrow">{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>

          {view.holding.acquisition.note && (
            <p className="inspect-plate-source">{view.holding.acquisition.note}</p>
          )}
          {postedLine && <p className="inspect-plate-source">{postedLine}</p>}
          {match?.theyOwnYourWant && (
            <div className="inspect-plate-match">
              <p>{t("inspect.onWishlist")}</p>
              {onMessage && (
                <button
                  type="button"
                  onClick={() =>
                    onMessage(view.holding.ownerId, { templateIds: [view.template.id] })
                  }
                >
                  {t("inspect.message")}
                </button>
              )}
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function accentOf(view: HoldingView): string {
  return view.member?.color ?? view.template.colorway.accent;
}

function postedAbout(view: HoldingView, t: Translate): string | null {
  const post = repository.listPostsAbout(view.holding.ownerId, view.template.id)[0];
  if (!post) return null;
  const owner = repository.getUser(view.holding.ownerId);
  const who = owner?.displayName ?? t("common.collector");
  return view.template.kind === "photocard"
    ? t("inspect.postedCard", { name: who })
    : t("inspect.postedObject", { name: who });
}

function fieldsFor(view: HoldingView, t: Translate, locale: "en" | "ko"): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  if (view.member) fields.push({ label: t("inspect.member"), value: view.member.stageName });
  fields.push({ label: t("inspect.group"), value: view.group.name });
  if (view.era) fields.push({ label: t("inspect.era"), value: view.era.name });
  if (view.release) fields.push({ label: t("inspect.release"), value: view.release.title });
  const version = objectVersion(view);
  if (version) fields.push({ label: t("inspect.version"), value: version });
  const type = objectType(view, t);
  if (type) fields.push({ label: t("inspect.type"), value: type });
  fields.push({
    label: t("inspect.rarity"),
    value: rarityLabel(view.template.rarity, t),
  });
  fields.push({
    label: t("inspect.condition"),
    value: conditionLabel(view.holding.condition, t),
  });
  fields.push({
    label: t("inspect.acquired"),
    value: formatMonthYear(view.holding.acquisition.acquiredAt, locale),
  });
  if (view.holding.acquisition.source) {
    fields.push({ label: t("inspect.from"), value: view.holding.acquisition.source });
  }
  fields.push({ label: t("inspect.trade"), value: tradeLabel(view.holding.tradeStatus, t) });
  if (view.holding.treasured) fields.push({ label: t("inspect.notes"), value: t("inspect.treasured") });
  return fields;
}

function objectType(view: HoldingView, t: Translate): string | null {
  const pose = poseOf(view);
  if (view.template.kind === "photocard") {
    if (/pob/i.test(pose) || /pob/i.test(view.template.name)) return t("inspect.typePob");
    if (view.template.rarity === "grail") return t("inspect.typeLucky");
    if (view.template.setIndex && view.template.setIndex % 4 === 0) return t("inspect.typePob");
    return t("inspect.typeInclusion");
  }
  return kindLabel(view.template.kind, t);
}

function objectVersion(view: HoldingView): string | null {
  if (view.version?.name) return view.version.name;
  const pose = poseOf(view);
  return pose || null;
}

function poseOf(view: HoldingView): string {
  const parts = view.template.name.split("—");
  return parts.length > 1 ? (parts[1]?.trim() ?? "") : "";
}
