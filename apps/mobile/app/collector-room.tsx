import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSocialRepository } from "../src/data";
import { useReportAskSurface } from "../src/ask-surface";
import { useCopy } from "../src/locale";
import { RoomWorldScreen } from "../src/room/RoomWorldScreen";

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
  return <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
    <RoomWorldScreen
      mode="public"
      userId={userId}
      demo={social.kind === "demo"}
      persistLive={social.capabilities.persistRoom}
      copy={copy}
      onLeave={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/search"); }}
      onOwnRoom={() => router.replace("/room")}
    />
  </SafeAreaView>;
}
