import { HeartFarewell } from "../ui/HeartFarewell";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, AppState, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { RoomMessage, roomMessageStyles } from "../room/RoomMessage";
import type { MobileCopy } from "../i18n";
import { useSocialRepository } from "../data";
import { updateNativeOnboarding } from "../api";
import { RoomWorldScreen } from "../room/RoomWorldScreen";
import { SeoullyCompanion } from "../ui/SeoullyCompanion";
import { SeoullyText } from "../ui/SeoullyText";
import { useMotionPreference } from "../ui/motion";
import { colors } from "../theme";
import { nextArrivalMessage, type ArrivalMessage } from "./roomArrival";
import { DEFAULT_ROOM_STYLE, resolveRoomLook } from "../room/roomStyle";
import { roomOverlayChrome } from "../room/theme";

export default function OnboardingWorldIntro({ holdingId, photocard, playArrival = true, copy, onContinue, onBack }: {
  holdingId?: string; photocard: boolean; playArrival?: boolean; copy: MobileCopy; onContinue: () => void; onBack: () => void;
}) {
  const social = useSocialRepository();
  const reduced = useMotionPreference();
  const completing = useRef(false);
  const confirmed = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [ready, setReady] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const [roomFailed, setRoomFailed] = useState(false);
  const [handoff, setHandoff] = useState(!playArrival);
  const [visible, setVisible] = useState(!playArrival);
  const [established, setEstablished] = useState(false);
  const [cover] = useState(() => new Animated.Value(playArrival ? 1 : 0));
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<ArrivalMessage>("home");
  const [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const sub = AppState.addEventListener("change", state => setActive(state === "active")); return () => sub.remove(); }, []);
  const [promptStyle, setPromptStyle] = useState(DEFAULT_ROOM_STYLE);
  const chrome = roomOverlayChrome(resolveRoomLook(promptStyle));

  useEffect(() => {
    if (!handoff || visible || reduced === null) return;
    const animation = Animated.timing(cover, { toValue: 0, duration: reduced ? 0 : 280, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) setVisible(true); });
    return () => animation.stop();
  }, [cover, handoff, reduced, visible]);
  // One timer, owned by the currently visible message. Backgrounding pauses it;
  // returning grants the full reading interval instead of skipping unseen text.
  const arrivalVisible = ready && worldReady && visible && established && focused && active;
  const messagesVisible = arrivalVisible && (photocard || complete);
  useEffect(() => {
    if (!messagesVisible || message === "dismissed" || message === "profile") return;
    const timer = setTimeout(() => setMessage(nextArrivalMessage), 3000);
    return () => clearTimeout(timer);
  }, [message, messagesVisible]);

  async function finish(confirmedHoldingId?: string) {
    if (!holdingId || confirmedHoldingId !== holdingId || completing.current || complete) return;
    completing.current = true; setError(false);
    try {
      const result = await updateNativeOnboarding({ action: "complete" });
      if (result.step !== "done") throw new Error("first_home_not_confirmed");
      if (mounted.current) setComplete(true);
    } catch { if (mounted.current) setError(true); }
    finally { completing.current = false; }
  }
  function destinationConfirmed(id?: string) {
    if (!id || id !== holdingId) return;
    confirmed.current = id; void finish(id);
  }
  const messageText = message === "home" ? copy.roomArrivalHome : message === "edit" ? copy.roomArrivalEdit : copy.roomArrivalFinish;
  return <View style={styles.wrap}>
    <RoomWorldScreen suppressAmbientGuidance roomGuidance={((messagesVisible && message !== "dismissed") || (arrivalVisible && error)) ? <RoomMessage chrome={chrome}>
        <View style={styles.messageRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => setMessage("dismissed")} style={styles.dismiss}><SeoullyText color={chrome.color}>×</SeoullyText></Pressable>
        {message !== "dismissed" ? <SeoullyText variant="caption" style={roomMessageStyles.text} color={chrome.color}>{messageText}</SeoullyText> : null}
        </View>
        {error ? <><SeoullyText accessibilityRole="alert" variant="caption" style={roomMessageStyles.text} color={chrome.color}>{copy.onboardingSaveFailed}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={() => { void finish(confirmed.current); }} style={styles.action}><SeoullyText variant="caption" color={chrome.color}>{copy.retry}</SeoullyText></Pressable></> : null}
        {message === "profile" ? <Pressable accessibilityRole="button" disabled={!complete} onPress={() => { setMessage("dismissed"); onContinue(); }} style={[styles.action, { borderColor: chrome.border, borderWidth: 1, opacity: complete ? 1 : 0.6 }]}><SeoullyText variant="caption" color={chrome.color}>{copy.roomArrivalProfile}</SeoullyText></Pressable> : null}
      </RoomMessage> : visible && !photocard && !complete ? <RoomMessage chrome={chrome}><SeoullyText color={chrome.color} style={roomMessageStyles.text}>{copy.onboardPlaceFirst}</SeoullyText></RoomMessage> : null} onRoomAppearance={setPromptStyle} loadingCovered={!handoff} initialHoldingId={visible && photocard ? holdingId : undefined} mode="own" demo={false} persistLive={social.capabilities.persistRoom} copy={copy}
      onWorldReady={() => { setWorldReady(true); if (!photocard) setEstablished(true); }}
      onBinderArrivalReady={() => setEstablished(true)}
      onLeave={() => { setMessage("dismissed"); if (complete) onContinue(); else onBack(); }}
      onLiveSnapshotReady={(snapshot) => {
        setReady(true); setRoomFailed(false);
        if (!photocard && snapshot.placements.some(placement => placement.holdingId === holdingId)) destinationConfirmed(holdingId);
      }}
      onLiveSnapshotFailed={() => setRoomFailed(true)}
      onLivePlacementConfirmed={(id) => { if (!photocard) destinationConfirmed(id); }}
      onLiveBinderConfirmed={(ids) => { if (photocard && holdingId && ids.includes(holdingId)) destinationConfirmed(holdingId); }}
    />
    {handoff && !visible ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, opacity: cover }]} /> : null}
    {!handoff ? <HeartFarewell ready={(ready && worldReady) || roomFailed} text={copy.onboardOwnershipHandoff} onContinue={() => setHandoff(true)} /> : null}
    {ready && handoff ? <SeoullyCompanion onboardingActive /> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { flex: 1 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", alignSelf: "flex-start", marginLeft: -8, marginTop: -8 },
  action: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 10, borderRadius: 12 },
});
