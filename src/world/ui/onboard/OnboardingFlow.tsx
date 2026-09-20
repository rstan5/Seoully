"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ease } from "@/design/motion";
import { homeForTemplate } from "@/domain/homes";
import { isFixtureUser } from "@/domain/session";
import { repository } from "@/domain/memory-repository";
import type { CatalogDraft } from "@/domain/catalog-match";
import type { CollectibleKind, CollectorInterest, GroupId, TemplateId } from "@/domain/types";
import { homeWhere, interestLabel, kindLabel, localizeError } from "@/locale/copy";
import { useT } from "@/locale/store";
import { useReducedMotion } from "@/world/stage/useViewport";
import { BrandMark } from "@/world/ui/BrandMark";
import { LanguageToggle } from "@/world/ui/LanguageToggle";
import { HeartScene } from "@/world/ui/onboard/HeartScene";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { useSession } from "@/world/store/sessionStore";

const INTERESTS: CollectorInterest[] = ["photocards", "albums", "merch", "everything"];

const SAMPLES: TemplateId[] = [
  "set-ate-pc-4" as TemplateId,
  "set-lovedive-pc-4" as TemplateId,
  "set-ate-pc-1" as TemplateId,
];

export function OnboardingFlow() {
  const step = useSession((s) => s.step);
  const error = useSession((s) => s.error);
  const looking = useSession((s) => s.looking);
  const session = useSession((s) => s.session);
  const showWelcome = useSession((s) => s.showWelcome);
  const canLeave = session.kind === "none" || step === "account" || step === "signin";
  const t = useT();

  return (
    <div className="onboard">
      <div className="onboard-frame">
        <div className="onboard-lang">
          <LanguageToggle />
        </div>
        {canLeave ? (
          <button type="button" className="onboard-logo" onClick={showWelcome}>
            <BrandMark />
          </button>
        ) : (
          <p className="onboard-logo">
            <BrandMark />
          </p>
        )}
        {error && <p className="onboard-error">{localizeError(error, t)}</p>}
        {looking && <p className="onboard-looking">{t("onboard.looking")}</p>}
        {step === "account" && <AccountForm />}
        {step === "signin" && <SignInForm />}
        {step === "photo" && <PhotoBeat />}
        {step === "group" && <GroupBeat />}
        {step === "bias" && <BiasBeat />}
        {step === "interest" && <InterestBeat />}
        {step === "collect" && <CollectForm />}
        {step === "describe" && <DescribeForm />}
        {step === "confirm" && <ConfirmForm />}
        {step === "reveal" && <RevealBeat />}
        {step === "meet" && <MeetCollectors />}
      </div>
      <HeartScene />
    </div>
  );
}

function AccountForm() {
  const createAccount = useSession((s) => s.createAccount);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const t = useT();

  return (
    <>
      <h1>{t("onboard.accountTitle")}</h1>
      <p className="onboard-lede">{t("onboard.accountLede")}</p>
      <div className="onboard-field">
        <label htmlFor="onboard-handle">{t("onboard.username")}</label>
        <input
          id="onboard-handle"
          autoComplete="username"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nara"
        />
      </div>
      <div className="onboard-field">
        <label htmlFor="onboard-email">{t("onboard.email")}</label>
        <input id="onboard-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="onboard-field">
        <label htmlFor="onboard-password">{t("onboard.password")}</label>
        <input id="onboard-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={() => void createAccount(name, name, email, password)}>
          {t("common.continue")}
        </button>
      </div>
    </>
  );
}

