import { GROUPS, MEMBER_BY_ID, TEMPLATE_BY_ID } from "./fixtures/catalog";
import type {
  CollectibleKind,
  CollectibleTemplate,
  IdentificationCandidate,
  IdentificationInput,
  TemplateId,
} from "./types";

/**
 * Identification boundary.
 *
 * Callers ask `identify(input)` and receive ranked catalog candidates.
 * Whether those came from a fixture heuristic, a vision model, or a future
 * proprietary matcher is an implementation detail of this interface.
 */
export interface CollectibleIdentificationService {
  identify(input: IdentificationInput): Promise<IdentificationCandidate[]>;
}

const FIXTURE_PRIORITY: TemplateId[] = [
  "set-ate-pc-4" as TemplateId,
  "set-lovedive-pc-4" as TemplateId,
  "set-ate-pc-12" as TemplateId,
];

export class FixtureIdentificationService implements CollectibleIdentificationService {
  async identify(input: IdentificationInput): Promise<IdentificationCandidate[]> {
    await pause(280);
    const haystack = `${input.filename ?? ""} ${input.image?.url.slice(0, 40) ?? ""}`.toLowerCase();
    const favorites = new Set((input.favoriteGroupIds ?? []).map(String));

    const scored = [...TEMPLATE_BY_ID.values()]
      .filter((t) => t.kind === "photocard" || t.kind === "album")
      .map((template) => ({ template, score: scoreTemplate(template, haystack, favorites) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score);

    const picks = scored.slice(0, 3);
    if (picks.length === 0) {
      const fallback = FIXTURE_PRIORITY.map((id) => TEMPLATE_BY_ID.get(id)).filter(
        (t): t is CollectibleTemplate => t !== undefined,
      );
      return fallback.slice(0, 2).map((template, i) => toCandidate(template, i === 0 ? 0.62 : 0.41, "Closest catalog match"));
    }

    return picks.map((row, i) =>
      toCandidate(row.template, Math.min(0.94, 0.54 + row.score * 0.12 - i * 0.08), reasonFor(row.template, haystack)),
    );
  }
}

function scoreTemplate(
  template: CollectibleTemplate,
  haystack: string,
  favorites: Set<string>,
): number {
  let score = 0;
  const group = GROUPS.find((g) => g.id === template.groupId);
  const member = template.memberId ? MEMBER_BY_ID.get(template.memberId) : undefined;
  if (group && haystack.includes(group.name.toLowerCase())) score += 4;
  if (member && haystack.includes(member.stageName.toLowerCase())) score += 5;
  if (haystack.includes(template.name.toLowerCase().split("—")[0]?.trim().toLowerCase() ?? "")) score += 2;
  if (favorites.has(template.groupId)) score += 2;
  if (FIXTURE_PRIORITY.includes(template.id)) score += 1;
  if (template.kind === "photocard") score += 0.4;
  return score;
}

function reasonFor(template: CollectibleTemplate, haystack: string): string {
  const member = template.memberId ? MEMBER_BY_ID.get(template.memberId) : undefined;
  if (member && haystack.includes(member.stageName.toLowerCase())) {
    return `Looks like ${member.stageName}`;
  }
  const group = GROUPS.find((g) => g.id === template.groupId);
  if (group && haystack.includes(group.name.toLowerCase())) {
    return `Matches ${group.name}`;
  }
  return "Catalog match from your photo";
}

function toCandidate(
  template: CollectibleTemplate,
  confidence: number,
  reason: string,
): IdentificationCandidate {
  return {
    templateId: template.id,
    confidence,
    groupId: template.groupId,
    ...(template.memberId ? { memberId: template.memberId } : {}),
    ...(template.eraId ? { eraId: template.eraId } : {}),
    ...(template.releaseId ? { releaseId: template.releaseId } : {}),
    ...(template.releaseVersionId ? { releaseVersionId: template.releaseVersionId } : {}),
    kind: template.kind as CollectibleKind,
    reason,
  };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const identification: CollectibleIdentificationService = new FixtureIdentificationService();
