import type { UserId } from "@/domain/types";

export type ProfilePresetSection = "collection" | "wishlist";

let preset: { userId: UserId; section: ProfilePresetSection } | null = null;

export function queueProfilePreset(userId: UserId, section: ProfilePresetSection) {
  preset = { userId, section };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seoully:assistant-profile", { detail: preset }));
  }
}

export function getProfilePreset() {
  return preset;
}

export function clearProfilePreset() {
  preset = null;
}
