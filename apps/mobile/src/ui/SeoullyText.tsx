import { Text, type StyleProp, type TextProps, type TextStyle } from "react-native";
import { colors, type } from "../theme";

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
  return <Text {...props} style={[type[variant], { color: color ?? variantColor[variant] }, style]} />;
}
