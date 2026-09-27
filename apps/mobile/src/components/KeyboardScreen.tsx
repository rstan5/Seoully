import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from "react-native";

export function KeyboardScreen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[{ flex: 1 }, style]}>
    {children}
  </KeyboardAvoidingView>;
}
