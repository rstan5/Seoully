import { SeoullyMessageScreen } from "../ui/SeoullyMessageScreen";
import { SeoullyButton } from "../ui/SeoullyControls";
import { onboardingTrace } from "../startup/onboardingTrace";
import { startupTrace } from "../startup/trace";
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
import { usePausedCountdown } from "../ui/usePausedCountdown";
import { colors } from "../theme";
import { nextArrivalMessage, type ArrivalMessage, type RoomArrivalStage } from "./roomArrival";
import { DEFAULT_ROOM_STYLE, resolveRoomLook } from "../room/roomStyle";
import { roomOverlayChrome } from "../room/theme";

export default function OnboardingWorldIntro({ holdingId, photocard, initialStage = "heart", onPresentationStage, copy, onContinue, onHome }: {
  holdingId?: string; photocard: boolean; initialStage?: RoomArrivalStage; onPresentationStage: (stage: RoomArrivalStage) => Promise<void>; copy: MobileCopy; onContinue: () => void; onHome: () => void;
}) {
  const social = useSocialRepository();
  const reduced = useMotionPreference();
  const [stage, setStage] = useState(initialStage);
  const presentationEpoch = useRef(0);
  const retryPresentation = useRef<(() => void) | null>(null);
  const [presentationError, setPresentationError] = useState(false);
  const resumedMessages = initialStage === "home" || initialStage === "edit" || initialStage === "profile" || initialStage === "dismissed";
  const completing = useRef(false);
  const confirmed = useRef<string | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => { const epoch = presentationEpoch; mounted.current = true; onboardingTrace("room_intro_mount", { mounted: true }); return () => { onboardingTrace("room_intro_mount", { mounted: false }); mounted.current = false; epoch.current++; }; }, []);
  const [ready, setReady] = useState(false);
  const [worldReady, setWorldReady] = useState(false);
  const [roomFailed, setRoomFailed] = useState(false);
  const [handoff, setHandoff] = useState(initialStage !== "heart");
  const [visible, setVisible] = useState(initialStage !== "heart" && initialStage !== "room");
  const [binderMayEnter, setBinderMayEnter] = useState(initialStage === "binder");
  const [established, setEstablished] = useState(resumedMessages);
  const [cover] = useState(() => new Animated.Value(initialStage === "heart" || initialStage === "room" ? 1 : 0));
  const [complete, setComplete] = useState(false);
  const [destinationReady, setDestinationReady] = useState(false);
  const navigated = useRef(false);
  const [navigationRequested, setNavigationRequested] = useState<"discover" | "profile" | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<ArrivalMessage>(resumedMessages ? initialStage as ArrivalMessage : "home");
  const [active, setActive] = useState(AppState.currentState !== "background" && AppState.currentState !== "inactive");
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => { const sub = AppState.addEventListener("change", state => { onboardingTrace("lifecycle", { lifecycle: state }); setActive(state === "active"); }); return () => sub.remove(); }, []);
  const [promptStyle, setPromptStyle] = useState(DEFAULT_ROOM_STYLE);
  const chrome = roomOverlayChrome(resolveRoomLook(promptStyle));

  function checkpoint(next: RoomArrivalStage, apply: () => void) {
    if (!mounted.current) return;
    const epoch = ++presentationEpoch.current;
    retryPresentation.current = () => checkpoint(next, apply);
    setPresentationError(false);
    void onPresentationStage(next).then(() => {
      if (!mounted.current || epoch !== presentationEpoch.current) return;
      retryPresentation.current = null;
      onboardingTrace("room_intro_checkpoint", { stage: next });
      setStage(next); apply();
    }).catch(() => {
      if (mounted.current && epoch === presentationEpoch.current) setPresentationError(true);
    });
  }

  useEffect(() => {
    if (!handoff || visible || reduced === null) return;
    const animation = Animated.timing(cover, { toValue: 0, duration: reduced ? 0 : 600, useNativeDriver: true });
    animation.start(({ finished }) => { if (finished) checkpoint(photocard ? "binder" : "home", () => setVisible(true)); });
    return () => animation.stop();
    // Segment callback identity changes with locale, not the active fade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover, handoff, reduced, visible]);
  usePausedCountdown(reduced ? 0 : 300, visible && active && focused && photocard && !resumedMessages && !binderMayEnter, "binder-entrance", () => setBinderMayEnter(true));
  const arrivalVisible = ready && worldReady && visible && established && focused && active;
  const messagesVisible = arrivalVisible && (photocard || destinationReady);
  usePausedCountdown(5000, messagesVisible && message !== "dismissed" && message !== "profile", message, () => { const next = nextArrivalMessage(message); checkpoint(next, () => setMessage(next)); });

  async function finish(confirmedHoldingId?: string) {
    if (!holdingId || confirmedHoldingId !== holdingId || completing.current || complete) return;
    onboardingTrace("completion_start", { holdingConfirmed: true });
    completing.current = true; setError(false);
    try {
      const result = await updateNativeOnboarding({ action: "complete" });
      if (result.step !== "done") throw new Error("first_home_not_confirmed");
      startupTrace("onboarding completion", "server_confirmed");
      onboardingTrace("completion_confirmed", { completed: true });
      if (mounted.current) setComplete(true);
    } catch { onboardingTrace("completion_failed", { category: "request_or_confirmation" }); if (mounted.current) setError(true); }
    finally { completing.current = false; }
  }
  function destinationConfirmed(id?: string) {
    if (!id || id !== holdingId) return;
    confirmed.current = id; setDestinationReady(true);
  }
  useEffect(() => {
    if (navigationRequested && destinationReady && !complete) void finish(confirmed.current);
    // Completion is requested by an exit intent, never by an animation or Room hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationRequested, destinationReady, complete]);
  useEffect(() => {
    if (!navigationRequested || !complete || !active || !focused || navigated.current) return;
    navigated.current = true;
    setMessage("dismissed");
    if (navigationRequested === "profile") onHome(); else onContinue();
  }, [active, complete, focused, navigationRequested, onContinue, onHome]);
  function requestSocial(target: "discover" | "profile" = "discover") {
    if (navigated.current) return;
    startupTrace("social handoff", complete ? "ready" : "waiting_for_completion");
    onboardingTrace("social_exit_press", { completed: complete, holdingConfirmed: Boolean(confirmed.current), intent: target });
    setNavigationRequested(target);
  }
  function requestDiscover() { requestSocial("discover"); }
  const messageText = message === "home" ? copy.roomArrivalHome : message === "edit" ? copy.roomArrivalEdit : copy.roomArrivalFinish;
  if (presentationError) return <SeoullyMessageScreen message={copy.onboardingSaveFailed} alert>
    <SeoullyButton label={copy.retry} onPress={() => retryPresentation.current?.()} />
  </SeoullyMessageScreen>;
  return <View style={styles.wrap}>
    <RoomWorldScreen suppressAmbientGuidance roomGuidance={((messagesVisible && message !== "dismissed") || (arrivalVisible && (error || navigationRequested))) ? <RoomMessage chrome={chrome}>
        <View style={styles.messageRow}>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => { setNavigationRequested(null); checkpoint("dismissed", () => setMessage("dismissed")); }} style={styles.dismiss}><SeoullyText color={chrome.color}>×</SeoullyText></Pressable>
        {message !== "dismissed" ? <SeoullyText variant="caption" style={roomMessageStyles.text} color={chrome.color}>{messageText}</SeoullyText> : null}
        </View>
        {error ? <><SeoullyText accessibilityRole="alert" variant="caption" style={roomMessageStyles.text} color={chrome.color}>{copy.onboardingSaveFailed}</SeoullyText>
          <Pressable accessibilityRole="button" onPress={() => { void finish(confirmed.current); }} style={styles.action}><SeoullyText variant="caption" color={chrome.color}>{copy.retry}</SeoullyText></Pressable></> : null}
        {navigationRequested && !complete ? <SeoullyText accessibilityLiveRegion="polite" variant="caption" color={chrome.color}>{copy.roomArrivalSaving}</SeoullyText> : null}
        {message === "profile" ? <Pressable accessibilityRole="button" accessibilityState={{ busy: Boolean(navigationRequested && !complete) }} onPressIn={() => onboardingTrace("go_profile_touch", { focused: true })} onPress={requestDiscover} style={[styles.action, { borderColor: chrome.border, borderWidth: 1, opacity: 1 }]}><SeoullyText variant="caption" color={chrome.color}>{navigationRequested && !complete ? copy.saving : copy.roomArrivalProfile}</SeoullyText></Pressable> : null}
      </RoomMessage> : visible && !photocard && !destinationReady ? <RoomMessage chrome={chrome}><SeoullyText color={chrome.color} style={roomMessageStyles.text}>{copy.onboardPlaceFirst}</SeoullyText></RoomMessage> : null} onRoomAppearance={setPromptStyle} loadingCovered={!handoff} initialHoldingId={binderMayEnter && photocard ? holdingId : undefined} mode="own" demo={false} persistLive={social.capabilities.persistRoom} copy={copy}
      onWorldReady={() => { setWorldReady(true); if (!photocard) setEstablished(true); }}
      onBinderArrivalReady={() => { startupTrace("binder arrival", "settled"); if (stage === "heart" || stage === "room" || stage === "binder") checkpoint("home", () => setEstablished(true)); else setEstablished(true); }}
      onLeave={() => requestSocial("profile")}
      onLiveSnapshotReady={(snapshot) => {
        setReady(true); setRoomFailed(false);
        if (!photocard && snapshot.placements.some(placement => placement.holdingId === holdingId)) destinationConfirmed(holdingId);
      }}
      onLiveSnapshotFailed={() => setRoomFailed(true)}
      onLivePlacementConfirmed={(id) => { if (!photocard) destinationConfirmed(id); }}
      onLiveBinderConfirmed={(ids) => { if (photocard && holdingId && ids.includes(holdingId)) destinationConfirmed(holdingId); }}
    />
    {handoff && !visible ? <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.canvas, opacity: cover }]} /> : null}
    {!handoff ? <HeartFarewell ready={(ready && worldReady) || roomFailed} text={copy.onboardOwnershipHandoff} onContinue={() => checkpoint("room", () => setHandoff(true))} /> : null}
    {ready && handoff ? <SeoullyCompanion onboardingActive /> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { flex: 1 },
  messageRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dismiss: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", alignSelf: "center", marginLeft: -8 },
  action: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start", paddingHorizontal: 10, borderRadius: 12 },
});
