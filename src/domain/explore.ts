/**
 * Destination search over existing Seoully data.
 *
 * The UI picks a destination after a query. Each function reads through the
 * current repository so a later backend can swap the data source without
 * rewriting Search. Nothing here invents catalog, compatibility, or holdings.
 */

import { repository } from "@/domain/memory-repository";
import type {
  CollectibleTemplate,
  CollectionCompatibility,
  Group,
  Member,
  Post,
  Profile,
  RoomId,
  User,
  UserId,
} from "@/domain/types";

export const EXPLORE_DESTINATIONS = [
  "people",
  "rooms",
  "posts",
  "collectibles",
  "entities",
] as const;

export type ExploreDestination = (typeof EXPLORE_DESTINATIONS)[number];

export type ExploreReason =
  | { kind: "collects"; name: string }
  | { kind: "wishlist" };

export interface ExplorePerson {
  userId: UserId;
  reason?: ExploreReason;
}

export interface ExploreRoom {
  userId: UserId;
  roomId: RoomId;
  identity: string;
  matchScore?: number;
  reason?: ExploreReason;
}

export interface ExplorePost {
  post: Post;
}

export interface ExploreCollectible {
  template: CollectibleTemplate;
  ownerId?: UserId;
}

export interface ExploreEntity {
  kind: "group" | "member";
  id: string;
  title: string;
  subtitle?: string;
  accent?: string;
  query: string;
}

interface CatalogFocus {
  groupIds: Set<string>;
  memberIds: Set<string>;
  eraIds: Set<string>;
  releaseIds: Set<string>;
  templateIds: Set<string>;
  names: string[];
}

const PEOPLE_LIMIT = 24;
const ROOM_LIMIT = 16;
const POST_LIMIT = 24;
const COLLECTIBLE_LIMIT = 24;
const ENTITY_LIMIT = 24;

export function normalizeExploreQuery(query: string): string {
  return query.trim().toLowerCase().replace(/^@+/, "");
}

export function looksLikeHandle(query: string): boolean {
  return query.trim().startsWith("@");
}

