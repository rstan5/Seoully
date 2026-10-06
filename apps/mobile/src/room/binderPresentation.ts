import { contrastRatio } from "../ui/profileContrast";
import { faces } from "../theme";
import { type Locale } from "../i18n";
export const BINDER_DISPLAY_TILT = 68 * Math.PI / 180;
// Closed reading leaves occupy local +Z; center them before changing orientation.
export const BINDER_CLOSED_CENTER_Z = 0.55;
// Cover half-height and closed hinge/cover half-thickness; bottom edge meets lip at -0.63.
export const BINDER_DISPLAY_CENTER_Y = -0.63 + 0.66*Math.sin(BINDER_DISPLAY_TILT) + 0.115*Math.cos(BINDER_DISPLAY_TILT);
export const BINDER_LIFT_END = 0.22;
export function binderLabel(owner: string, locale: Locale) {
  const name = Array.from(owner.trim().replace(/\s+/g," "));
  const bounded = name.length > 28 ? name.slice(0,27).join("")+"…" : name.join("");
  const latin = /^[\p{Script=Latin}\p{Number}\p{Punctuation}\p{Separator}]*$/u.test(bounded);
  return { name: bounded, fontFamily: latin ? "DancingScript" : faces[locale === "en" ? "ko" : locale].bold,
    size: 54, width: name.length <= 10 ? 0.66 : 0.94 };
}
export function binderLabelInk(cover: string) {
  if (contrastRatio("#211d28",cover) >= 4.5) return "#211d28";
  if (contrastRatio("#fffaf2",cover) >= 4.5) return "#fffaf2";
  return contrastRatio("#000000",cover) >= contrastRatio("#ffffff",cover) ? "#000000" : "#ffffff";
}
/** One reversible clock: no mesh handoff, stops, or independently reset phases. */
export function binderTravel(progress: number, _reducedMotion: boolean) {
  const p=Math.max(0,Math.min(1,progress));
  const ease=p*p*p*(p*(p*6-15)+10);
  // Clearance leads reorientation; both functions have continuous endpoint velocity.
  const lift=0.20*Math.sin(Math.PI*p)**2;
  const turn=Math.max(0,Math.min(1,(p-0.10)/0.90));
  const orientation=turn*turn*turn*(turn*(turn*6-15)+10);
  const opening=Math.max(0,Math.min(1,(p-0.36)/0.64));
  const spread=opening*opening*(3-2*opening);
  return { ease, lift, orientation, spread, camera: Math.max(0,(p-0.08)/0.92), reading:p>0 };
}
