import type { SocialCapabilities } from "./capabilities";

export function publicCollectedCount(capabilities: SocialCapabilities, holdingCount: number): number | null {
  if (!capabilities.publicCollectionRows) return null;
  return holdingCount;
}

export function liveShareResult(): { delivered: false } {
  return { delivered: false };
}

export function liveRepostResult(): { persisted: false } {
  return { persisted: false };
}

export function liveSaveResult(): { persisted: false } {
  return { persisted: false };
}

export function shareStatusCopyKey(delivered: boolean): "sendToDelivered" | "sendToBlocked" {
  return delivered ? "sendToDelivered" : "sendToBlocked";
}
