export type SearchPresetDestination = "people" | "rooms" | "collectibles";

let preset: { query: string; destination: SearchPresetDestination } | null = null;

export function queueSearchPreset(query: string, destination: SearchPresetDestination) {
  preset = { query, destination };
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("seoully:assistant-search", { detail: preset }));
  }
}

export function getSearchPreset() {
  return preset;
}

export function clearSearchPreset() {
  preset = null;
}
