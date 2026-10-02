import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSocialRepository } from "../src/data";
import { useReportAskSurface } from "../src/ask-surface";
import { useCopy } from "../src/locale";
import { RoomWorldScreen } from "../src/room/RoomWorldScreen";

export default function RoomScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const params = useLocalSearchParams<{ holdingId?: string }>();
  useReportAskSurface({ surface: "room" });
  // Slice 2 stored tray: snapshot?.holdings.filter((holding) => !placedIds.has(holding.id))
  // storedCollection chrome is rendered by RoomWorldScreen; this route still gates persistRoom.
  return <>
    <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
    <SafeAreaView edges={[]} style={{ flex: 1 }}>
    <RoomWorldScreen
      mode="own"
      demo={social.kind === "demo"}
      persistLive={social.capabilities.persistRoom}
      copy={copy}
      initialHoldingId={typeof params.holdingId === "string" ? params.holdingId : undefined}
      onLeave={() => { if (router.canGoBack()) router.back(); else router.replace("/(tabs)/profile"); }}
      onInspectCollectible={(holdingId) => router.push({ pathname: "/collectible", params: { holdingId } })}
    />
  </SafeAreaView>
  </>;
}
