import { View } from "react-native";
import { avatarPalette, sizes } from "../theme";

export function SeoullyAvatar({
  name,
  size = sizes.avatarSm,
}: {
  name: string;
  size?: number;
}) {
  const seed = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (
    <View
      accessibilityIgnoresInvertColors
      style={{
        backgroundColor: avatarPalette[seed % avatarPalette.length],
        borderRadius: size / 2,
        height: size,
        overflow: "hidden",
        width: size,
      }}
    />
  );
}
