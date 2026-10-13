import { Text, type TextStyle } from "react-native";
import { Fragment, type ReactNode } from "react";

/** Glyph outlines, not offsets: ink matches the source font's uppercase H.
 * Each tiny font contains only U+2661 and retains the surrounding line metrics.
 * Keep fontSize/lineHeight/allowFontScaling inherited from the enclosing Text.
 */
export function inlineHeartFont(fontFamily: string, fontWeight?: TextStyle["fontWeight"]) {
  const family = fontFamily.startsWith("NotoSansKR") ? "NotoSansKR" : "Baloo2";
  const explicitWeight = Number(fontWeight);
  const weight = explicitWeight >= 700 || fontWeight === "bold" || fontFamily.includes("700") ? 700
    : explicitWeight >= 600 || fontFamily.includes("600") ? 600 : 400;
  return `SeoullyHeart${family}${weight}`;
}

export function InlineHeart({ fontFamily, fontWeight }: { fontFamily: string; fontWeight?: TextStyle["fontWeight"] }) {
  return <Text style={{ fontFamily: inlineHeartFont(fontFamily, fontWeight), fontWeight: "normal" }}>♡</Text>;
}

/** Transform literal/localized text only; nested components retain their own
 * typography, opacity (typewriter reservation), accessibility and handlers. */
export function withInlineHearts(children: ReactNode, fontFamily: string, fontWeight?: TextStyle["fontWeight"]): ReactNode {
  if (Array.isArray(children)) return children.map((child, index) => <Fragment key={index}>{withInlineHearts(child, fontFamily, fontWeight)}</Fragment>);
  if (typeof children !== "string" || !children.includes("♡")) return children;
  return children.split("♡").flatMap((part, index) => index === 0 ? [part] : [<InlineHeart key={`heart-${index}`} fontFamily={fontFamily} fontWeight={fontWeight} />, part]);
}
