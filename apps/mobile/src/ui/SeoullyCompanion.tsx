import { LanguageModal } from "./GlobalLanguageControl";
import { heartMotion } from "./heartMotion";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { usePathname, useRouter, useGlobalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAskSurfaceOverlay } from "../ask-surface";
import { contextFromNativeRoute, isAskNavigationAction, mergeAskContext, type AskNavigationAction } from "seoully-domain/ask-context";
import { planAskSend } from "seoully-domain/ask-intent";
import { useSocialRepository, type NativeAskCard } from "../data";
import { isExploreDestination } from "../explore";
import { useCopy, useLocale } from "../locale";
import { useBootstrap } from "../startup/BootstrapProvider";
import { colors, elevation, faces, radii, sizes } from "../theme";
import { pressShift, useReduceMotion } from "./motion";
import { companionPlacement, routeShowsBottomNav } from "./shellLayout";
import { SeoullyText } from "./SeoullyText";

const HEART = require("../../assets/brand/seoully-heart-mark.png");

function cardActionLabel(action: AskNavigationAction, copy: ReturnType<typeof useCopy>) {
  if (action.type === "profile" || action.type === "profile_self") return copy.askViewProfile;
  if (action.type === "room") return copy.askEnterRoom;
  if (action.type === "search") return copy.askSearch;
  if (action.type === "collection") return copy.askViewCollection;
  if (action.type === "wishlist") return copy.askViewWishlist;
  if (action.type === "composer") return copy.askOpenComposer;
  if (action.type === "inbox" || action.type === "conversation") return copy.askOpenMessages;
  if (action.type === "edit_profile") return copy.askEditProfile;
  if (action.type === "discover") return copy.askDiscover;
  if (action.type === "add") return copy.askTakeMeThere;
  return copy.askTakeMeThere;
}

type ChatTurn = { role: "user" | "assistant"; content: string; cards?: NativeAskCard[] };