function SignInForm() {
  const signIn = useSession((s) => s.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const t = useT();

  return (
    <>
      <h1>{t("onboard.signinTitle")}</h1>
      <p className="onboard-lede">{t("onboard.signinLede")}</p>
      <div className="onboard-field">
        <label htmlFor="onboard-signin">{t("onboard.email")}</label>
        <input
          id="onboard-signin"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="onboard-field">
        <label htmlFor="onboard-signin-password">{t("onboard.password")}</label>
        <input id="onboard-signin-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={() => void signIn(email, password)}>
          {t("onboard.signin")}
        </button>
      </div>
    </>
  );
}

function PhotoBeat() {
  const savePhoto = useSession((s) => s.savePhoto);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const t = useT();

  return (
    <>
      <h1>{t("onboard.photoTitle")}</h1>
      <p className="onboard-lede">{t("onboard.photoLede")}</p>
      <label className="onboard-avatar">
        {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{t("onboard.addPhoto")}</span>}
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const { readLocalImage } = await import("@/domain/media");
            const read = await readLocalImage(file);
            if (read.ok) setAvatarUrl(read.media.url);
          }}
        />
      </label>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={() => savePhoto(avatarUrl)}>
          {avatarUrl ? t("common.continue") : t("common.skipForNow")}
        </button>
      </div>
    </>
  );
}

function GroupBeat() {
  const saveGroups = useSession((s) => s.saveGroups);
  const groups = repository.listGroups();
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const t = useT();

  return (
    <>
      <h1>{t("onboard.groupTitle")}</h1>
      <p className="onboard-lede">{t("onboard.groupLede")}</p>
      <div className="onboard-chips">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            className={`onboard-chip${groupIds.includes(group.id) ? " is-on" : ""}`}
            onClick={() =>
              setGroupIds((ids) => (ids.includes(group.id) ? ids.filter((id) => id !== group.id) : [...ids, group.id]))
            }
          >
            {group.name}
          </button>
        ))}
      </div>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={() => saveGroups(groupIds)}>
          {groupIds.length > 0 ? t("common.continue") : t("common.skipForNow")}
        </button>
      </div>
    </>
  );
}

function BiasBeat() {
  const session = useSession((s) => s.session);
  const saveBias = useSession((s) => s.saveBias);
  const profile = session.kind === "none" ? undefined : repository.getProfile(session.userId);
  const members = useMemo(
    () => (profile?.favoriteGroupIds ?? []).flatMap((id) => repository.listMembers(id)),
    [profile?.favoriteGroupIds],
  );
  const [biasIds, setBiasIds] = useState<string[]>([]);
  const t = useT();

  if (members.length === 0) {
    return <InterestBeat />;
  }

  return (
    <>
      <h1>{t("onboard.biasTitle")}</h1>
      <p className="onboard-lede">{t("onboard.biasLede")}</p>
      <div className="onboard-chips">
        {members.map((member) => (
          <button
            key={member.id}
            type="button"
            className={`onboard-chip${biasIds.includes(member.id) ? " is-on" : ""}`}
            onClick={() =>
              setBiasIds((ids) => (ids.includes(member.id) ? ids.filter((id) => id !== member.id) : [...ids, member.id]))
            }
          >
            {member.stageName}
          </button>
        ))}
      </div>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={() => saveBias(biasIds)}>
          {biasIds.length > 0 ? t("common.continue") : t("common.skipForNow")}
        </button>
      </div>
    </>
  );
}

function InterestBeat() {
  const saveInterests = useSession((s) => s.saveInterests);
  const [interests, setInterests] = useState<CollectorInterest[]>(["photocards"]);
  const t = useT();

  return (
    <>
      <h1>{t("onboard.interestTitle")}</h1>
      <p className="onboard-lede">{t("onboard.interestLede")}</p>
      <div className="onboard-chips">
        {INTERESTS.map((item) => (
          <button
            key={item}
            type="button"
            className={`onboard-chip${interests.includes(item) ? " is-on" : ""}`}
            onClick={() =>
              setInterests((list) =>
                list.includes(item) ? list.filter((id) => id !== item) : [...list, item],
              )
            }
          >
            {interestLabel(item, t)}
          </button>
        ))}
      </div>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={() => saveInterests(interests)}>
          {t("common.continue")}
        </button>
      </div>
    </>
  );
}

const COLLECTIBLE_KINDS: CollectibleKind[] = [
  "photocard",
  "album",
  "vinyl",
  "poster",
  "lightstick",
  "plushie",
  "figure",
  "book",
  "apparel",
  "memorabilia",
];

