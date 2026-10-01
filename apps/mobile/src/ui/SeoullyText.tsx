import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { useLocale } from "../locale";
import { colors, faces, type } from "../theme";
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
  style,
  ...props
}: TextProps & { variant?: SeoullyTextVariant; color?: string; style?: StyleProp<TextStyle> }) {
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
        },
        { color: color ?? inherited },
        style,
      ]}
    />
  );
}
