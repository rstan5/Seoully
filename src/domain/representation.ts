import type { CollectibleKind, CollectibleTemplate, Holding, HoldingView } from "@/domain/types";

export type RepresentationGeometry = "photocard" | "poster" | "album" | "object" | "generic";

export interface DigitalRepresentation {
  geometry: RepresentationGeometry;
  imageUrl?: string;
  source: "personal-media" | "canonical-media" | "type-fallback" | "generic-fallback";
}

/** Deterministic representation boundary for the existing Room vocabulary. */
export function resolveDigitalRepresentation(input: {
  holding: Holding;
  template: CollectibleTemplate;
}): DigitalRepresentation {
  const imageUrl = input.holding.personalMediaUrl;
  const geometry = geometryForKind(input.template.kind);
  return {
    geometry,
    ...(imageUrl ? { imageUrl } : {}),
    source: imageUrl ? "personal-media" : geometry === "generic" ? "generic-fallback" : "type-fallback",
  };
}

export function representationForView(view: HoldingView): DigitalRepresentation {
  return resolveDigitalRepresentation({ holding: view.holding, template: view.template });
}

function geometryForKind(kind: CollectibleKind): RepresentationGeometry {
  switch (kind) {
    case "photocard": return "photocard";
    case "poster": return "poster";
    case "album":
    case "vinyl":
    case "book": return "album";
    case "lightstick":
    case "plushie":
    case "figure":
    case "apparel":
    case "memorabilia": return "object";
    default: return "generic";
  }
}
