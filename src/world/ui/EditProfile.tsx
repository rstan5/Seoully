"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { readLocalImage } from "@/domain/media";
import { repository } from "@/domain/memory-repository";
import {
  ACCENT_PICKER,
  BACKGROUND_PRESETS,
  accentSwatch,
  backgroundFromLegacyTint,
  profileThemeVars,
  resolveProfileTheme,
} from "@/domain/profile-theme";
import { handleError, normalizeHandle } from "@/domain/session";
import type {
  CollectorInterest,
  EraId,
  GroupId,
  MemberId,
  ProfileAccentPreset,
  ProfileBackgroundPreset,
  ProfileThemeChoice,
  UserId,
} from "@/domain/types";
import { collectorTypeLabel, interestLabel, localizeError, photoErrorKey, themePresetLabel } from "@/locale/copy";
import { useT } from "@/locale/store";
import { LanguageToggle } from "@/world/ui/LanguageToggle";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import { useSession } from "@/world/store/sessionStore";
import { updateMySeoullyProfile } from "@/server/auth/actions";

const INTERESTS: CollectorInterest[] = [
  "photocards",
  "albums",
  "merch",
  "vinyl",
  "posters",
  "lightsticks",
  "everything",
];

const COLLECTOR_TYPES = [
  "Collector",
  "Collects everything",
  "Completionist · era-focused",
  "Bias-focused · aesthetic curator",
];

