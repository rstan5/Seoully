import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { roomChromeSurface, type RoomChrome } from "./theme";

/** Shared tactile surface for Room feedback and guidance; palette stays Room-owned. */
export function RoomMessage({ chrome, children, pointerEvents = "box-none" }: {
  chrome: RoomChrome; children: ReactNode; pointerEvents?: "none" | "box-none" | "auto";
}) {
  return <View pointerEvents={pointerEvents} style={[roomMessageStyles.surface, roomChromeSurface(chrome)]}>{children}</View>;
}
export const roomMessageStyles = StyleSheet.create({
  surface: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 12, shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  text: { fontSize: 13, lineHeight: 19, flexShrink: 1 },
  sheetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: 16, marginBottom: 16 },
});