export function SeoullyCompanion({ guidance, onboardingActive = false }: { guidance?: string; onboardingActive?: boolean } = {}) {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const overlay = useAskSurfaceOverlay();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const copy = useCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const boot = useBootstrap();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [bounce] = useState(() => new Animated.Value(0));
  const threadRef = useRef<ScrollView>(null);
  const recentCollectorIds = turns.flatMap((turn) => (turn.cards ?? []).filter((card) => card.kind === "collector").map((card) => card.id)).slice(-8);
  const recentTemplateIds = turns.flatMap((turn) => (turn.cards ?? []).filter((card) => card.kind === "collectible").map((card) => card.id)).slice(-8);
  const context = mergeAskContext(contextFromNativeRoute(pathname, params as Record<string, string | string[] | undefined>), {
    ...overlay,
    ...(recentCollectorIds.length ? { recentCollectorIds } : {}),
    ...(recentTemplateIds.length ? { recentTemplateIds } : {}),
  });

  useEffect(() => {
    if (reduceMotion) {
      bounce.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: heartMotion.halfCycleMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, reduceMotion]);

  if (guidance) return <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
    <Animated.View style={{ transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -heartMotion.travel] }) }] }}>
      <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HEART} style={{ width: 36, height: 36 }} />
    </Animated.View>
    <SeoullyText variant="secondary" style={{ flex: 1 }}>{guidance}</SeoullyText>
  </View>;
  if (!boot.companionEligible && !onboardingActive) return null;

  const placement = companionPlacement({
    insets,
    hasBottomNav: routeShowsBottomNav(pathname),
  });

  function navigateAction(action: AskNavigationAction) {
    if (action.type === "search") {
      setOpen(false);
      const nextQuery = action.query.trim();
      const dest = isExploreDestination(action.destination) ? action.destination : undefined;
      router.push({ pathname: "/search", params: dest ? { q: nextQuery, dest } : nextQuery ? { q: nextQuery } : {} });
      return;
    }
    setOpen(false);
    if (action.type === "profile" && action.userId) router.push({ pathname: "/collector", params: { userId: action.userId } });
    else if (action.type === "profile_self") router.push("/profile");
    else if (action.type === "room" && action.userId) router.push({ pathname: "/collector-room", params: { userId: action.userId } });
    else if (action.type === "collection" || action.type === "wishlist") router.push("/collection");
    else if (action.type === "composer") router.push("/create");
    else if (action.type === "inbox") router.push("/messages");
    else if (action.type === "add") router.push("/collect");
    else if (action.type === "edit_profile") router.push("/edit-profile");
    else if (action.type === "discover") router.push("/");
    else if (action.type === "conversation") {
      router.push({
        pathname: "/thread",
        params: {
          conversationId: action.conversationId,
          ...(action.userId ? { userId: action.userId } : {}),
        },
      });
    } else if (action.type === "collectible") router.push({ pathname: "/collectible", params: { holdingId: action.holdingId } });
    else if (action.type === "public_collectible") {
      router.push({
        pathname: "/public-collectible",
        params: {
          userId: action.userId,
          ...(action.templateId ? { templateId: action.templateId } : {}),
          ...(action.holdingId ? { holdingId: action.holdingId } : {}),
        },
      });
    }
  }

  async function send(raw?: string, retry = false) {
    const prompt = (raw ?? question).trim();
    if (!prompt || pending) return;
    const planned = planAskSend(turns, prompt, retry);
    setTurns(planned.turns);
    setQuestion("");
    setLastPrompt(prompt);
    setPending(true);
    setError(null);
    try {
      const result = await social.askSeoully(prompt, locale, planned.history, context);
      setTurns((current) => [...current, { role: "assistant" as const, content: result.reply, cards: result.cards }].slice(-18));
      if (result.navigation && isAskNavigationAction(result.navigation)) {
        navigateAction(result.navigation);
      }
      requestAnimationFrame(() => threadRef.current?.scrollToEnd({ animated: !reduceMotion }));
    } catch (failure) {
      const reason = failure instanceof Error ? failure.message : "";
      setError(reason === "unauthenticated" ? copy.askSeoullyUnauthenticated : copy.askSeoullyUnavailable);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.askSeoully}
          onPress={() => setOpen(true)}
          style={({ pressed }) => [styles.heartWrap, { bottom: placement.bottom, right: placement.right }, pressShift(pressed, reduceMotion)]}
        >
          <Animated.View style={{ transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -heartMotion.travel] }) }] }}>
            <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HEART} style={styles.heart} />
          </Animated.View>
        </Pressable>
      </View>
      <LanguageModal animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => setOpen(false)} transparent visible={open}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modal}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.veil} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHead}>
              <View style={styles.sheetIdentity} accessible accessibilityRole="header">
                <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HEART} style={styles.sheetHeart} />
                <SeoullyText variant="title">{copy.askSeoully}</SeoullyText>
              </View>
              <View style={styles.sheetActions}>
                {turns.length ? (
                  <Pressable accessibilityRole="button" hitSlop={10} onPress={() => { setTurns([]); setError(null); setLastPrompt(null); }}>
                    <SeoullyText variant="button" color={colors.plum}>{copy.askNewChat}</SeoullyText>
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setOpen(false)}>
                  <SeoullyText variant="button" color={colors.plum}>{copy.searchBack}</SeoullyText>
                </Pressable>
              </View>
            </View>
            <ScrollView ref={threadRef} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
              {turns.length === 0 ? (
                <View style={styles.starters}>
                  <SeoullyText variant="secondary">{copy.askSeoullyEmpty}</SeoullyText>
                  <Pressable accessibilityRole="button" onPress={() => { void send(copy.askStarterFind); }}>
                    <SeoullyText variant="button" color={colors.plum}>{copy.askStarterFind}</SeoullyText>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => { void send(copy.askStarterCollection); }}>
                    <SeoullyText variant="button" color={colors.plum}>{copy.askStarterCollection}</SeoullyText>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => { void send(copy.askStarterHelp); }}>
                    <SeoullyText variant="button" color={colors.plum}>{copy.askStarterHelp}</SeoullyText>
                  </Pressable>
                </View>
              ) : null}
              {turns.map((turn, index) => (
                <View key={`${turn.role}-${index}`} style={[styles.bubble, turn.role === "user" ? styles.user : styles.assistant]}>
                  <SeoullyText variant="body">{turn.content}</SeoullyText>
                  {turn.cards?.map((card) => {
                    const action = isAskNavigationAction(card.action) ? card.action : null;
                    return (
                      <Pressable
                        key={`${card.kind}-${card.id}`}
                        accessibilityRole={action ? "button" : undefined}
                        disabled={!action}
                        onPress={() => { if (action) navigateAction(action); }}
                        style={styles.card}
                      >
                        <SeoullyText variant="handle">{card.title}</SeoullyText>
                        {card.subtitle ? <SeoullyText variant="caption" color={colors.muted}>{card.subtitle}</SeoullyText> : null}
                        {card.detail ? <SeoullyText variant="caption" color={colors.muted}>{card.detail}</SeoullyText> : null}
                        {action ? <SeoullyText variant="button" color={colors.plum}>{cardActionLabel(action, copy)}</SeoullyText> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {pending ? <SeoullyText variant="caption" color={colors.muted}>{copy.askLoading}</SeoullyText> : null}
              {error ? (
                <View style={styles.errorRow}>
                  <SeoullyText variant="caption" color={colors.plum}>{error}</SeoullyText>
                  {lastPrompt ? (
                    <Pressable accessibilityRole="button" onPress={() => { void send(lastPrompt, true); }}>
                      <SeoullyText variant="button" color={colors.plum}>{copy.askRetry}</SeoullyText>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.compose}>
              <TextInput
                accessibilityLabel={copy.askSeoully}
                placeholder={copy.askSeoullyPlaceholder}
                placeholderTextColor={colors.muted}
                value={question}
                onChangeText={setQuestion}
                onSubmitEditing={() => { void send(); }}
                returnKeyType="send"
                style={[styles.input, { fontFamily: faces[locale].regular }]}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={copy.askSeoullySend} onPress={() => { void send(); }}>
                <SeoullyText variant="button" color={colors.plum}>{copy.askSeoullySend}</SeoullyText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </LanguageModal>
    </>
  );
}

const styles = StyleSheet.create({
  heartWrap: {
    alignItems: "center",
    height: sizes.companion + 8,
    justifyContent: "flex-end",
    position: "absolute",
    width: sizes.companion + 8,
    zIndex: 40,
  },
  heart: {
    height: sizes.companion,
    width: sizes.companion,
  },
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },
  veil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(44, 46, 76, 0.18)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "78%",
    paddingHorizontal: 16,
    paddingTop: 14,
    ...elevation.card,
  },
  sheetHead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sheetIdentity: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
    paddingRight: 8,
  },
  sheetHeart: {
    height: 28,
    width: 28,
  },
  sheetActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  errorRow: {
    gap: 6,
  },
  thread: {
    gap: 8,
    paddingBottom: 8,
    paddingTop: 2,
  },
  starters: {
    gap: 8,
  },
  bubble: {
    borderRadius: radii.card,
    padding: 10,
  },
  user: {
    alignSelf: "flex-end",
    backgroundColor: colors.lilacSoft,
    maxWidth: "86%",
  },
  assistant: {
    alignSelf: "flex-start",
    backgroundColor: colors.mist,
    maxWidth: "92%",
  },
  card: {
    borderColor: colors.border,
    borderRadius: radii.button,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
    padding: 8,
  },
  compose: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.input,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  input: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    minHeight: 44,
  },
});
