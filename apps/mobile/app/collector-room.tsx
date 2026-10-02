import { View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSocialRepository } from "../src/data";
import { useReportAskSurface } from "../src/ask-surface";
import { useCopy } from "../src/locale";
import { ROOM_THEMES } from "../src/room/theme";
import { RoomWorldScreen } from "../src/room/RoomWorldScreen";
import { immersiveRoomFill } from "../src/ui/shellLayout";

export default function CollectorRoomScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const { userId = "" } = useLocalSearchParams<{ userId?: string }>();
  useReportAskSurface({
    surface: "collector_room",
    ...(userId ? { collectorUserId: userId, roomOwnerUserId: userId } : {}),
  });
  // Demo isolation: fixture rooms only. copy.demoRoomUnavailable is the Live-off message.
  return <>
    <Stack.Screen options={{ contentStyle: immersiveRoomFill(ROOM_THEMES.hearth.void), gestureEnabled: false, fullScreenGestureEnabled: false }} />
    <View style={immersiveRoomFill(ROOM_THEMES.hearth.void)}>
    <RoomWorldScreen
      mode="public"
      userId={userId}
      demo={social.kind === "demo"}
      persistLive={social.capabilities.persistRoom}
      copy={copy}
      onLeave={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/search"); }}
      onOwnRoom={() => router.replace("/room")}
    />
  </View>
  </>;
}
