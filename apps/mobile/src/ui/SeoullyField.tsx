import { TextInput, View, type TextInputProps } from "react-native";
import { colors } from "../theme";
import { SeoullyText } from "./SeoullyText";

export function SeoullyField({
  label,
  appearance = "line",
  multiline = false,
  ...props
}: TextInputProps & {
  label: string;
  appearance?: "line" | "mist";
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: appearance === "mist" ? 12 : 16 }}>
      <SeoullyText variant="caption" color={colors.muted} style={{ fontSize: 12, letterSpacing: 0.2, marginBottom: 6 }}>
        {label}
      </SeoullyText>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[
          {
            color: colors.ink,
            fontSize: appearance === "mist" ? 15 : 16,
            minHeight: multiline ? (appearance === "mist" ? 96 : 88) : 44,
            paddingHorizontal: appearance === "mist" ? 12 : 0,
            paddingVertical: appearance === "mist" ? 10 : 8,
            textAlignVertical: multiline ? "top" : "center",
          },
          appearance === "mist"
            ? {
                backgroundColor: colors.mist,
                borderColor: colors.border,
                borderRadius: 12,
                borderWidth: 1,
              }
            : {
                backgroundColor: "transparent",
                borderBottomColor: colors.border,
                borderBottomWidth: 1,
              },
          props.style,
        ]}
      />
    </View>
  );
}
