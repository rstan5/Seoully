import { Text, StyleSheet, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { withInlineHearts } from "./InlineHeart";
import { useLocale } from "../locale";
import { CONTROL_LABEL_OPTICAL_Y, colors, faces, type } from "../theme";
import { useProfileIdentity } from "./ProfileIdentity";

export type SeoullyTextVariant = keyof typeof type;

const variantColor: Record<SeoullyTextVariant, string> = {
  display: colors.ink,
  title: colors.ink,
  section: colors.plum,
  body: colors.ink,
  secondary: colors.muted,
  caption: colors.muted,
  button: colors.ink,
  metadata: colors.muted,
  handle: colors.ink,
};

export function SeoullyText({
  variant = "body",
  color,
  control,
  style,
  children,
  ...props
}: TextProps & { variant?: SeoullyTextVariant; color?: string; control?: boolean; style?: StyleProp<TextStyle> }) {
  const { locale } = useLocale();
  const identity = useProfileIdentity();
  const spec = type[variant];
  const inherited = identity
    ? (variant === "section"
      ? identity.primaryDeep
      : variant === "secondary" || variant === "caption" || variant === "metadata"
        ? identity.mute
        : identity.ink)
    : variantColor[variant];
  const optical = locale === "en" && (control || variant === "button");
  const resolved = StyleSheet.flatten([{ fontFamily: faces[locale][spec.face] }, style]);
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: faces[locale][spec.face],
          fontSize: spec.fontSize,
          includeFontPadding: false,
          letterSpacing: "letterSpacing" in spec ? spec.letterSpacing : 0,
          lineHeight: spec.lineHeight,
          ...(optical ? { transform: [{ translateY: CONTROL_LABEL_OPTICAL_Y }] } : null),
        },
        { color: color ?? inherited },
        style,
      ]}
    >{withInlineHearts(children, resolved.fontFamily ?? faces[locale][spec.face], resolved.fontWeight)}</Text>
  );
}
