/** Binder is a photocard storage view, not a placement-only zone. */
export function isBinderEligible(holding: { template: { kind: string } }): boolean {
  return holding.template.kind === "photocard";
}

/** Ownership is independent of Room placement. Any owned holding is Room-eligible. */
export function isRoomEligible(holding: { id: string }): boolean {
  return Boolean(holding.id);
}

export function holdingExistsWithoutPhoto(holding: { id: string; personalMediaUrl?: string }): boolean {
  return Boolean(holding.id) && !holding.personalMediaUrl;
}

export function representationUsesPersonalImage(holding: { personalMediaUrl?: string }): boolean {
  return Boolean(holding.personalMediaUrl);
}

export function catalogReferenceConsentDefault(): boolean {
  return false;
}

export function shouldShareCatalogReference(input: {
  consent: boolean;
  isNewTemplate: boolean;
  hasPersonalMedia: boolean;
}): boolean {
  return input.consent === true && input.isNewTemplate && input.hasPersonalMedia;
}

export function profileCollectedCount(holdings: { id: string }[]): number {
  return holdings.length;
}

export const MANUAL_CONTRIBUTION_KEYS = ["name", "kind", "groupName", "memberName", "releaseName", "descriptor"] as const;
