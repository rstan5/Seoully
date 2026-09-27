import type { NativeHolding } from "../api";

export type NativeRepresentationKind =
  | "photocard"
  | "poster"
  | "album"
  | "vinyl"
  | "book"
  | "lightstick"
  | "plushie"
  | "figure"
  | "apparel"
  | "ticket"
  | "disc-case"
  | "memorabilia"
  | "generic";

export type NativeDigitalRepresentation = {
  geometry: NativeRepresentationKind;
  imageUrl?: string;
  source: "personal-media" | "type-fallback" | "generic-fallback";
  color: string;
  accent: string;
};

const KIND_COLORS: Record<NativeRepresentationKind, [string, string]> = {
  photocard: ["#f3d6dc", "#8a5b66"],
  poster: ["#ead0c4", "#7a534c"],
  album: ["#c9a27a", "#5c3d2e"],
  vinyl: ["#2b2428", "#c4b07a"],
  book: ["#8fa3c4", "#3d4a62"],
  lightstick: ["#d9b3b8", "#ff8fb8"],
  plushie: ["#b58aa8", "#6b3f5a"],
  figure: ["#d6c8b4", "#6a5a48"],
  apparel: ["#7d9b7a", "#355038"],
  ticket: ["#f2e4c8", "#8a6a3a"],
  "disc-case": ["#9aa3b8", "#2f3648"],
  memorabilia: ["#c4b07a", "#5c4a2e"],
  generic: ["#d4c2b6", "#6b5348"],
};

export function representationForHolding(holding: NativeHolding): NativeDigitalRepresentation {
  const geometry = representationKindForHolding(holding);
  const [base, accent] = KIND_COLORS[geometry];
  const imageUrl = holding.personalMediaUrl;
  return {
    geometry,
    color: mixSeed(base, holding.templateId),
    accent: mixSeed(accent, holding.template.id),
    ...(imageUrl ? { imageUrl } : {}),
    source: imageUrl ? "personal-media" : geometry === "generic" ? "generic-fallback" : "type-fallback",
  };
}

export function representationKindForHolding(holding: NativeHolding): NativeRepresentationKind {
  const kind = holding.template.kind;
  if (kind === "photocard") return "photocard";
  if (kind === "poster") return "poster";
  if (kind === "album") return "album";
  if (kind === "vinyl") return "vinyl";
  if (kind === "book") return "book";
  if (kind === "lightstick") return "lightstick";
  if (kind === "plushie") return "plushie";
  if (kind === "figure") return "figure";
  if (kind === "apparel") return "apparel";
  if (kind === "memorabilia") return memorabiliaKind(holding.template.name);
  return "generic";
}

export function extentsForGeometry(geometry: NativeRepresentationKind) {
  switch (geometry) {
    case "photocard": return { x: 0.55, y: 0.85, z: 0.018 };
    case "poster": return { x: 1.05, y: 1.48, z: 0.02 };
    case "album": return { x: 0.16, y: 0.88, z: 0.88 };
    case "vinyl": return { x: 0.96, y: 0.96, z: 0.07 };
    case "book": return { x: 0.14, y: 0.82, z: 0.64 };
    case "lightstick": return { x: 0.22, y: 0.78, z: 0.22 };
    case "plushie": return { x: 0.52, y: 0.62, z: 0.42 };
    case "figure": return { x: 0.32, y: 0.78, z: 0.16 };
    case "apparel": return { x: 0.72, y: 0.12, z: 0.52 };
    case "ticket": return { x: 0.78, y: 0.28, z: 0.012 };
    case "disc-case": return { x: 0.1, y: 0.68, z: 0.58 };
    case "memorabilia": return { x: 0.4, y: 0.46, z: 0.4 };
    default: return { x: 0.48, y: 0.48, z: 0.48 };
  }
}

function memorabiliaKind(name: string): NativeRepresentationKind {
  if (/ticket|stub|pass|lanyard/i.test(name)) return "ticket";
  if (/cd|dvd|blu-?ray|jewel|disc/i.test(name)) return "disc-case";
  if (/magazine|zine/i.test(name)) return "book";
  return "memorabilia";
}

function mixSeed(hex: string, seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const shift = (hash % 24) - 12;
  const value = Number.parseInt(hex.slice(1), 16);
  const channel = (offset: number) => Math.min(255, Math.max(40, ((value >> offset) & 255) + shift));
  return `#${[16, 8, 0].map((offset) => channel(offset).toString(16).padStart(2, "0")).join("")}`;
}
