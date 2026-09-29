import { StyleSheet, View } from "react-native";
import type { NativeRoomThemeId } from "../api";
import { roomPalette } from "./theme";

/**
 * Lightweight Profile-over-Room representation derived from the real native
 * room palette and furniture layout. Not a live GL scene (too expensive under
 * identity chrome) and not generic paper.
 */
export function RoomWorldGlimpse({ themeId = "hearth", dimmed = true }: { themeId?: NativeRoomThemeId; dimmed?: boolean }) {
  const theme = roomPalette(themeId);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.void }]}>
      <View style={[styles.backWall, { backgroundColor: theme.wall }]} />
      <View style={[styles.side, styles.left, { backgroundColor: theme.sideWall }]} />
      <View style={[styles.side, styles.right, { backgroundColor: theme.sideWall }]} />
      <View style={[styles.floor, { backgroundColor: theme.floor }]} />
      <View style={[styles.rug, { backgroundColor: theme.accent }]} />
      <View style={[styles.shelf, { backgroundColor: theme.furniture, borderColor: theme.edge }]}>
        <View style={[styles.shelfBoard, { backgroundColor: theme.edge }]} />
        <View style={[styles.shelfBoard, { backgroundColor: theme.edge, top: 28 }]} />
        <View style={[styles.shelfBoard, { backgroundColor: theme.edge, top: 56 }]} />
      </View>
      <View style={[styles.desk, { backgroundColor: theme.edge }]} />
      <View style={[styles.binder, { backgroundColor: theme.binder }]} />
      <View style={[styles.case, { backgroundColor: theme.furniture, borderColor: theme.edge }]} />
      <View style={[styles.archive, { backgroundColor: theme.furniture }]} />
      <View style={[styles.window, { backgroundColor: theme.light }]} />
      {dimmed ? <View style={styles.dim} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backWall: { height: "58%", left: "8%", position: "absolute", right: "8%", top: "6%" },
  side: { bottom: "22%", position: "absolute", top: "8%", width: "10%" },
  left: { left: 0, transform: [{ skewY: "12deg" }] },
  right: { right: 0, transform: [{ skewY: "-12deg" }] },
  floor: { bottom: 0, height: "38%", left: 0, position: "absolute", right: 0 },
  rug: { borderRadius: 80, bottom: "10%", height: 70, left: "28%", opacity: 0.55, position: "absolute", right: "22%" },
  shelf: { borderLeftWidth: 6, borderRadius: 4, height: 92, left: "10%", position: "absolute", top: "22%", width: 86 },
  shelfBoard: { height: 6, left: 6, position: "absolute", right: 6, top: 12 },
  desk: { borderRadius: 4, height: 18, position: "absolute", right: "22%", top: "48%", width: 140 },
  binder: { borderRadius: 3, height: 42, position: "absolute", right: "38%", top: "40%", transform: [{ rotate: "-12deg" }], width: 28 },
  case: { borderRadius: 4, borderWidth: 2, height: 96, position: "absolute", right: "10%", top: "20%", width: 52 },
  archive: { borderRadius: 4, bottom: "16%", height: 36, left: "22%", position: "absolute", width: 70 },
  window: { height: 54, opacity: 0.35, position: "absolute", right: "28%", top: "14%", width: 40 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(18, 12, 16, 0.28)" },
});
