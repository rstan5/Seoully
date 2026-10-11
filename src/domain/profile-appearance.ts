import { z } from "zod";
import { ACCENT_PRESETS, BACKGROUND_PRESETS } from "./profile-theme";
import type { ProfileAccentPreset, ProfileBackgroundPreset, ProfileThemeChoice } from "./types";

// Optional Custom fields and legacy tint retain the existing resolver defaults.
// Only preset IDs are accepted; arbitrary CSS/colors/URLs are never persisted.
const backgroundIds = BACKGROUND_PRESETS.map(({ id }) => id) as [ProfileBackgroundPreset, ...ProfileBackgroundPreset[]];
const accentIds = ACCENT_PRESETS.map(({ id }) => id) as [ProfileAccentPreset, ...ProfileAccentPreset[]];
export const profileAppearanceSchema: z.ZodType<ProfileThemeChoice> = z.object({
  mode: z.enum(["default", "custom", "room-sync"]),
  background: z.enum(backgroundIds).optional(),
  primary: z.enum(accentIds).optional(),
  secondary: z.enum(accentIds).optional(),
  tint: z.enum(accentIds).optional(),
}).strict();
