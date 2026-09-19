"use client";

import { useEffect, useMemo, useState } from "react";
import {
  EXPLORE_DESTINATIONS,
  looksLikeHandle,
  searchCollectibles,
  searchGroups,
  searchPeople,
  searchPosts,
  searchRooms,
  type ExploreDestination,
  type ExploreReason,
} from "@/domain/explore";
import { repository } from "@/domain/memory-repository";
import { collectorTypeLabel, kindLabel } from "@/locale/copy";
import type { PostId, UserId } from "@/domain/types";
import { useT } from "@/locale/store";
import type { Translate } from "@/locale/translate";
import { ObjectTile } from "@/world/ui/ObjectTile";
import { PostCard } from "@/world/ui/PostCard";
import { SocialAvatar } from "@/world/ui/SocialAvatar";
import {
  IconCard,
  IconDoor,
  IconGroup,
  IconPhoto,
  IconSearch,
  IconUser,
} from "@/world/ui/SocialIcons";
import { SocialShell } from "@/world/ui/SocialShell";
import { clearSearchPreset, getSearchPreset } from "@/world/store/searchPreset";

const DEBOUNCE_MS = 200;

let remembered: { query: string; destination: ExploreDestination | null } = {
  query: "",
  destination: null,
};

export function CollectorSearch({
  viewerId,
  onViewProfile,
  onEnterRoom,
  onShare,
}: {
  viewerId: UserId;
  onViewProfile: (userId: UserId) => void;
  onEnterRoom: (userId: UserId) => void;
  onShare: (postId: PostId) => void;
}) {
  const preset = getSearchPreset();
  const [query, setQuery] = useState(() => preset?.query ?? remembered.query);
  const [debounced, setDebounced] = useState(() => preset?.query ?? remembered.query);
  const [destination, setDestination] = useState<ExploreDestination | null>(() => preset?.destination ?? remembered.destination);
  const t = useT();

  useEffect(() => {
    clearSearchPreset();
    const applyPreset = (event: Event) => {
      const detail = (event as CustomEvent<{ query: string; destination: ExploreDestination }>).detail;
      if (!detail) return;
      setQuery(detail.query);
      setDebounced(detail.query);
      setDestination(detail.destination);
      remembered = detail;
      clearSearchPreset();
    };
    window.addEventListener("seoully:assistant-search", applyPreset);
    return () => window.removeEventListener("seoully:assistant-search", applyPreset);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    remembered = { query, destination };
  }, [query, destination]);

  const people = useMemo(
    () => (destination === "people" ? searchPeople(debounced, viewerId) : []),
    [destination, debounced, viewerId],
  );
  const rooms = useMemo(
    () => (destination === "rooms" ? searchRooms(debounced, viewerId) : []),
    [destination, debounced, viewerId],
  );
  const posts = useMemo(
    () => (destination === "posts" ? searchPosts(debounced) : []),
    [destination, debounced],
  );
  const collectibles = useMemo(
    () => (destination === "collectibles" ? searchCollectibles(debounced, viewerId) : []),
    [destination, debounced, viewerId],
  );
  const entities = useMemo(
    () => (destination === "entities" ? searchGroups(debounced) : []),
    [destination, debounced],
  );

  const activeQuery = query.trim();
  const handleQuery = looksLikeHandle(query);
  const showingResults = destination !== null;

  const clearSearch = () => {
    setQuery("");
    setDebounced("");
    remembered = { query: "", destination };
  };

  const backToExplore = () => {
    setDestination(null);
  };

  const exploreEntity = (name: string) => {
    setQuery(name);
    setDebounced(name);
    setDestination("people");
  };

  return (
    <SocialShell tab="search">
      <div className="s-search s-explore">
        <h1>{t("search.title")}</h1>
        {!showingResults && <p className="s-explore-lede">{t("search.lede")}</p>}

        <div className="s-explore-field">
          <span className="s-explore-field-icon" aria-hidden="true">
            <IconSearch />
          </span>
          <input
            className="s-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            aria-label={t("nav.search")}
            autoFocus
          />
          {activeQuery ? (
            <button type="button" className="s-explore-clear" onClick={clearSearch}>
              {t("search.clear")}
            </button>
          ) : null}
        </div>

        {!showingResults && (
          <>
            <p className="s-explore-prompt">{t("search.prompt")}</p>
            <ul className="s-explore-dests">
              {EXPLORE_DESTINATIONS.map((id) => (
                <li key={id}>
                  <button
                    type="button"
                    className={`s-explore-dest is-${id}${handleQuery && id === "people" ? " is-suggested" : ""}`}
                    onClick={() => setDestination(id)}
                  >
                    <span className="s-explore-dest-icon">{destinationIcon(id)}</span>
                    <span>
                      <strong>{destinationTitle(id, t)}</strong>
                      <em>
                        {handleQuery && id === "people"
                          ? t("search.handleHint")
                          : destinationHint(id, t)}
                      </em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {showingResults && destination && (
          <section className="s-explore-results">
            <div className="s-explore-toolbar">
              <button type="button" className="s-explore-back" onClick={backToExplore} aria-label={t("search.back")}>
                {t("common.back")}
              </button>
              <div className="s-explore-heading">
                {activeQuery ? <strong>{activeQuery.replace(/^@+/, "")}</strong> : null}
                <em>{destinationTitle(destination, t)}</em>
              </div>
            </div>

            {!activeQuery && <p className="s-profile-empty">{t("search.needQuery")}</p>}

            {activeQuery && destination === "people" && (
              <PeopleResults
                hits={people}
                empty={t("search.none")}
                heading={t("search.resultsPeople")}
                reasonText={(reason) => reasonLabel(reason, t)}
                onViewProfile={onViewProfile}
              />
            )}

            {activeQuery && destination === "rooms" && (
              <RoomResults
                hits={rooms}
                empty={t("search.none")}
                heading={t("search.resultsRooms")}
                matchLabel={(score) => t("search.match", { score })}
                enterLabel={t("profile.enterRoom")}
                reasonText={(reason) => reasonLabel(reason, t)}
                onEnterRoom={onEnterRoom}
              />
            )}

            {activeQuery && destination === "posts" && (
              <PostResults
                hits={posts}
                empty={t("search.none")}
                heading={t("search.resultsPosts")}
                viewerId={viewerId}
                onViewProfile={onViewProfile}
                onShare={onShare}
              />
            )}

            {activeQuery && destination === "collectibles" && (
              <CollectibleResults
                hits={collectibles}
                empty={t("search.none")}
                heading={t("search.resultsCollectibles")}
                kindText={(kind) => kindLabel(kind, t)}
                onOpen={onViewProfile}
              />
            )}

            {activeQuery && destination === "entities" && (
              <EntityResults
                hits={entities}
                empty={t("search.none")}
                heading={t("search.resultsEntities")}
                seeCollectors={t("search.seeCollectors")}
                onExplore={exploreEntity}
              />
            )}
          </section>
        )}
      </div>
    </SocialShell>
  );
}

function PeopleResults({
  hits,
  empty,
  heading,
  reasonText,
  onViewProfile,
}: {
  hits: ReturnType<typeof searchPeople>;
  empty: string;
  heading: string;
  reasonText: (reason: ExploreReason) => string;
  onViewProfile: (userId: UserId) => void;
}) {
  if (hits.length === 0) return <p className="s-profile-empty">{empty}</p>;
  return (
    <>
      <h2>{heading}</h2>
    <ul>
      {hits.map((hit) => {
        const user = repository.getUser(hit.userId);
        const profile = repository.getProfile(hit.userId);
        if (!user || !profile) return null;
        return (
          <li key={hit.userId}>
            <button type="button" className="s-search-row" onClick={() => onViewProfile(hit.userId)}>
              <SocialAvatar user={user} profile={profile} size={40} />
              <span>
                <strong>{user.displayName}</strong>
                <em>
                  @{user.handle}
                  {profile.tagline ? ` · ${profile.tagline}` : ""}
                </em>
                <Archetype type={profile.collectorType} />
                {hit.reason ? <i className="s-explore-reason">{reasonText(hit.reason)}</i> : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
    </>
  );
}

function RoomResults({
  hits,
  empty,
  heading,
  matchLabel,
  enterLabel,
  reasonText,
  onEnterRoom,
}: {
  hits: ReturnType<typeof searchRooms>;
  empty: string;
  heading: string;
  matchLabel: (score: number) => string;
  enterLabel: string;
  reasonText: (reason: ExploreReason) => string;
  onEnterRoom: (userId: UserId) => void;
}) {
  if (hits.length === 0) return <p className="s-profile-empty">{empty}</p>;
  return (
    <>
      <h2>{heading}</h2>
      <ul className="s-explore-rooms">
        {hits.map((hit) => {
          const user = repository.getUser(hit.userId);
          const profile = repository.getProfile(hit.userId);
          if (!user || !profile) return null;
          return (
            <li key={hit.roomId} className="s-explore-room">
              <div className="s-explore-who">
                <SocialAvatar user={user} profile={profile} size={48} />
                <div>
                  <strong>{user.displayName}</strong>
                  {hit.identity ? <em>{hit.identity}</em> : null}
                  <Archetype type={profile.collectorType} />
                  {hit.matchScore !== undefined ? (
                    <b className="s-explore-match">{matchLabel(hit.matchScore)}</b>
                  ) : null}
                  {hit.reason ? <i className="s-explore-reason">{reasonText(hit.reason)}</i> : null}
                </div>
              </div>
              <button type="button" className="s-enter" onClick={() => onEnterRoom(hit.userId)}>
                {enterLabel}
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function PostResults({
  hits,
  empty,
  heading,
  viewerId,
  onViewProfile,
  onShare,
}: {
  hits: ReturnType<typeof searchPosts>;
  empty: string;
  heading: string;
  viewerId: UserId;
  onViewProfile: (userId: UserId) => void;
  onShare: (postId: PostId) => void;
}) {
  if (hits.length === 0) return <p className="s-profile-empty">{empty}</p>;
  return (
    <>
      <h2>{heading}</h2>
      <div className="s-explore-posts">
        {hits.map(({ post }) => (
          <PostCard
            key={post.id}
            post={post}
            viewerId={viewerId}
            onViewProfile={onViewProfile}
            onShare={onShare}
          />
        ))}
      </div>
    </>
  );
}

function CollectibleResults({
  hits,
  empty,
  heading,
  kindText,
  onOpen,
}: {
  hits: ReturnType<typeof searchCollectibles>;
  empty: string;
  heading: string;
  kindText: (kind: ReturnType<typeof searchCollectibles>[number]["template"]["kind"]) => string;
  onOpen: (userId: UserId) => void;
}) {
  if (hits.length === 0) return <p className="s-profile-empty">{empty}</p>;
  return (
    <>
      <h2>{heading}</h2>
      <ul>
        {hits.map((hit) => {
          const group = repository.getGroup(hit.template.groupId);
          const member = hit.template.memberId ? repository.getMember(hit.template.memberId) : undefined;
          const line = [group?.name, member?.stageName, kindText(hit.template.kind)]
            .filter(Boolean)
            .join(" · ");
          const body = (
            <>
              <ObjectTile template={hit.template} {...(member ? { member } : {})} height={44} />
              <span>
                <strong>{hit.template.name}</strong>
                {line ? <em>{line}</em> : null}
              </span>
            </>
          );
          return (
            <li key={hit.template.id}>
              {hit.ownerId ? (
                <button type="button" className="s-search-row" onClick={() => onOpen(hit.ownerId!)}>
                  {body}
                </button>
              ) : (
                <div className="s-search-row is-static">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function EntityResults({
  hits,
  empty,
  heading,
  seeCollectors,
  onExplore,
}: {
  hits: ReturnType<typeof searchGroups>;
  empty: string;
  heading: string;
  seeCollectors: string;
  onExplore: (query: string) => void;
}) {
  if (hits.length === 0) return <p className="s-profile-empty">{empty}</p>;
  return (
    <>
      <h2>{heading}</h2>
      <ul>
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.id}`}>
            <button type="button" className="s-search-row" onClick={() => onExplore(hit.query)}>
              <span className="s-search-dot" style={hit.accent ? { background: hit.accent } : undefined} />
              <span>
                <strong>{hit.title}</strong>
                {hit.subtitle ? <em>{hit.subtitle}</em> : null}
              </span>
              <em className="s-explore-go">{seeCollectors}</em>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function reasonLabel(reason: ExploreReason, t: Translate): string {
  if (reason.kind === "wishlist") return t("search.reasonWishlist");
  return t("search.reasonCollects", { name: reason.name });
}

function destinationTitle(id: ExploreDestination, t: Translate): string {
  switch (id) {
    case "people":
      return t("search.destPeople");
    case "rooms":
      return t("search.destRooms");
    case "posts":
      return t("search.destPosts");
    case "collectibles":
      return t("search.destCollectibles");
    case "entities":
      return t("search.destEntities");
  }
}

function destinationHint(id: ExploreDestination, t: Translate): string {
  switch (id) {
    case "people":
      return t("search.destPeopleHint");
    case "rooms":
      return t("search.destRoomsHint");
    case "posts":
      return t("search.destPostsHint");
    case "collectibles":
      return t("search.destCollectiblesHint");
    case "entities":
      return t("search.destEntitiesHint");
  }
}

function destinationIcon(id: ExploreDestination) {
  switch (id) {
    case "people":
      return <IconUser />;
    case "rooms":
      return <IconDoor />;
    case "posts":
      return <IconPhoto />;
    case "collectibles":
      return <IconCard />;
    case "entities":
      return <IconGroup />;
  }
}

function Archetype({ type }: { type?: string }) {
  const t = useT();
  if (!type) return null;
  return <span className="s-chip s-chip-type s-explore-type">{collectorTypeLabel(type, t)}</span>;
}
