/**
 * Conservative catalog matching.
 *
 * Prefer a duplicate over a silent merge. Two items are the same only when
 * the identifying fields we have actually agree. Close-but-not-sure stays
 * in the user's hands.
 */

import type {
  CollectibleKind,
  CollectibleTemplate,
  EraId,
  GroupId,
  MemberId,
  ReleaseId,
  ReleaseVersionId,
} from "./types";

export interface CatalogDraft {
  name: string;
  kind: CollectibleKind;
  groupId: GroupId;
  memberId?: MemberId;
  eraId?: EraId;
  releaseId?: ReleaseId;
  releaseVersionId?: ReleaseVersionId;
  imageUrl?: string;
}

export type CatalogMatchConfidence = "exact" | "plausible";

export interface CatalogMatch {
  template: CollectibleTemplate;
  confidence: CatalogMatchConfidence;
}

export function normalizeCatalogName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[—–−]/g, "-")
    .replace(/[^a-z0-9가-힣\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isExactCatalogMatch(draft: CatalogDraft, template: CollectibleTemplate): boolean {
  return (
    template.kind === draft.kind &&
    template.groupId === draft.groupId &&
    normalizeCatalogName(template.name) === normalizeCatalogName(draft.name) &&
    optionalEqual(template.memberId, draft.memberId) &&
    optionalEqual(template.eraId, draft.eraId) &&
    optionalEqual(template.releaseId, draft.releaseId) &&
    optionalEqual(template.releaseVersionId, draft.releaseVersionId)
  );
}

export function matchCatalog(draft: CatalogDraft, templates: CollectibleTemplate[]): CatalogMatch[] {
  const name = normalizeCatalogName(draft.name);
  if (!name || !draft.groupId) return [];

  const exact: CatalogMatch[] = [];
  const plausible: CatalogMatch[] = [];

  for (const template of templates) {
    if (isExactCatalogMatch(draft, template)) {
      exact.push({ template, confidence: "exact" });
      continue;
    }
    if (isPlausibleCatalogMatch(draft, template)) {
      plausible.push({ template, confidence: "plausible" });
    }
  }

  return [...exact, ...plausible].slice(0, 6);
}

function isPlausibleCatalogMatch(draft: CatalogDraft, template: CollectibleTemplate): boolean {
  if (template.groupId !== draft.groupId) return false;
  if (template.kind !== draft.kind) return false;
  if (conflicts(draft.memberId, template.memberId)) return false;
  if (conflicts(draft.releaseVersionId, template.releaseVersionId)) return false;

  const sameName = normalizeCatalogName(template.name) === normalizeCatalogName(draft.name);
  const sameMember = !!draft.memberId && draft.memberId === template.memberId;
  const sameRelease = !!draft.releaseId && draft.releaseId === template.releaseId;
  const sameEra = !!draft.eraId && draft.eraId === template.eraId;

  // Same title, nothing conflicting: likely the same item, but optionals
  // may be missing. Never auto-merge — the user still confirms.
  if (sameName) return true;
  if (sameMember && (sameRelease || sameEra)) return true;
  return false;
}

function optionalEqual<T>(a?: T, b?: T): boolean {
  return (a ?? undefined) === (b ?? undefined);
}

function conflicts<T>(a?: T, b?: T): boolean {
  return !!a && !!b && a !== b;
}
