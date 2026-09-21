import "server-only";

import { z } from "zod";
import { getCollectionPairSnapshot, type PairPerson } from "@/server/dal/collection-graph-pair";

const inputSchema = z.object({ targetUserId: z.string().uuid() }).strict();
const MAX_REASONS = 24;

export type EvidenceStrength = "low" | "medium" | "high";
export type CompatibilityReasonCode = "SHARED_TEMPLATE" | "SHARED_GROUP" | "SHARED_MEMBER" | "SHARED_RELEASE" | "SHARED_FAVORITE_GROUP" | "SHARED_BIAS";

export interface CompatibilityReason { code: CompatibilityReasonCode; ids: string[]; count: number; }

export interface CompatibilityResult {
  userId: string;
  targetUserId: string;
  score: number;
  evidenceStrength: EvidenceStrength;
  visibilityLimited: boolean;
  componentScores: { templates: number; groups: number; members: number; releases: number; favoriteGroups: number; biasMembers: number };
  sharedTemplates: string[];
  sharedGroups: string[];
  sharedMembers: string[];
  sharedReleases: string[];
  reasons: CompatibilityReason[];
}

const overlap = (a: Set<string>, b: Set<string>) => {
  if (!a.size || !b.size) return { ratio: 0, ids: [] as string[] };
  const ids = [...a].filter((id) => b.has(id)).sort();
  return { ratio: ids.length / Math.min(a.size, b.size), ids };
};

const setOf = (values: string[]) => new Set(values);
const owned = (person: PairPerson) => person.holdings.map((holding) => holding.template_id);
const groups = (person: PairPerson) => person.holdings.map((holding) => holding.group_id);
const members = (person: PairPerson) => person.holdings.flatMap((holding) => holding.member_id ? [holding.member_id] : []);
const releases = (person: PairPerson) => person.holdings.flatMap((holding) => holding.release_id ? [holding.release_id] : []);

export async function getCollectorCompatibility(input: unknown): Promise<CompatibilityResult> {
  const { targetUserId } = inputSchema.parse(input);
  const snapshot = await getCollectionPairSnapshot(targetUserId);
  return computeCompatibilityPeople(snapshot.actor!, snapshot.target!, targetUserId, snapshot.target_collection_public === false);
}

export function computeCompatibilityPeople(a: PairPerson, b: PairPerson, targetUserId: string, visibilityLimited = false): CompatibilityResult {
  const templateOverlap = overlap(setOf(owned(a)), setOf(owned(b)));
  const groupOverlap = overlap(setOf(groups(a)), setOf(groups(b)));
  const memberOverlap = overlap(setOf(members(a)), setOf(members(b)));
  const releaseOverlap = overlap(setOf(releases(a)), setOf(releases(b)));
  const favoriteGroupOverlap = overlap(setOf(a.favorite_group_ids), setOf(b.favorite_group_ids));
  const biasOverlap = overlap(setOf(a.bias_member_ids), setOf(b.bias_member_ids));

  // Symmetric, bounded heuristic. Overlap coefficient measures how much of
  // the narrower collection is shared, avoiding raw collection-size bias.
  const weights = { templates: 0.4, groups: 0.25, members: 0.15, releases: 0.1, favoriteGroups: 0.05, biasMembers: 0.05 } as const;
  const components = {
    templates: templateOverlap.ratio,
    groups: groupOverlap.ratio,
    members: memberOverlap.ratio,
    releases: releaseOverlap.ratio,
    favoriteGroups: favoriteGroupOverlap.ratio,
    biasMembers: biasOverlap.ratio,
  };
  const score = Math.round((components.templates * weights.templates + components.groups * weights.groups + components.members * weights.members + components.releases * weights.releases + components.favoriteGroups * weights.favoriteGroups + components.biasMembers * weights.biasMembers) * 100);
  const minimumEvidence = Math.min(new Set(owned(a)).size, new Set(owned(b)).size);
  const evidenceStrength: EvidenceStrength = minimumEvidence >= 10 ? "high" : minimumEvidence >= 3 ? "medium" : "low";
  const reasons: CompatibilityReason[] = ([
    { code: "SHARED_TEMPLATE", ids: templateOverlap.ids.slice(0, 8), count: templateOverlap.ids.length },
    { code: "SHARED_GROUP", ids: groupOverlap.ids.slice(0, 8), count: groupOverlap.ids.length },
    { code: "SHARED_MEMBER", ids: memberOverlap.ids.slice(0, 8), count: memberOverlap.ids.length },
    { code: "SHARED_RELEASE", ids: releaseOverlap.ids.slice(0, 8), count: releaseOverlap.ids.length },
    { code: "SHARED_FAVORITE_GROUP", ids: favoriteGroupOverlap.ids.slice(0, 8), count: favoriteGroupOverlap.ids.length },
    { code: "SHARED_BIAS", ids: biasOverlap.ids.slice(0, 8), count: biasOverlap.ids.length },
  ] as CompatibilityReason[]).filter((reason) => reason.count > 0).slice(0, MAX_REASONS);
  return {
    userId: a.user_id,
    targetUserId,
    score,
    evidenceStrength,
    visibilityLimited,
    componentScores: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value * 100)])) as CompatibilityResult["componentScores"],
    sharedTemplates: templateOverlap.ids.slice(0, 50),
    sharedGroups: groupOverlap.ids.slice(0, 50),
    sharedMembers: memberOverlap.ids.slice(0, 50),
    sharedReleases: releaseOverlap.ids.slice(0, 50),
    reasons,
  };
}