export function EditProfile({
  userId,
  onClose,
}: {
  userId: UserId;
  onClose: () => void;
}) {
  const user = repository.getUser(userId);
  const profile = repository.getProfile(userId);
  const room = repository.getRoomByOwner(userId);
  const groups = repository.listGroups();
  const session = useSession((state) => state.session);
  const signOut = useSession((state) => state.signOut);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [handle, setHandle] = useState(user?.handle ?? "");
  const [tagline, setTagline] = useState(profile?.tagline ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [location, setLocation] = useState(profile?.location ?? "");
  const [joinedMonth, setJoinedMonth] = useState((user?.joinedAt ?? "").slice(0, 7));
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [groupIds, setGroupIds] = useState<string[]>(profile?.favoriteGroupIds ?? []);
  const [biasIds, setBiasIds] = useState<string[]>(profile?.biasMemberIds ?? []);
  const [eraIds, setEraIds] = useState<string[]>(profile?.favoriteEraIds ?? []);
  const [collectorType, setCollectorType] = useState(profile?.collectorType ?? "Collector");
  const [interests, setInterests] = useState<CollectorInterest[]>(profile?.collectorInterests ?? []);
  const [appearance, setAppearance] = useState<ProfileThemeChoice>(() =>
    initialAppearance(profile?.appearance),
  );
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const members = useMemo(
    () => groupIds.flatMap((id) => repository.listMembers(id)),
    [groupIds],
  );
  const eras = useMemo(
    () => groupIds.flatMap((id) => repository.listEras(id)),
    [groupIds],
  );
  const collectorTypes = COLLECTOR_TYPES.includes(collectorType)
    ? COLLECTOR_TYPES
    : [collectorType, ...COLLECTOR_TYPES];

  const draftUser = {
    id: userId,
    handle: handle || "username",
    displayName: displayName.trim() || "Collector",
    joinedAt: user?.joinedAt ?? "",
  };
  const draftProfile = {
    ...(profile ?? {
      userId,
      tagline: "",
      bio: "",
      favoriteGroupIds: [],
      biasMemberIds: [],
      favoriteEraIds: [],
      collectorType: "Collector",
      avatarColor: "#f6aebf",
      roomId: room?.id ?? ("room-draft" as never),
    }),
    avatarUrl,
    tagline,
    bio,
    collectorType,
  };
  const preview = resolveProfileTheme(appearance, room);

  const toggle = <T extends string>(list: T[], id: T, setList: (next: T[]) => void) => {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };

  const pickGroups = (id: string) => {
    const next = groupIds.includes(id) ? groupIds.filter((item) => item !== id) : [...groupIds, id];
    const keep = new Set(next);
    setGroupIds(next);
    setBiasIds((ids) => ids.filter((bias) => keep.has(repository.getMember(bias as MemberId)?.groupId ?? "")));
    setEraIds((ids) => ids.filter((era) => keep.has(repository.getEra(era as EraId)?.groupId ?? "")));
  };

  const save = async () => {
    const nextHandle = normalizeHandle(handle);
    const handleIssue = handleError(nextHandle);
    if (handleIssue) {
      setError(handleIssue);
      return;
    }
    const taken = repository.getUserByHandle(nextHandle);
    if (session.kind !== "auth" && taken && taken.id !== userId) {
      setError("error.handleTaken");
      return;
    }
    if (!displayName.trim()) {
      setError("error.displayName");
      return;
    }
    const patch = {
      displayName: displayName.trim(),
      handle: nextHandle,
      tagline: tagline.trim(),
      bio: bio.trim(),
      location,
      favoriteGroupIds: groupIds as GroupId[],
      biasMemberIds: biasIds as MemberId[],
      favoriteEraIds: eraIds as EraId[],
      collectorInterests: interests,
      collectorType,
    };
    if (session.kind === "auth") {
      if (session.userId !== userId) { setError("error.authUnavailable"); return; }
      const result = await updateMySeoullyProfile(patch);
      if (!result.ok) {
        const failure: Record<string, string> = {
          "handle-taken": "error.handleTaken",
          "invalid-input": "error.authInvalidInput",
          "configuration": "error.authConfiguration",
          "invalid-credentials": "error.invalidCredentials",
          "profile-missing": "error.profileMissing",
          unavailable: "error.authUnavailable",
          "email-taken": "error.emailTaken",
        };
        setError(failure[result.reason] ?? "error.authUnavailable");
        return;
      }
      if (!("identity" in result)) { setError("error.authUnavailable"); return; }
      repository.adoptAuthenticatedIdentity(result.identity);
      // Avatar bytes and appearance preferences intentionally remain in the
      // prototype repository until the media/profile-preferences migration.
      repository.updateProfile(userId, { avatarUrl, appearance: persistAppearance(appearance) });
    } else {
      repository.updateProfile(userId, {
        ...patch,
        ...(joinedMonth ? { joinedAt: `${joinedMonth}-01` } : {}),
        avatarUrl,
        appearance: persistAppearance(appearance),
      });
    }
    onClose();
  };

  return (
    <div className="s-edit">
      <header className="s-edit-top">
        <button type="button" className="s-edit-text" onClick={onClose}>
          {t("edit.cancel")}
        </button>
        <h1>{t("edit.title")}</h1>
        <div className="s-top-end">
          <LanguageToggle />
          <button type="button" className="s-edit-text is-save" onClick={() => void save()}>
            {t("edit.save")}
          </button>
        </div>
      </header>

      <div className="s-edit-body">
        {error && <p className="s-edit-error">{localizeError(error, t)}</p>}

        <section className="s-edit-section">
          <h2>{t("edit.identity")}</h2>

          <label className="s-edit-photo">
            <SocialAvatar user={draftUser} profile={draftProfile} size={88} />
            <span>{t("edit.changePhoto")}</span>
            <input
              type="file"
              accept="image/*"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const read = await readLocalImage(file);
                if (!read.ok) {
                  setPhotoError(photoErrorKey(read.code));
                  return;
                }
                setPhotoError(null);
                setAvatarUrl(read.media.url);
              }}
            />
          </label>
          {photoError && <p className="s-edit-error">{localizeError(photoError, t)}</p>}

          <Field label={t("edit.username")} htmlFor="edit-handle">
            <input
              id="edit-handle"
              autoComplete="username"
              value={handle}
              onChange={(event) => {
                setHandle(event.target.value);
                setError(null);
              }}
            />
          </Field>
          <Field label={t("edit.displayName")} htmlFor="edit-name">
            <input
              id="edit-name"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </Field>
          <Field label={t("edit.tagline")} htmlFor="edit-tagline">
            <input
              id="edit-tagline"
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              placeholder={t("edit.taglinePlaceholder")}
            />
          </Field>
          <Field label={t("edit.bio")} htmlFor="edit-bio">
            <textarea
              id="edit-bio"
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </Field>
          <Field label={t("edit.location")} htmlFor="edit-location">
            <input
              id="edit-location"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder={t("edit.locationPlaceholder")}
            />
          </Field>
          {session.kind !== "auth" && <Field label={t("edit.collectingSince")} htmlFor="edit-since">
            <input
              id="edit-since"
              type="month"
              value={joinedMonth}
              onChange={(event) => setJoinedMonth(event.target.value)}
            />
          </Field>}

          <fieldset className="s-edit-picks">
            <legend>{t("edit.favoriteGroups")}</legend>
            <div className="s-edit-chips">
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  className={`s-edit-chip${groupIds.includes(group.id) ? " is-on" : ""}`}
                  onClick={() => pickGroups(group.id)}
                >
                  {group.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="s-edit-picks">
            <legend>{t("edit.favoriteBiases")}</legend>
            {members.length === 0 ? (
              <p className="s-edit-hint">{t("edit.pickGroupFirst")}</p>
            ) : (
              <div className="s-edit-chips">
                {members.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    className={`s-edit-chip${biasIds.includes(member.id) ? " is-on" : ""}`}
                    onClick={() => toggle(biasIds, member.id, setBiasIds)}
                  >
                    {member.stageName}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="s-edit-picks">
            <legend>{t("edit.favoriteEras")}</legend>
            {eras.length === 0 ? (
              <p className="s-edit-hint">{t("edit.pickGroupFirst")}</p>
            ) : (
              <div className="s-edit-chips">
                {eras.map((era) => (
                  <button
                    key={era.id}
                    type="button"
                    className={`s-edit-chip${eraIds.includes(era.id) ? " is-on" : ""}`}
                    onClick={() => toggle(eraIds, era.id, setEraIds)}
                  >
                    {era.name}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="s-edit-picks">
            <legend>{t("edit.collectorType")}</legend>
            <div className="s-edit-chips">
              {collectorTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`s-edit-chip${collectorType === type ? " is-on" : ""}`}
                  onClick={() => setCollectorType(type)}
                >
                  {collectorTypeLabel(type, t)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="s-edit-picks">
            <legend>{t("edit.whatYouCollect")}</legend>
            <div className="s-edit-chips">
              {INTERESTS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`s-edit-chip${interests.includes(item) ? " is-on" : ""}`}
                  onClick={() => toggle(interests, item, setInterests)}
                >
                  {interestLabel(item, t)}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        {session.kind === "auth" && session.userId === userId && (
          <button type="button" className="s-edit-text" onClick={() => void signOut()}>{t("edit.signOut")}</button>
        )}

        <section className="s-edit-section">
          <h2>{t("edit.appearance")}</h2>
          <p className="s-edit-lede">{t("edit.appearanceLede")}</p>

          <LivePreview
            user={draftUser}
            profile={draftProfile}
            appearance={appearance}
          />

          <fieldset className="s-edit-picks">
            <legend>{t("edit.profileAppearance")}</legend>
            <div className="s-edit-modes" role="radiogroup" aria-label={t("edit.profileAppearance")}>
              <Mode
                label={t("edit.modeDefault")}
                hint={t("edit.modeDefaultHint")}
                checked={appearance.mode === "default"}
                onSelect={() => setAppearance({ mode: "default" })}
              />
              <Mode
                label={t("edit.modeCustom")}
                hint={t("edit.modeCustomHint")}
                checked={appearance.mode === "custom"}
                onSelect={() =>
                  setAppearance({
                    mode: "custom",
                    background: appearance.background ?? "paper",
                    primary: appearance.primary ?? "lavender",
                    secondary: appearance.secondary ?? "powder-pink",
                  })
                }
              />
              <Mode
                label={t("edit.modeRoom")}
                hint={t("edit.modeRoomHint")}
                checked={appearance.mode === "room-sync"}
                onSelect={() => setAppearance({ mode: "room-sync" })}
              />
            </div>
          </fieldset>

          {appearance.mode === "custom" && (
            <>
              <SwatchRow
                label={t("edit.background")}
                options={BACKGROUND_PRESETS.map((preset) => ({
                  id: preset.id,
                  label: themePresetLabel(preset.id, preset.label, t),
                  color: preset.paper,
                  ring: preset.ink,
                }))}
                value={appearance.background ?? "paper"}
                onPick={(background) =>
                  setAppearance((current) => ({
                    ...current,
                    mode: "custom",
                    background: background as ProfileBackgroundPreset,
                  }))
                }
              />
              <SwatchRow
                label={t("edit.primary")}
                options={ACCENT_PICKER.map((preset) => ({
                  id: preset.id,
                  label: themePresetLabel(preset.id, preset.label, t),
                  color: accentSwatch(preset.id),
                }))}
                value={appearance.primary ?? "lavender"}
                onPick={(primary) =>
                  setAppearance((current) => ({
                    ...current,
                    mode: "custom",
                    primary: primary as ProfileAccentPreset,
                  }))
                }
              />
              <SwatchRow
                label={t("edit.secondary")}
                options={ACCENT_PICKER.map((preset) => ({
                  id: preset.id,
                  label: themePresetLabel(preset.id, preset.label, t),
                  color: accentSwatch(preset.id),
                }))}
                value={appearance.secondary ?? "powder-pink"}
                onPick={(secondary) =>
                  setAppearance((current) => ({
                    ...current,
                    mode: "custom",
                    secondary: secondary as ProfileAccentPreset,
                  }))
                }
              />
            </>
          )}

          {appearance.mode === "room-sync" && (
            <p className="s-edit-hint">
              {preview.scheme === "dark" ? t("edit.roomDark") : t("edit.roomLight")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}

function LivePreview({
  user,
  profile,
  appearance,
}: {
  user: { id: UserId; handle: string; displayName: string; joinedAt: string };
  profile: {
    avatarUrl?: string;
    avatarColor: string;
    collectorType: string;
  };
  appearance: ProfileThemeChoice;
}) {
  const room = repository.getRoomByOwner(user.id);
  const tokens = resolveProfileTheme(appearance, room);
  const t = useT();
  return (
    <div
      className="s-edit-preview"
      data-scheme={tokens.scheme}
      style={profileThemeVars(tokens) as CSSProperties}
      aria-label={t("edit.preview")}
    >
      <div className="s-edit-preview-head">
        <SocialAvatar
          user={user}
          profile={{
            userId: user.id,
            tagline: "",
            bio: "",
            favoriteGroupIds: [],
            biasMemberIds: [],
            favoriteEraIds: [],
            collectorType: profile.collectorType,
            avatarColor: profile.avatarColor,
            avatarUrl: profile.avatarUrl,
            roomId: room?.id ?? ("room-draft" as never),
          }}
          size={36}
        />
        <div>
          <strong>{user.displayName}</strong>
          <em>@{user.handle}</em>
        </div>
      </div>
      <div className="s-edit-preview-actions">
        <span className="s-btn">{t("profile.follow")}</span>
        <span className="s-btn is-ghost">{t("profile.message")}</span>
      </div>
      <div className="s-edit-preview-meta">
        <span>12 {t("profile.collected")}</span>
        <span className="is-secondary">4 {t("profile.wishlist")}</span>
        <span>{t("edit.previewCompat", { score: 88 })}</span>
      </div>
      <div className="s-edit-preview-card">
        <i />
        <p>
          <strong>{t("edit.previewPost")}</strong>
          <em>{t("edit.previewPostHint")}</em>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label className="s-edit-field" htmlFor={htmlFor}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Mode({
  label,
  hint,
  checked,
  onSelect,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`s-edit-mode${checked ? " is-on" : ""}`}>
      <input type="radio" name="profile-appear" checked={checked} onChange={onSelect} />
      <span>
        {label}
        <em>{hint}</em>
      </span>
    </label>
  );
}

function SwatchRow({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { id: string; label: string; color: string; ring?: string }[];
  value: string;
  onPick: (id: string) => void;
}) {
  const current = options.find((option) => option.id === value);
  return (
    <div className="s-edit-swatches">
      <div className="s-edit-swatches-label">
        <span>{label}</span>
        <em>{current?.label ?? ""}</em>
      </div>
      <div className="s-edit-swatch-row" role="listbox" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`s-edit-swatch${value === option.id ? " is-on" : ""}`}
            style={{
              background: option.color,
              color: option.ring ?? "#2c2e4c",
            }}
            aria-label={`${label}: ${option.label}`}
            aria-pressed={value === option.id}
            onClick={() => onPick(option.id)}
          >
            {value === option.id ? <Check /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path
        d="M3.2 8.4 6.4 11.4 12.8 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function initialAppearance(saved?: ProfileThemeChoice): ProfileThemeChoice {
  if (!saved) return { mode: "default" };
  if (saved.mode !== "custom") return { mode: saved.mode };
  return {
    mode: "custom",
    background: saved.background ?? backgroundFromLegacyTint(saved.tint),
    primary: saved.primary ?? "lavender",
    secondary: saved.secondary ?? "powder-pink",
  };
}

function persistAppearance(choice: ProfileThemeChoice): ProfileThemeChoice {
  if (choice.mode === "default") return { mode: "default" };
  if (choice.mode === "room-sync") return { mode: "room-sync" };
  return {
    mode: "custom",
    background: choice.background ?? "paper",
    primary: choice.primary ?? "lavender",
    secondary: choice.secondary ?? "powder-pink",
  };
}
