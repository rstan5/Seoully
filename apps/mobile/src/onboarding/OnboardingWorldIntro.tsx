import { HeartFarewell } from "../ui/HeartFarewell";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileCopy } from "../i18n";
import { useSocialRepository } from "../data";
import { updateNativeOnboarding } from "../api";
import { RoomWorldScreen } from "../room/RoomWorldScreen";
import { SeoullyCompanion } from "../ui/SeoullyCompanion";
import { SeoullyButton } from "../ui/SeoullyControls";
import { SeoullyText } from "../ui/SeoullyText";
import { colors } from "../theme";

export default function OnboardingWorldIntro({ holdingId, photocard, copy, onContinue, onBack }: {
  holdingId?: string; photocard: boolean; copy: MobileCopy; onContinue: () => void; onBack: () => void;
}) {
  const social = useSocialRepository();
  const insets = useSafeAreaInsets();
  const completing = useRef(false);
  const confirmed = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [roomFailed, setRoomFailed] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(false);
  async function finish(confirmedHoldingId?: string) {
    if (!holdingId || confirmedHoldingId !== holdingId || completing.current || complete) return;
    completing.current = true;
    setError(false);
    try {
      const result = await updateNativeOnboarding({ action: "complete" });
      if (result.step !== "done") throw new Error("first_home_not_confirmed");
      setComplete(true);
    } catch { setError(true); }
    finally { completing.current = false; }
  }
  function destinationConfirmed(id?: string) {
    if (!id || id !== holdingId) return;
    confirmed.current = id;
    void finish(id);
  }
  return <View style={styles.wrap}>
    <RoomWorldScreen loadingCovered={!handoff} initialHoldingId={handoff && photocard && !complete ? holdingId : undefined} mode="own" demo={false} persistLive={social.capabilities.persistRoom} copy={copy}
      onLeave={() => { if (complete) onContinue(); else onBack(); }}
      onLiveSnapshotReady={(snapshot) => {
        setReady(true);
        setRoomFailed(false);
        if (!photocard && snapshot.placements.some(placement => placement.holdingId === holdingId)) destinationConfirmed(holdingId);
      }}
      onLiveSnapshotFailed={() => setRoomFailed(true)}
      onLivePlacementConfirmed={(id) => { if (!photocard) destinationConfirmed(id); }}
      onLiveBinderConfirmed={(ids) => { if (photocard && holdingId && ids.includes(holdingId)) destinationConfirmed(holdingId); }}
    />
    {!handoff ? <HeartFarewell ready={ready || roomFailed} text={copy.onboardOwnershipHandoff} onContinue={() => setHandoff(true)} /> : null}
    {ready && handoff ? <>
      <SeoullyCompanion onboardingActive />
      <View pointerEvents="box-none" style={[styles.guide, { top: insets.top + 98 }]}>
        <SeoullyText variant="secondary">{complete ? copy.onboardFirstHomeComplete : photocard ? copy.onboardBinderFirst : copy.onboardPlaceFirst}</SeoullyText>
        {error ? <><SeoullyText accessibilityRole="alert" variant="caption">{copy.onboardingSaveFailed}</SeoullyText>
          <SeoullyButton label={copy.retry} variant="ghost" onPress={() => { void finish(confirmed.current); }} /></> : null}
        {complete ? <SeoullyButton label={copy.onboardFindPeople} variant="ghost" onPress={onContinue} /> : null}
      </View>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { flex: 1 },
  guide: { position: "absolute", left: 64, right: 64, padding: 10, gap: 4, backgroundColor: colors.canvas, borderRadius: 16 },
});
