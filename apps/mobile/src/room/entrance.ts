/** Transient Room entrance copy and contrast. Never render internal collector IDs. */

export function isInternalCollectorId(value: string) {
  const trimmed = value.trim();
  return /^u-[a-z0-9_-]+$/i.test(trimmed);
}

export function roomEntranceCopy(input: {
  mode: "own" | "public";
  displayName?: string;
  fallbackName: string;
  ownLabel: string;
  visitorLabel: string;
}) {
  if (input.mode === "own") return input.ownLabel;
  const name = input.displayName?.trim() ?? "";
  const safe = name && !isInternalCollectorId(name) ? name : input.fallbackName;
  return input.visitorLabel.replace("{name}", safe);
}

export function entranceForeground(backgroundHex: string) {
  const dark = hexLuminance(backgroundHex) < 0.45;
  return {
    color: dark ? "#f7f1f4" : "#2c2e4c",
    shadow: dark ? "rgba(8,6,10,0.55)" : "rgba(255,255,255,0.35)",
  };
}

function hexLuminance(hex: string) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return 0;
  const n = Number.parseInt(raw, 16);
  if (Number.isNaN(n)) return 0;
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
