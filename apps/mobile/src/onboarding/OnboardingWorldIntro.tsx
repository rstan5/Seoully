import { HeartFarewell } from "../ui/HeartFarewell";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileCopy } from "../i18n";
import { useSocialRepository } from "../data";
import { updateNativeOnboarding } from "../api";
import { RoomWorldScreen } from "../room/RoomWorldScreen";
import { SeoullyCompanion } from "../ui/SeoullyCompanion";
import { SeoullyText } from "../ui/SeoullyText";
import { DEFAULT_ROOM_STYLE, resolveRoomLook } from "../room/roomStyle";
import { roomOverlayChrome } from "../room/theme";

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
  const [dismissed, setDismissed] = useState(false);
  const [promptStyle, setPromptStyle] = useState(DEFAULT_ROOM_STYLE);
  const chrome = roomOverlayChrome(resolveRoomLook(promptStyle));
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
    <RoomWorldScreen onRoomAppearance={setPromptStyle} loadingCovered={!handoff} initialHoldingId={handoff && photocard && !complete ? holdingId : undefined} mode="own" demo={false} persistLive={social.capabilities.persistRoom} copy={copy}
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
      {!dismissed || complete || error ? <View style={[styles.guide, { bottom: insets.bottom + 80, backgroundColor: chrome.background, borderColor: chrome.border }]}>
        <SeoullyText variant="caption" color={chrome.color}>{complete ? copy.onboardFirstHomeComplete : photocard ? copy.onboardBinderFirst : copy.onboardPlaceFirst}</SeoullyText>
        {error ? <><SeoullyText accessibilityRole="alert" variant="caption" color={chrome.color}>{copy.onboardingSaveFailed}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={() => { void finish(confirmed.current); }} style={styles.action}><SeoullyText variant="caption" color={chrome.color}>{copy.retry}</SeoullyText></Pressable></> : null}
        {complete ? <Pressable accessibilityRole="button" onPress={onContinue} style={[styles.action, { borderColor: chrome.border, borderWidth: 1 }]}><SeoullyText variant="caption" color={chrome.color}>{copy.onboardFindPeople}</SeoullyText></Pressable> : !error ? <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => setDismissed(true)} style={styles.action}><SeoullyText variant="caption" color={chrome.color}>{copy.close}</SeoullyText></Pressable> : null}
      </View> : null}
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { flex: 1 },
  guide: { position: "absolute", left: 16, right: 80, maxWidth: 250, padding: 12, gap: 8, borderRadius: 18, borderWidth: 1, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  action: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 10, borderRadius: 12 },
});
