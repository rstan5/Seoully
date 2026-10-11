import { StyleSheet, View } from "react-native";
import { NativeRoomRenderer } from "./NativeRoomRenderer";
import { primaryBinderDeskId } from "./roomObjects";
import type { ProfileRoomPreview } from "./profileRoom";
const ignore = () => {};

/** The existing Room world, at its authored home camera. No substitute geometry. */
export function RoomWorldGlimpse({ room, ownerName }: { room: ProfileRoomPreview; ownerName?: string }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <NativeRoomRenderer presentation="profile" ownerName={ownerName} roomId={room.id} themeId="hearth" style={room.style}
      objects={room.objects} items={room.items} photoStringHoldings={room.holdings}
      publicStringCards={room.publicStringCards} binderDeskId={primaryBinderDeskId(room.objects)}
      selectedId={null} focusedId={null} view={{ kind: "home" }} readOnly reducedMotion
      onSelect={ignore} onSelectZone={ignore} onClearSelection={ignore} />
  </View>;
}
