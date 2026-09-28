import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

type IconProps = { color: string; filled?: boolean; size?: number };

function Frame({ size = 24, children }: { size?: number; children: ReactNode }) {
  return <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>{children}</View>;
}

function Stroke({ style, color }: { style: StyleProp<ViewStyle>; color: string }) {
  return <View style={[{ borderColor: color, backgroundColor: "transparent" }, style]} />;
}

export function IconHome({ color, filled = false, size = 24 }: IconProps) {
  const w = size * 0.62;
  return (
    <Frame size={size}>
      <View style={{
        width: 0,
        height: 0,
        borderLeftWidth: w / 2,
        borderRightWidth: w / 2,
        borderBottomWidth: size * 0.28,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderBottomColor: color,
        marginBottom: -1,
      }} />
      <View style={{
        width: w * 0.82,
        height: size * 0.42,
        borderWidth: filled ? 0 : 1.7,
        borderColor: color,
        backgroundColor: filled ? color : "transparent",
        borderBottomLeftRadius: 2,
        borderBottomRightRadius: 2,
      }} />
    </Frame>
  );
}

export function IconSearch({ color, size = 24 }: IconProps) {
  const d = size * 0.42;
  return (
    <Frame size={size}>
      <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: 1.7, borderColor: color, marginRight: size * 0.12, marginBottom: size * 0.1 }} />
      <View style={{
        position: "absolute",
        width: size * 0.28,
        height: 1.7,
        backgroundColor: color,
        borderRadius: 2,
        right: size * 0.14,
        bottom: size * 0.22,
        transform: [{ rotate: "40deg" }],
      }} />
    </Frame>
  );
}

export function IconPlus({ color, size = 22 }: IconProps) {
  return (
    <Frame size={size}>
      <Stroke color={color} style={{ position: "absolute", width: size * 0.72, height: size * 0.72, borderRadius: 6, borderWidth: 1.7 }} />
      <View style={{ width: size * 0.34, height: 1.7, backgroundColor: color, borderRadius: 2 }} />
      <View style={{ position: "absolute", width: 1.7, height: size * 0.34, backgroundColor: color, borderRadius: 2 }} />
    </Frame>
  );
}

export function IconChat({ color, filled = false, size = 24 }: IconProps) {
  return (
    <Frame size={size}>
      <View style={{
        width: size * 0.64,
        height: size * 0.48,
        borderRadius: 8,
        borderWidth: 1.7,
        borderColor: color,
        backgroundColor: filled ? color : "transparent",
      }} />
      <View style={{
        width: 0,
        height: 0,
        marginTop: -1,
        marginRight: size * 0.22,
        borderLeftWidth: 4,
        borderRightWidth: 4,
        borderTopWidth: 6,
        borderLeftColor: "transparent",
        borderRightColor: "transparent",
        borderTopColor: color,
      }} />
    </Frame>
  );
}

export function IconUser({ color, filled = false, size = 24 }: IconProps) {
  const head = size * 0.28;
  return (
    <Frame size={size}>
      <View style={{
        width: head,
        height: head,
        borderRadius: head / 2,
        borderWidth: 1.7,
        borderColor: color,
        backgroundColor: filled ? color : "transparent",
        marginBottom: 3,
      }} />
      <View style={{
        width: size * 0.56,
        height: size * 0.28,
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderWidth: 1.7,
        borderBottomWidth: 0,
        borderColor: color,
        backgroundColor: filled ? color : "transparent",
      }} />
    </Frame>
  );
}

export function IconDoor({ color, size = 24 }: IconProps) {
  return (
    <Frame size={size}>
      <View style={{
        width: size * 0.48,
        height: size * 0.64,
        borderRadius: 3,
        borderWidth: 1.7,
        borderColor: color,
      }}>
        <View style={{
          position: "absolute",
          right: 4,
          top: "46%",
          width: 3,
          height: 3,
          borderRadius: 2,
          backgroundColor: color,
        }} />
      </View>
    </Frame>
  );
}