export function searchPeople(query: string, _viewerId: UserId): ExplorePerson[] {
  const q = normalizeExploreQuery(query);
  if (!q) return [];
  const focus = resolveCatalogFocus(q);
  const scored: Array<ExplorePerson & { score: number }> = [];

  for (const user of repository.listUsers()) {
    const profile = repository.getProfile(user.id);
    if (!profile) continue;
    const score = peopleScore(user, profile, q, focus);
    if (score <= 0) continue;
    const reason = peopleReason(profile, user.id, q, focus);
    scored.push({
      userId: user.id,
      ...(reason ? { reason } : {}),
      score,
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, PEOPLE_LIMIT)
    .map(({ score: _score, ...hit }) => hit);
}

export function searchRooms(query: string, viewerId: UserId): ExploreRoom[] {
  const q = normalizeExploreQuery(query);
  if (!q) return [];
  const focus = resolveCatalogFocus(q);
  const scored: Array<ExploreRoom & { score: number }> = [];

  for (const user of repository.listUsers()) {
    const room = repository.getRoomByOwner(user.id);
    const profile = repository.getProfile(user.id);
    if (!room || !profile) continue;

    const relevance = roomRelevance(user, profile, room.theme.name, q, focus);
    if (relevance <= 0) continue;

    const compat =
      user.id === viewerId ? undefined : repository.getCollectionCompatibility(viewerId, user.id);
    const reason = roomReason(profile, user.id, q, focus, compat);
    scored.push({
      userId: user.id,
      roomId: room.id,
      identity: identityLine(profile, focus),
      ...(compat ? { matchScore: compat.score } : {}),
      ...(reason ? { reason } : {}),
      score: relevance * 10 + (compat?.score ?? 0) + (compat && compat.theyOwnYourWants.length > 0 ? 8 : 0),
    });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, ROOM_LIMIT)
    .map(({ score: _score, ...hit }) => hit);
}

export function searchPosts(query: string): ExplorePost[] {
  const q = normalizeExploreQuery(query);
  if (!q) return [];
  const focus = resolveCatalogFocus(q);
  const scored: Array<ExplorePost & { score: number }> = [];

  for (const post of repository.listAllPosts()) {
    const score = postScore(post, q, focus);
    if (score <= 0) continue;
    scored.push({ post, score });
  }

  return scored
    .sort((a, b) => b.score - a.score || b.post.createdAt.localeCompare(a.post.createdAt))
    .slice(0, POST_LIMIT)
    .map(({ score: _score, ...hit }) => hit);
}

export function searchCollectibles(query: string, viewerId: UserId): ExploreCollectible[] {
  const q = normalizeExploreQuery(query);
  if (!q) return [];

  return repository
    .searchCatalog(query)
    .slice(0, COLLECTIBLE_LIMIT)
    .map((template) => {
      const owners = repository.listOwners(template.id);
      const ownerId = owners.find((id) => id !== viewerId) ?? owners[0];
      return ownerId ? { template, ownerId } : { template };
    });
}

export function searchGroups(query: string): ExploreEntity[] {
  const q = normalizeExploreQuery(query);
  if (!q) return [];
  const focus = resolveCatalogFocus(q);
  const hits: Array<ExploreEntity & { score: number }> = [];

  for (const group of repository.listGroups()) {
    const direct = textMatch(q, group.name, group.nativeName);
    const related = focus.groupIds.has(group.id);
    if (!direct && !related) continue;
    const via = relatedLabel(group, q, focus);
    hits.push({
      kind: "group",
      id: group.id,
      title: group.name,
      subtitle: via ?? group.nativeName,
      accent: group.palette.primary,
      query: group.name,
      score: direct ? 80 : 40,
    });
  }

  for (const member of repository.listMembers()) {
    if (!textMatch(q, member.stageName, member.nativeName) && !focus.memberIds.has(member.id)) {
      continue;
    }
    const group = repository.getGroup(member.groupId);
    hits.push({
      kind: "member",
      id: member.id,
      title: member.stageName,
      subtitle: [group?.name, member.nativeName].filter(Boolean).join(" · ") || undefined,
      accent: member.color,
      query: member.stageName,
      score: textMatch(q, member.stageName) ? 90 : 50,
    });
  }

  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, ENTITY_LIMIT)
    .map(({ score: _score, ...hit }) => hit);
}

function resolveCatalogFocus(q: string): CatalogFocus {
  const focus: CatalogFocus = {
    groupIds: new Set(),
    memberIds: new Set(),
    eraIds: new Set(),
    releaseIds: new Set(),
    templateIds: new Set(),
    names: [],
  };

  for (const group of repository.listGroups()) {
    if (!textMatch(q, group.name, group.nativeName)) continue;
    focus.groupIds.add(group.id);
    focus.names.push(group.name);
  }

  for (const member of repository.listMembers()) {
    if (!textMatch(q, member.stageName, member.nativeName)) continue;
    focus.memberIds.add(member.id);
    focus.groupIds.add(member.groupId);
    focus.names.push(member.stageName);
  }

  for (const era of repository.listEras()) {
    if (!textMatch(q, era.name)) continue;
    focus.eraIds.add(era.id);
    focus.groupIds.add(era.groupId);
    focus.names.push(era.name);
  }

  for (const template of repository.listTemplates()) {
    const release = template.releaseId ? repository.getRelease(template.releaseId) : undefined;
    const era = template.eraId ? repository.getEra(template.eraId) : undefined;
    const member = template.memberId ? repository.getMember(template.memberId) : undefined;
    const group = repository.getGroup(template.groupId);
    if (
      !textMatch(q, template.name, release?.title, era?.name, member?.stageName, group?.name, group?.nativeName)
    ) {
      continue;
    }
    focus.templateIds.add(template.id);
    focus.groupIds.add(template.groupId);
    if (template.memberId && textMatch(q, member?.stageName, member?.nativeName)) {
      focus.memberIds.add(template.memberId);
    }
    if (template.eraId && textMatch(q, era?.name)) focus.eraIds.add(template.eraId);
    if (template.releaseId && textMatch(q, release?.title)) {
      focus.releaseIds.add(template.releaseId);
      if (release) focus.names.push(release.title);
    }
  }

  return focus;
}

function peopleScore(user: User, profile: Profile, q: string, focus: CatalogFocus): number {
  if (user.handle.toLowerCase() === q) return 100;
  if (user.handle.toLowerCase().startsWith(q)) return 86;
  if (user.displayName.toLowerCase().startsWith(q)) return 80;
  if (textMatch(q, user.handle, user.displayName)) return 70;

  let score = 0;
  if (profile.favoriteGroupIds.some((id) => focus.groupIds.has(id))) score = Math.max(score, 58);
  if (profile.biasMemberIds.some((id) => focus.memberIds.has(id))) score = Math.max(score, 56);
  if (profile.favoriteEraIds.some((id) => focus.eraIds.has(id))) score = Math.max(score, 48);
  if (repository.getCollectionIdentity(user.id).some((slice) => focus.groupIds.has(slice.groupId))) {
    score = Math.max(score, 52);
  }
  if (ownedFocusCount(user.id, focus) > 0) score = Math.max(score, 50);
  if (
    textMatch(
      q,
      profile.tagline,
      profile.bio,
      profile.location,
      profile.collectorType,
      ...(profile.collectorInterests ?? []),
    )
  ) {
    score = Math.max(score, 36);
  }
  return score;
}

function roomRelevance(
  user: User,
  profile: Profile,
  themeName: string,
  q: string,
  focus: CatalogFocus,
): number {
  let score = 0;
  if (textMatch(q, user.handle, user.displayName, themeName)) score = Math.max(score, 6);
  if (profile.favoriteGroupIds.some((id) => focus.groupIds.has(id))) score = Math.max(score, 8);
  if (profile.biasMemberIds.some((id) => focus.memberIds.has(id))) score = Math.max(score, 8);
  if (profile.favoriteEraIds.some((id) => focus.eraIds.has(id))) score = Math.max(score, 6);
  if (repository.getCollectionIdentity(user.id).some((slice) => focus.groupIds.has(slice.groupId))) {
    score = Math.max(score, 7);
  }
  const owned = ownedFocusCount(user.id, focus);
  if (owned > 0) score = Math.max(score, 7) + Math.min(owned, 4);
  if (
    textMatch(q, profile.tagline, profile.bio, profile.collectorType) &&
    (focus.groupIds.size > 0 || focus.memberIds.size > 0 || focus.eraIds.size > 0)
  ) {
    score = Math.max(score, 4);
  }
  return score;
}

function postScore(post: Post, q: string, focus: CatalogFocus): number {
  let score = 0;
  if (textMatch(q, post.body, post.location, post.kind)) score = Math.max(score, 40);
  const author = repository.getUser(post.authorId);
  if (author && textMatch(q, author.handle, author.displayName)) score = Math.max(score, 28);

  for (const userId of post.taggedUserIds ?? []) {
    const tagged = repository.getUser(userId);
    if (tagged && textMatch(q, tagged.handle, tagged.displayName)) score = Math.max(score, 34);
  }

  for (const id of [...post.templateIds, ...(post.taggedTemplateIds ?? [])]) {
    if (focus.templateIds.has(id)) {
      score = Math.max(score, 56);
      continue;
    }
    const template = repository.getTemplate(id);
    if (!template) continue;
    const group = repository.getGroup(template.groupId);
    const member = template.memberId ? repository.getMember(template.memberId) : undefined;
    const era = template.eraId ? repository.getEra(template.eraId) : undefined;
    const release = template.releaseId ? repository.getRelease(template.releaseId) : undefined;
    if (focus.groupIds.has(template.groupId) || (template.memberId && focus.memberIds.has(template.memberId))) {
      score = Math.max(score, 50);
    }
    if (textMatch(q, template.name, group?.name, member?.stageName, era?.name, release?.title)) {
      score = Math.max(score, 46);
    }
  }

  return score;
}

function peopleReason(profile: Profile, userId: UserId, q: string, focus: CatalogFocus): ExploreReason | undefined {
  return collectionReason(profile, userId, q, focus);
}

function roomReason(
  profile: Profile,
  userId: UserId,
  q: string,
  focus: CatalogFocus,
  compat?: CollectionCompatibility,
): ExploreReason | undefined {
  if (compat && compat.theyOwnYourWants.length > 0) return { kind: "wishlist" };
  return collectionReason(profile, userId, q, focus);
}

function collectionReason(
  profile: Profile,
  userId: UserId,
  q: string,
  focus: CatalogFocus,
): ExploreReason | undefined {
  const memberName = namedFocusMember(profile, userId, q, focus);
  if (memberName) return { kind: "collects", name: memberName };
  const groupName = namedFocusGroup(profile, userId, q, focus);
  if (groupName) return { kind: "collects", name: groupName };
  return undefined;
}

function namedFocusMember(profile: Profile, userId: UserId, q: string, _focus: CatalogFocus): string | undefined {
  const ids = new Set<string>([...profile.biasMemberIds, ...ownedMemberIds(userId)]);
  for (const id of ids) {
    const member = repository.getMember(id);
    if (member && textMatch(q, member.stageName, member.nativeName)) return member.stageName;
  }
  return undefined;
}

function namedFocusGroup(profile: Profile, userId: UserId, q: string, focus: CatalogFocus): string | undefined {
  const identity = repository.getCollectionIdentity(userId);
  const ids = [...profile.favoriteGroupIds, ...identity.map((slice) => slice.groupId)];
  for (const id of ids) {
    const group = repository.getGroup(id);
    if (!group) continue;
    if (textMatch(q, group.name, group.nativeName)) return group.name;
  }
  for (const id of ids) {
    const group = repository.getGroup(id);
    if (group && focus.groupIds.has(id)) return group.name;
  }
  return undefined;
}

function identityLine(profile: Profile, focus: CatalogFocus): string {
  const groups = profile.favoriteGroupIds
    .map((id) => repository.getGroup(id))
    .filter((group): group is Group => !!group);
  const biases = profile.biasMemberIds
    .map((id) => repository.getMember(id))
    .filter((member): member is Member => !!member);

  const group =
    groups.find((item) => focus.groupIds.has(item.id)) ??
    groups[0] ??
    firstIdentityGroup(profile.userId);
  const bias =
    biases.find((item) => focus.memberIds.has(item.id) || (group && item.groupId === group.id)) ??
    biases[0];

  return [group?.name, bias?.stageName].filter(Boolean).join(" · ");
}

function firstIdentityGroup(userId: UserId): Group | undefined {
  const slice = repository.getCollectionIdentity(userId)[0];
  return slice ? repository.getGroup(slice.groupId) : undefined;
}

function ownedFocusCount(userId: UserId, focus: CatalogFocus): number {
  let count = 0;
  for (const view of repository.listHoldingViews(userId)) {
    if (
      focus.templateIds.has(view.template.id) ||
      focus.groupIds.has(view.group.id) ||
      (view.member && focus.memberIds.has(view.member.id)) ||
      (view.era && focus.eraIds.has(view.era.id)) ||
      (view.release && focus.releaseIds.has(view.release.id))
    ) {
      count += 1;
    }
  }
  return count;
}

function ownedMemberIds(userId: UserId): string[] {
  const ids = new Set<string>();
  for (const view of repository.listHoldingViews(userId)) {
    if (view.member) ids.add(view.member.id);
  }
  return [...ids];
}

function relatedLabel(group: Group, q: string, focus: CatalogFocus): string | undefined {
  if (textMatch(q, group.name, group.nativeName)) return group.nativeName;
  for (const era of repository.listEras(group.id)) {
    if (focus.eraIds.has(era.id) || textMatch(q, era.name)) return era.name;
  }
  return group.nativeName;
}

function textMatch(q: string, ...values: Array<string | undefined>): boolean {
  return values.some((value) => !!value && value.toLowerCase().includes(q));
}
