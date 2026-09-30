import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme";

/** Social screens: top inset only. Header chrome sits inside this inset, matching web `.s-top`. */
export function SeoullyScreen({
  children,
  style,
  edges = ["top"],
  backgroundColor = colors.canvas,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ("top" | "right" | "bottom" | "left")[];
  backgroundColor?: string;
}) {
  return (
    <SafeAreaView edges={edges} style={[styles.safe, { backgroundColor }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function SeoullyBody({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.body, style]}>{children}</View>;
}

const styles = {
  safe: { backgroundColor: colors.canvas, flex: 1, overflow: "visible" as const },
  body: { flex: 1 },
};
