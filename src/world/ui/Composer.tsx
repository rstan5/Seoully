"use client";

import { useMemo, useRef, useState } from "react";
import { readLocalPostMedia } from "@/domain/media";
import { isFixtureUser } from "@/domain/session";
import { repository } from "@/domain/memory-repository";
import { useRepoRevision } from "@/domain/use-repository";
import type { CollectibleTemplate, PostMedia, TemplateId, UserId } from "@/domain/types";
import { useT } from "@/locale/store";
import { LanguageToggle } from "@/world/ui/LanguageToggle";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { useWorld } from "@/world/store/worldStore";

/** A focused post composer backed by the existing collector and catalog data. */
export function Composer({
  viewerId,
  onPosted,
}: {
  viewerId: UserId;
  onPosted: () => void;
}) {
  const revision = useRepoRevision();
  const back = useWorld((s) => s.back);
  const inputRef = useRef<HTMLInputElement>(null);
  const roll = useMemo(
    () => (isFixtureUser(viewerId) ? repository.listCameraRoll() : []),
    [viewerId],
  );
  const [picked, setPicked] = useState<PostMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [taggedUserIds, setTaggedUserIds] = useState<UserId[]>([]);
  const [taggedTemplateIds, setTaggedTemplateIds] = useState<TemplateId[]>([]);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [collectiblesOpen, setCollectiblesOpen] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState("");
  const [collectibleQuery, setCollectibleQuery] = useState("");
  const [mediaError, setMediaError] = useState<string | null>(null);
  const t = useT();
  void revision;

  const people = useMemo(() => {
    const query = peopleQuery.trim().replace(/^@+/, "").toLowerCase();
    return repository
      .listUsers()
      .filter((user) => {
        if (!query) return true;
        return [user.handle, user.displayName].some((value) => value.toLowerCase().includes(query));
      })
      .slice(0, 8);
  }, [peopleQuery, revision]);

  const collectibles = useMemo(
    () => (collectibleQuery.trim() ? repository.searchCatalog(collectibleQuery).slice(0, 8) : []),
    [collectibleQuery, revision],
  );

  const attachFile = async (file?: File) => {
    if (!file) return;
    setMediaError(null);
    const result = await readLocalPostMedia(file);
    if (!result.ok) {
      const errorKey = result.code === "too-large"
        ? "compose.mediaTooLarge"
        : result.code === "not-media"
          ? "compose.mediaUnsupported"
          : "compose.mediaUnreadable";
      setMediaError(t(errorKey));
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setPicked(result.media);
  };

  const toggleUser = (id: UserId) => {
    setTaggedUserIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };

  const toggleCollectible = (id: TemplateId) => {
    setTaggedTemplateIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };

  const post = () => {
    if (!picked || (picked.kind !== "photo" && picked.kind !== "video") || !picked.url.trim()) return;
    repository.createPost({
      authorId: viewerId,
      body: caption.trim(),
      kind: "life",
      media: [picked],
      ...(taggedUserIds.length ? { taggedUserIds } : {}),
      ...(taggedTemplateIds.length ? { taggedTemplateIds } : {}),
      ...(location.trim() ? { location: location.trim() } : {}),
    });
    onPosted();
  };

  return (
    <div className="s-compose">
      <header className="s-compose-top">
        <button type="button" onClick={back}>{t("compose.cancel")}</button>
        <strong>{t("compose.newPost")}</strong>
        <div className="s-compose-top-actions">
          <LanguageToggle />
          <button type="button" className="s-compose-share" disabled={!picked} onClick={post}>
            {t("compose.share")}
          </button>
        </div>
      </header>

      <div className="s-compose-scroll">
        <section className="s-compose-media" aria-label={t("compose.mediaLabel")}>
          {picked ? (
            <div className="s-compose-preview">
              {picked.kind === "video" ? (
                <video src={picked.url} controls playsInline aria-label={picked.alt ?? t("compose.mediaLabel")} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={picked.url} alt={picked.alt ?? ""} />
              )}
              <div className="s-compose-media-actions">
                <button type="button" onClick={() => inputRef.current?.click()}>{t("compose.changeMedia")}</button>
                <button type="button" onClick={() => { setPicked(null); setMediaError(null); if (inputRef.current) inputRef.current.value = ""; }}>
                  {t("compose.removeMedia")}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="s-compose-add-media" onClick={() => inputRef.current?.click()}>
              <span aria-hidden="true">＋</span>
              {t("compose.addMedia")}
            </button>
          )}
          <input
            ref={inputRef}
            className="s-compose-file"
            type="file"
            accept="image/*,video/*"
            aria-label={t("compose.addMedia")}
            onChange={(event) => void attachFile(event.currentTarget.files?.[0])}
          />
          {mediaError && <p className="s-compose-error" role="alert">{mediaError}</p>}
        </section>

        {roll.length > 0 && !picked && (
          <section className="s-compose-section">
            <h2>{t("compose.recentPhotos")}</h2>
            <div className="s-compose-roll">
              {roll.map((item, index) => (
                <button key={`${item.url}-${index}`} type="button" onClick={() => setPicked(item)} aria-label={item.alt ?? t("compose.addMedia")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.poster ?? item.url} alt="" />
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="s-compose-fields">
          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder={t("compose.caption")}
            rows={3}
            aria-label={t("compose.captionLabel")}
          />

          <section className="s-compose-tag-section">
            <h2>{t("compose.tagCollectors")}</h2>
            <div className="s-compose-selected-tags">
              {taggedUserIds.map((id) => {
                const user = repository.getUser(id);
                const profile = repository.getProfile(id);
                if (!user || !profile) return null;
                return (
                  <span key={id} className="s-compose-person-chip">
                    <SocialAvatar user={user} profile={profile} size={24} />
                    <span>@{user.handle}</span>
                    <button type="button" aria-label={t("compose.removeCollector", { handle: user.handle })} onClick={() => toggleUser(id)}>×</button>
                  </span>
                );
              })}
            </div>
            <button type="button" className="s-compose-add-tag" aria-expanded={peopleOpen} onClick={() => setPeopleOpen((open) => !open)}>
              {peopleOpen ? t("compose.closePicker") : t("compose.addCollectors")}
            </button>
            {peopleOpen && (
              <div className="s-compose-picker">
                <input value={peopleQuery} onChange={(event) => setPeopleQuery(event.target.value)} placeholder={t("compose.searchCollectors")} aria-label={t("compose.searchCollectors")} />
                <ul>
                  {people.map((user) => {
                    const profile = repository.getProfile(user.id);
                    if (!profile) return null;
                    const selected = taggedUserIds.includes(user.id);
                    return (
                      <li key={user.id}>
                        <span className="s-compose-result-person">
                          <SocialAvatar user={user} profile={profile} size={36} />
                          <span><strong>{user.displayName}</strong><em>@{user.handle}</em></span>
                        </span>
                        <button type="button" className="s-compose-tag-button" aria-pressed={selected} onClick={() => toggleUser(user.id)}>
                          {selected ? t("compose.tagged") : t("compose.tag")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {people.length === 0 && <p>{t("compose.noCollectors")}</p>}
              </div>
            )}
          </section>

          <section className="s-compose-tag-section">
            <h2>{t("compose.tagCollectibles")}</h2>
            <div className="s-compose-selected-collectibles">
              {taggedTemplateIds.map((id) => {
                const template = repository.getTemplate(id);
                return template ? <SelectedCollectible key={id} template={template} onRemove={() => toggleCollectible(id)} /> : null;
              })}
            </div>
            <button type="button" className="s-compose-add-tag" aria-expanded={collectiblesOpen} onClick={() => setCollectiblesOpen((open) => !open)}>
              {collectiblesOpen ? t("compose.closePicker") : t("compose.addCollectibles")}
            </button>
            {collectiblesOpen && (
              <div className="s-compose-picker">
                <input value={collectibleQuery} onChange={(event) => setCollectibleQuery(event.target.value)} placeholder={t("compose.searchCollectibles")} aria-label={t("compose.searchCollectibles")} />
                <ul>
                  {collectibles.map((template) => (
                    <li key={template.id}>
                      <span className="s-compose-result-object">
                        <ObjectTile template={template} {...(template.memberId && repository.getMember(template.memberId) ? { member: repository.getMember(template.memberId) } : {})} height={44} />
                        <span><strong>{template.memberId ? repository.getMember(template.memberId)?.stageName : repository.getGroup(template.groupId)?.name}</strong><em>{collectibleLine(template)}</em></span>
                      </span>
                      <button type="button" className="s-compose-tag-button" aria-pressed={taggedTemplateIds.includes(template.id)} onClick={() => toggleCollectible(template.id)}>
                        {taggedTemplateIds.includes(template.id) ? t("compose.tagged") : t("compose.tag")}
                      </button>
                    </li>
                  ))}
                </ul>
                {collectibleQuery.trim() && collectibles.length === 0 && <p>{t("compose.noCollectibles")}</p>}
              </div>
            )}
          </section>

          <label className="s-compose-location">
            <span>{t("compose.locationLabel")}</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder={t("compose.location")} aria-label={t("compose.locationAria")} />
          </label>
        </div>

        <div className="s-compose-bottom-share">
          <button type="button" className="s-compose-share" disabled={!picked} onClick={post}>{t("compose.share")}</button>
        </div>
      </div>
    </div>
  );
}

function SelectedCollectible({ template, onRemove }: { template: CollectibleTemplate; onRemove: () => void }) {
  const t = useT();
  const member = template.memberId ? repository.getMember(template.memberId) : undefined;
  return (
    <span className="s-compose-collectible-chip">
      <ObjectTile template={template} {...(member ? { member } : {})} height={40} />
      <span><strong>{member?.stageName ?? repository.getGroup(template.groupId)?.name}</strong><em>{collectibleLine(template)}</em></span>
      <button type="button" aria-label={t("compose.removeCollectible", { name: template.name })} onClick={onRemove}>×</button>
    </span>
  );
}

function collectibleLine(template: CollectibleTemplate): string {
  const group = repository.getGroup(template.groupId)?.name;
  const era = template.eraId ? repository.getEra(template.eraId)?.name : undefined;
  const release = template.releaseId ? repository.getRelease(template.releaseId)?.title : undefined;
  return [group, era ?? release, template.name].filter(Boolean).join(" · ");
}
