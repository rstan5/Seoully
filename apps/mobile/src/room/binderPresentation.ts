import { contrastRatio } from "../ui/profileContrast";
import { faces } from "../theme";
import { copy, type Locale } from "../i18n";
export const BINDER_DISPLAY_TILT = 0.22;
export const BINDER_DISPLAY_CENTER_Y = -0.515 + (0.02 + 0.076) * Math.cos(BINDER_DISPLAY_TILT) + 0.002;
export const BINDER_LIFT_END = 0.22;
export function binderLabel(owner: string, locale: Locale) {
  const name = Array.from(owner.trim().replace(/\s+/g," "));
  const bounded = name.length > 22 ? name.slice(0,21).join("")+"…" : name.join("");
  const t = copy(locale);
  return { name: bounded ? t.roomBinderOwner.replace("{name}",bounded) : "", title:t.roomBinderLabel, fontFamily:faces[locale].bold, size: name.length > 14 ? 22 : 28 };
}
export function binderLabelInk(cover: string) {
  if (contrastRatio("#211d28",cover) >= 4.5) return "#211d28";
  if (contrastRatio("#fffaf2",cover) >= 4.5) return "#fffaf2";
  return contrastRatio("#000000",cover) >= contrastRatio("#ffffff",cover) ? "#000000" : "#ffffff";
}
/** Reversible lift-first path; stand always stays at the authored Desk transform. */
export function binderTravel(progress: number, reducedMotion: boolean) {
  const p=Math.max(0,Math.min(1,progress));
  const travel=Math.max(0,(p-BINDER_LIFT_END)/(1-BINDER_LIFT_END));
  const ease=travel*travel*(3-2*travel);
  return { ease, lift:reducedMotion?0:0.18*Math.sin(Math.PI*Math.min(1,p/BINDER_LIFT_END/2)), reading:p>=BINDER_LIFT_END };
}
