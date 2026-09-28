import { Image, View } from "react-native";
import { avatarPalette, sizes } from "../theme";

export function SeoullyAvatar({
  name,
  size = sizes.avatarSm,
  imageUrl,
}: {
  name: string;
  size?: number;
  imageUrl?: string;
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
    >
      {imageUrl ? (
        <Image accessibilityIgnoresInvertColors source={{ uri: imageUrl }} style={{ height: size, width: size }} />
      ) : null}
    </View>
  );
}