export function IconHeart({ color, filled = false, size = 24 }: IconProps) {
  const bump = size * 0.28;
  return (
    <Frame size={size}>
      <View style={{ width: size * 0.7, height: size * 0.64, alignItems: "center" }}>
        <View style={{ flexDirection: "row", zIndex: 1 }}>
          <View style={{ width: bump, height: bump, borderRadius: bump / 2, backgroundColor: color, borderWidth: filled ? 0 : 1.7, borderColor: color }} />
          <View style={{ width: bump, height: bump, borderRadius: bump / 2, backgroundColor: color, borderWidth: filled ? 0 : 1.7, borderColor: color, marginLeft: -size * 0.04 }} />
        </View>
        <View style={{
          width: size * 0.42,
          height: size * 0.42,
          backgroundColor: color,
          transform: [{ rotate: "45deg" }],
          marginTop: -size * 0.18,
          borderBottomRightRadius: 3,
        }} />
      </View>
    </Frame>
  );
}

export function IconComment({ color, size = 24 }: IconProps) {
  return <IconChat color={color} size={size} />;
}

export function IconPhoto({ color, size = 24 }: IconProps) {
  return (
    <Frame size={size}>
      <View style={{
        width: size * 0.68,
        height: size * 0.5,
        borderRadius: 4,
        borderWidth: 1.7,
        borderColor: color,
      }}>
        <View style={{
          position: "absolute",
          left: 4,
          top: 4,
          width: 4,
          height: 4,
          borderRadius: 2,
          borderWidth: 1.4,
          borderColor: color,
        }} />
        <View style={{
          position: "absolute",
          left: 3,
          bottom: 3,
          width: size * 0.22,
          height: 1.6,
          backgroundColor: color,
          transform: [{ rotate: "-28deg" }],
        }} />
        <View style={{
          position: "absolute",
          right: 4,
          bottom: 3,
          width: size * 0.28,
          height: 1.6,
          backgroundColor: color,
          transform: [{ rotate: "28deg" }],
        }} />
      </View>
    </Frame>
  );
}

export function IconCard({ color, size = 24 }: IconProps) {
  return (
    <Frame size={size}>
      <View style={{
        width: size * 0.48,
        height: size * 0.62,
        borderRadius: 4,
        borderWidth: 1.7,
        borderColor: color,
        paddingTop: 5,
        paddingHorizontal: 4,
        gap: 3,
      }}>
        <View style={{ height: 1.6, backgroundColor: color, borderRadius: 1, width: "100%" }} />
        <View style={{ height: 1.6, backgroundColor: color, borderRadius: 1, width: "68%" }} />
      </View>
    </Frame>
  );
}

export function IconGroup({ color, size = 24 }: IconProps) {
  const left = size * 0.22;
  const right = size * 0.18;
  return (
    <Frame size={size}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", height: size * 0.72 }}>
        <View style={{ alignItems: "center" }}>
          <View style={{
            width: left,
            height: left,
            borderRadius: left / 2,
            borderWidth: 1.7,
            borderColor: color,
            marginBottom: 3,
          }} />
          <View style={{
            width: size * 0.42,
            height: size * 0.2,
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
            borderWidth: 1.7,
            borderBottomWidth: 0,
            borderColor: color,
          }} />
        </View>
        <View style={{ alignItems: "center", marginLeft: -size * 0.08, marginBottom: 2 }}>
          <View style={{
            width: right,
            height: right,
            borderRadius: right / 2,
            borderWidth: 1.7,
            borderColor: color,
            marginBottom: 3,
          }} />
          <View style={{
            width: size * 0.3,
            height: size * 0.16,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            borderWidth: 1.7,
            borderBottomWidth: 0,
            borderColor: color,
          }} />
        </View>
      </View>
    </Frame>
  );
}