function CollectForm() {
  const session = useSession((s) => s.session);
  const identifyPhoto = useSession((s) => s.identifyPhoto);
  const identifySample = useSession((s) => s.identifySample);
  const searchPick = useSession((s) => s.searchPick);
  const searchPickProduction = useSession((s) => s.searchPickProduction);
  const startDescribe = useSession((s) => s.startDescribe);
  const closeCollect = useSession((s) => s.closeCollect);
  const looking = useSession((s) => s.looking);
  const [query, setQuery] = useState("");
  const [sharedHits, setSharedHits] = useState<SharedCatalogHit[]>([]);
  const hits = useMemo(() => (query.trim() ? repository.searchCatalog(query) : []), [query]);
  useEffect(() => {
    if (session.kind !== "auth" || !query.trim()) {
      setSharedHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/catalog/search?q=${encodeURIComponent(query.trim())}&limit=8`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<{ results?: SharedCatalogHit[] }> : { results: [] })
        .then((payload) => setSharedHits(payload.results ?? []))
        .catch(() => setSharedHits([]));
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, session.kind]);
  const first =
    (session.kind === "local" || session.kind === "auth") && !repository.onboardingState(session.userId).firstHoldingComplete;
  const t = useT();

  return (
    <>
      <h1>{first ? t("onboard.collectFirstTitle") : t("onboard.collectTitle")}</h1>
      <p className="onboard-lede">
        {first ? t("onboard.collectFirstLede") : t("onboard.collectLede")}
      </p>
      <div className="onboard-row">
        <label className="onboard-btn">
          {t("onboard.takePhoto")}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            disabled={looking}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void identifyPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
        <label className="onboard-btn is-ghost">
          {t("onboard.upload")}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={looking}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void identifyPhoto(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="onboard-kicker" style={{ marginTop: 22 }}>
        {t("onboard.trySample")}
      </p>
      <div className="onboard-samples">
        {SAMPLES.map((id) => {
          const template = repository.getTemplate(id);
          if (!template) return null;
          const member = template.memberId ? repository.getMember(template.memberId) : undefined;
          return (
            <button key={id} type="button" onClick={() => void identifySample(id)}>
              <ObjectTile template={template} member={member} height={64} />
              {member?.stageName ?? template.name}
            </button>
          );
        })}
      </div>
      <div className="onboard-field">
        <label htmlFor="onboard-search">{t("onboard.searchManual")}</label>
        <input
          id="onboard-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("onboard.searchPlaceholder")}
        />
      </div>
      <ul className="onboard-search">
        {hits.slice(0, 8).map((template) => {
          const group = repository.getGroup(template.groupId);
          const member = template.memberId ? repository.getMember(template.memberId) : undefined;
          return (
            <li key={template.id}>
              <button type="button" onClick={() => searchPick(template.id)}>
                <strong>{template.name}</strong>
                <em>{[group?.name, member?.stageName, kindLabel(template.kind, t)].filter(Boolean).join(" · ")}</em>
              </button>
            </li>
          );
        })}
      </ul>
      {sharedHits.length > 0 && (
        <ul className="onboard-search">
          {sharedHits.map((template) => (
            <li key={template.id}>
              <button type="button" onClick={() => searchPickProduction(template)}>
                <strong>{template.name}</strong>
                <em>{[template.groupName, template.memberName, kindLabel(template.kind, t)].filter(Boolean).join(" · ")}</em>
              </button>
            </li>
          ))}
        </ul>
      )}
      {query.trim() && hits.length === 0 && (
        <button type="button" className="onboard-btn" onClick={() => startDescribe(query)}>
          {t("catalog.addWhatYouHave")}
        </button>
      )}
      <button type="button" className="onboard-btn is-ghost" onClick={() => startDescribe(query)}>
        {t("catalog.describeMine")}
      </button>
      {!first && (
        <button type="button" className="onboard-btn is-ghost" onClick={closeCollect}>
          {t("common.cancel")}
        </button>
      )}
    </>
  );
}

interface SharedCatalogHit {
  id: string;
  name: string;
  kind: CollectibleKind;
  groupName: string;
  memberName: string | null;
  releaseName: string | null;
  descriptor: string;
}

function DescribeForm() {
  const pending = useSession((s) => s.pendingDraft);
  const reviewDraft = useSession((s) => s.reviewDraft);
  const openCollect = useSession((s) => s.openCollect);
  const photo = useSession((s) => s.photo);
  const [draft, setDraft] = useState<CatalogDraft>(
    pending ?? { name: "", kind: "photocard", groupId: repository.listGroups()[0]!.id },
  );
  const t = useT();
  const members = repository.listMembers(draft.groupId);
  const eras = repository.listEras(draft.groupId);
  const releases = repository.listReleases(draft.groupId);

  return (
    <>
      <h1>{t("catalog.describeTitle")}</h1>
      <p className="onboard-lede">{t("catalog.describeLede")}</p>
      {photo && (
        <div className="onboard-avatar" style={{ width: "100%", height: 160, borderRadius: 16 }}>
          <img src={photo.url} alt="" />
        </div>
      )}
      <div className="onboard-field">
        <label htmlFor="catalog-name">{t("catalog.name")}</label>
        <input
          id="catalog-name"
          value={draft.name}
          onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))}
          placeholder={t("catalog.namePlaceholder")}
        />
      </div>
      <div className="onboard-field">
        <label htmlFor="catalog-kind">{t("catalog.kind")}</label>
        <select
          id="catalog-kind"
          value={draft.kind}
          onChange={(e) =>
            setDraft((current) => ({ ...current, kind: e.target.value as CollectibleKind }))
          }
        >
          {COLLECTIBLE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kindLabel(kind, t)}
            </option>
          ))}
        </select>
      </div>
      <div className="onboard-field">
        <label htmlFor="catalog-group">{t("catalog.group")}</label>
        <select
          id="catalog-group"
          value={draft.groupId}
          onChange={(e) =>
            setDraft((current) => ({
              ...current,
              groupId: e.target.value as GroupId,
              memberId: undefined,
              eraId: undefined,
              releaseId: undefined,
              releaseVersionId: undefined,
            }))
          }
        >
          {repository.listGroups().map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </div>
      <div className="onboard-field">
        <label htmlFor="catalog-member">{t("catalog.member")}</label>
        <select
          id="catalog-member"
          value={draft.memberId ?? ""}
          onChange={(e) =>
            setDraft((current) => ({
              ...current,
              ...(e.target.value
                ? { memberId: e.target.value as CatalogDraft["memberId"] }
                : { memberId: undefined }),
            }))
          }
        >
          <option value="">{t("catalog.optional")}</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.stageName}
            </option>
          ))}
        </select>
      </div>
      <div className="onboard-field">
        <label htmlFor="catalog-era">{t("catalog.era")}</label>
        <select
          id="catalog-era"
          value={draft.eraId ?? ""}
          onChange={(e) =>
            setDraft((current) => ({
              ...current,
              ...(e.target.value ? { eraId: e.target.value as CatalogDraft["eraId"] } : { eraId: undefined }),
            }))
          }
        >
          <option value="">{t("catalog.optional")}</option>
          {eras.map((era) => (
            <option key={era.id} value={era.id}>
              {era.name}
            </option>
          ))}
        </select>
      </div>
      <div className="onboard-field">
        <label htmlFor="catalog-release">{t("catalog.release")}</label>
        <select
          id="catalog-release"
          value={draft.releaseId ?? ""}
          onChange={(e) =>
            setDraft((current) => ({
              ...current,
              ...(e.target.value
                ? { releaseId: e.target.value as CatalogDraft["releaseId"] }
                : { releaseId: undefined }),
            }))
          }
        >
          <option value="">{t("catalog.optional")}</option>
          {releases.map((release) => (
            <option key={release.id} value={release.id}>
              {release.title}
            </option>
          ))}
        </select>
      </div>
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={() => reviewDraft(draft)}>
          {t("common.continue")}
        </button>
        <button type="button" className="onboard-btn is-ghost" onClick={openCollect}>
          {t("common.back")}
        </button>
      </div>
    </>
  );
}

function ConfirmForm() {
  const candidates = useSession((s) => s.candidates);
  const selected = useSession((s) => s.selectedTemplateId);
  const photo = useSession((s) => s.photo);
  const draft = useSession((s) => s.pendingDraft);
  const matches = useSession((s) => s.catalogMatches);
  const mode = useSession((s) => s.confirmMode);
  const confirmHolding = useSession((s) => s.confirmHolding);
  const resolveDraft = useSession((s) => s.resolveDraft);
  const useCatalogMatch = useSession((s) => s.useCatalogMatch);
  const createFromDraft = useSession((s) => s.createFromDraft);
  const wantInstead = useSession((s) => s.wantInstead);
  const openCollect = useSession((s) => s.openCollect);
  const top = candidates[0];
  const template = selected ? repository.getTemplate(selected) : undefined;
  const t = useT();

  if (mode === "choose") {
    return (
      <>
        <h1>{t("catalog.chooseTitle")}</h1>
        <p className="onboard-lede">{t("catalog.chooseLede")}</p>
        <ul className="onboard-search onboard-matches">
          {matches.map((match) => {
            const item = match.template;
            const group = repository.getGroup(item.groupId);
            const member = item.memberId ? repository.getMember(item.memberId) : undefined;
            return (
              <li key={item.id}>
                <button type="button" onClick={() => useCatalogMatch(item.id)}>
                  <ObjectTile template={item} {...(member ? { member } : {})} height={56} />
                  <span>
                    <strong>{item.name}</strong>
                    <em>{[group?.name, member?.stageName, kindLabel(item.kind, t)].filter(Boolean).join(" · ")}</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="onboard-actions">
          <button type="button" className="onboard-btn" onClick={createFromDraft}>
            {t("catalog.createNew")}
          </button>
          <button type="button" className="onboard-btn is-ghost" onClick={openCollect}>
            {t("common.back")}
          </button>
        </div>
      </>
    );
  }

  if (mode === "found" && template) {
    return (
      <>
        <h1>{t("catalog.foundTitle")}</h1>
        <p className="onboard-lede">{t("catalog.foundLede")}</p>
        <CollectibleSummary templateId={template.id} photoUrl={photo?.url} />
        <div className="onboard-actions">
          <button type="button" className="onboard-btn" onClick={confirmHolding}>
            {t("catalog.useThis")}
          </button>
          <button type="button" className="onboard-btn is-ghost" onClick={createFromDraft}>
            {t("catalog.createNew")}
          </button>
          <button type="button" className="onboard-btn is-ghost" onClick={openCollect}>
            {t("common.back")}
          </button>
        </div>
      </>
    );
  }

  if (mode === "draft" && draft) {
    const group = repository.getGroup(draft.groupId);
    const member = draft.memberId ? repository.getMember(draft.memberId) : undefined;
    const era = draft.eraId ? repository.getEra(draft.eraId) : undefined;
    const release = draft.releaseId ? repository.getRelease(draft.releaseId) : undefined;
    return (
      <>
        <h1>{t("catalog.confirmTitle")}</h1>
        <p className="onboard-lede">{t("catalog.confirmLede")}</p>
        {photo && (
          <div className="onboard-avatar" style={{ width: "100%", height: 180, borderRadius: 16 }}>
            <img src={photo.url} alt="" />
          </div>
        )}
        <div className="onboard-match">
          <span className="s-search-dot" />
          <div>
            <strong>{draft.name}</strong>
            {member && <em>{member.stageName}</em>}
            {group && <em>{group.name}</em>}
            {era && <em>{era.name}</em>}
            {release && <em>{release.title}</em>}
            <em>{kindLabel(draft.kind, t)}</em>
          </div>
        </div>
        <div className="onboard-actions">
          <button type="button" className="onboard-btn" onClick={resolveDraft}>
            {t("common.confirm")}
          </button>
          <button type="button" className="onboard-btn is-ghost" onClick={openCollect}>
            {t("common.back")}
          </button>
        </div>
      </>
    );
  }

  if (mode === "fresh" && draft) {
    const group = repository.getGroup(draft.groupId);
    const member = draft.memberId ? repository.getMember(draft.memberId) : undefined;
    const era = draft.eraId ? repository.getEra(draft.eraId) : undefined;
    const release = draft.releaseId ? repository.getRelease(draft.releaseId) : undefined;
    return (
      <>
        <h1>{t("onboard.collectTitle")}</h1>
        <p className="onboard-lede">{t("catalog.confirmLede")}</p>
        {photo && (
          <div className="onboard-avatar" style={{ width: "100%", height: 180, borderRadius: 16 }}>
            <img src={photo.url} alt="" />
          </div>
        )}
        <div className="onboard-match">
          <span className="s-search-dot" />
          <div>
            <strong>{draft.name}</strong>
            {member && <em>{member.stageName}</em>}
            {group && <em>{group.name}</em>}
            {era && <em>{era.name}</em>}
            {release && <em>{release.title}</em>}
            <em>{kindLabel(draft.kind, t)}</em>
          </div>
        </div>
        <div className="onboard-actions">
          <button type="button" className="onboard-btn" onClick={createFromDraft}>
            {t("profile.addToCollection")}
          </button>
          <button type="button" className="onboard-btn is-ghost" onClick={openCollect}>
            {t("common.back")}
          </button>
        </div>
      </>
    );
  }

  if (!top || !template) {
    return (
      <>
        <h1>{t("onboard.unidentifiedTitle")}</h1>
        <p className="onboard-lede">{t("onboard.unidentifiedLede")}</p>
        <button type="button" className="onboard-btn" onClick={openCollect}>
          {t("onboard.chooseManual")}
        </button>
      </>
    );
  }
  const home = homeForTemplate(template);
  const unsure = top.confidence < 0.72;

  return (
    <>
      <h1>{unsure ? t("onboard.couldBe") : t("onboard.looksLike")}</h1>
      <p className="onboard-lede">{t("onboard.placeWhere", { where: homeWhere(home.zone, t) })}</p>
      <CollectibleSummary templateId={template.id} photoUrl={photo?.url} note={unsure ? t("onboard.couldBeThis") : t("onboard.looksRight")} />
      {candidates.slice(1).map((candidate) => {
        const other = repository.getTemplate(candidate.templateId);
        if (!other) return null;
        return (
          <button
            key={candidate.templateId}
            type="button"
            className={`onboard-btn is-ghost${selected === candidate.templateId ? " is-on" : ""}`}
            onClick={() => useSession.setState({ selectedTemplateId: candidate.templateId })}
          >
            {t("onboard.notThisTry", { name: other.name })}
          </button>
        );
      })}
      <div className="onboard-actions">
        <button type="button" className="onboard-btn" onClick={confirmHolding}>
          {t("common.confirm")}
        </button>
        <button type="button" className="onboard-btn is-ghost" onClick={openCollect}>
          {t("onboard.notThis")}
        </button>
        <button type="button" className="onboard-btn is-ghost" onClick={wantInstead}>
          {t("onboard.saveWishlist")}
        </button>
      </div>
    </>
  );
}

function CollectibleSummary({
  templateId,
  photoUrl,
  note,
}: {
  templateId: TemplateId;
  photoUrl?: string;
  note?: string;
}) {
  const template = repository.getTemplate(templateId);
  const t = useT();
  if (!template) return null;
  const group = repository.getGroup(template.groupId);
  const member = template.memberId ? repository.getMember(template.memberId) : undefined;
  const release = template.releaseId ? repository.getRelease(template.releaseId) : undefined;
  const version = template.releaseVersionId ? repository.getReleaseVersion(template.releaseVersionId) : undefined;
  return (
    <>
      {photoUrl && (
        <div className="onboard-avatar" style={{ width: "100%", height: 180, borderRadius: 16 }}>
          <img src={photoUrl} alt="" />
        </div>
      )}
      <div className="onboard-match">
        <ObjectTile template={template} {...(member ? { member } : {})} height={72} />
        <div>
          <strong>{template.name}</strong>
          {member && <em>{member.stageName}</em>}
          {group && <em>{group.name}</em>}
          {release && <em>{release.title}</em>}
          {version && <em>{version.name}</em>}
          <em>{kindLabel(template.kind, t)}</em>
          {note && <em>{note}</em>}
        </div>
      </div>
    </>
  );
}

function RevealBeat() {
  const enterFirstRoom = useSession((s) => s.enterFirstRoom);
  const reduced = useReducedMotion();
  const t = useT();

  useEffect(() => {
    // Keep the reveal's explicit action usable when reduced motion is enabled.
    const timer = window.setTimeout(enterFirstRoom, reduced ? 1600 : 2200);
    return () => window.clearTimeout(timer);
  }, [enterFirstRoom, reduced]);

  return (
    <motion.div
      className="onboard-reveal"
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={ease.text}
    >
      <h1>{t("onboard.revealTitle")}</h1>
      <p className="onboard-lede">{t("onboard.revealLede")}</p>
      <button type="button" className="onboard-btn" onClick={enterFirstRoom}>
        {t("onboard.openRoom")}
      </button>
    </motion.div>
  );
}

function MeetCollectors() {
  const session = useSession((s) => s.session);
  const finishFirstSession = useSession((s) => s.finishFirstSession);
  const viewerId = session.kind === "none" ? undefined : session.userId;
  const t = useT();

  const people = useMemo(() => {
    if (!viewerId) return [];
    const mine = repository.getProfile(viewerId);
    const myGroups = new Set<string>(mine?.favoriteGroupIds ?? []);
    const myBias = new Set<string>(mine?.biasMemberIds ?? []);
    const closeness = (favoriteGroupIds: readonly string[], biasMemberIds: readonly string[]) => {
      const primaryGroup = favoriteGroupIds[0];
      const primaryBias = biasMemberIds[0];
      const groupHit = primaryGroup && myGroups.has(primaryGroup) ? 2 : favoriteGroupIds.some((id) => myGroups.has(id)) ? 1 : 0;
      const biasHit = primaryBias && myBias.has(primaryBias) ? 2 : biasMemberIds.some((id) => myBias.has(id)) ? 1 : 0;
      return biasHit * 10 + groupHit;
    };
    return repository
      .listUsers()
      .filter((user) => user.id !== viewerId && isFixtureUser(user.id))
      .map((user) => {
        const profile = repository.getProfile(user.id);
        const compat = repository.getCompatibility(viewerId, user.id);
        const group = profile?.favoriteGroupIds[0] ? repository.getGroup(profile.favoriteGroupIds[0]) : undefined;
        const bias = profile?.biasMemberIds[0] ? repository.getMember(profile.biasMemberIds[0]) : undefined;
        return { user, profile, compat, group, bias };
      })
      .filter((row) => row.profile)
      .sort((a, b) => {
        const delta =
          closeness(b.profile!.favoriteGroupIds, b.profile!.biasMemberIds) -
          closeness(a.profile!.favoriteGroupIds, a.profile!.biasMemberIds);
        return delta !== 0 ? delta : b.compat.score - a.compat.score;
      })
      .slice(0, 2);
  }, [viewerId]);

  return (
    <>
      <h1>{t("onboard.meetTitle")}</h1>
      <p className="onboard-lede">{t("onboard.meetLede")}</p>
      <div className="onboard-meet">
        {people.map(({ user, profile, compat, group, bias }) => (
          <button
            key={user.id}
            type="button"
            className="onboard-person"
            onClick={() => finishFirstSession("profile", user.id)}
          >
            {profile && <SocialAvatar user={user} profile={profile} size={56} />}
            <span>
              <strong>{user.displayName}</strong>
              <em>
                {[group?.name, bias?.stageName].filter(Boolean).join(" · ") || t("common.collector")}
              </em>
              <em>{t("onboard.meetCompat", { score: compat.score })}</em>
            </span>
          </button>
        ))}
      </div>
      <button type="button" className="onboard-skip" onClick={() => finishFirstSession("feed")}>
        {t("onboard.findPeople")}
      </button>
    </>
  );
}
