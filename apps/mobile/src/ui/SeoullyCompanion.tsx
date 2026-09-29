import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { usePathname, useRouter, useGlobalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../supabase";
import { useAskSurfaceOverlay } from "../ask-surface";
import { contextFromNativeRoute, isAskNavigationAction, mergeAskContext, nativeRouteLeaf, type AskNavigationAction } from "seoully-domain/ask-context";
import { useSocialRepository, type NativeAskCard } from "../data";
import { isExploreDestination } from "../explore";
import { useCopy, useLocale } from "../locale";
import { colors, elevation, radii, sizes } from "../theme";
import { pressShift, useReduceMotion } from "./motion";
import { SeoullyText } from "./SeoullyText";

const HEART = require("../../assets/brand/seoully-heart-mark.png");
const TAB_LEAF = new Set(["", "search", "create", "messages", "profile", "send-to", "notices", "index"]);
const HIDDEN_LEAF = new Set(["onboarding"]);

function cardActionLabel(action: AskNavigationAction, copy: ReturnType<typeof useCopy>) {
  if (action.type === "profile" || action.type === "profile_self") return copy.askViewProfile;
  if (action.type === "room") return copy.askEnterRoom;
  if (action.type === "search") return copy.askSearch;
  if (action.type === "collection") return copy.askViewCollection;
  if (action.type === "wishlist") return copy.askViewWishlist;
  if (action.type === "composer") return copy.askOpenComposer;
  if (action.type === "inbox" || action.type === "conversation") return copy.askOpenMessages;
  if (action.type === "add") return copy.askTakeMeThere;
  return copy.askTakeMeThere;
}

type ChatTurn = { role: "user" | "assistant"; content: string; cards?: NativeAskCard[] };

export function SeoullyCompanion() {
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  const overlay = useAskSurfaceOverlay();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const copy = useCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const context = mergeAskContext(contextFromNativeRoute(pathname, params as Record<string, string | string[] | undefined>), overlay);
  const [sessionReady, setSessionReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [bounce] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSessionReady(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionReady(Boolean(session));
    });
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      bounce.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(3600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, reduceMotion]);

  const visible = sessionReady && !HIDDEN_LEAF.has(nativeRouteLeaf(pathname));
  if (!visible) return null;

  const tabOffset = TAB_LEAF.has(nativeRouteLeaf(pathname)) ? sizes.tabBar + 8 : 16;
  const bottom = insets.bottom + tabOffset;

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

  async function send(raw?: string) {
    const prompt = (raw ?? question).trim();
    if (!prompt || pending) return;
    const history = turns.slice(-8).map(({ role, content }) => ({ role, content }));
    setTurns((current) => [...current, { role: "user" as const, content: prompt }].slice(-18));
    setQuestion("");
    setPending(true);
    setError(null);
    try {
      const result = await social.askSeoully(prompt, locale, history, context);
      setTurns((current) => [...current, { role: "assistant" as const, content: result.reply, cards: result.cards }].slice(-18));
    } catch {
      setError(copy.askSeoullyUnavailable);
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
          style={({ pressed }) => [styles.heartWrap, { bottom, right: 12 }, pressShift(pressed, reduceMotion)]}
        >
          <Animated.View style={{ transform: [{ translateY: bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
            <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HEART} style={styles.heart} />
          </Animated.View>
        </Pressable>
      </View>
      <Modal animationType={reduceMotion ? "none" : "slide"} onRequestClose={() => setOpen(false)} transparent visible={open}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modal}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.veil} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHead}>
              <SeoullyText variant="title">{copy.askSeoully}</SeoullyText>
              <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setOpen(false)}>
                <SeoullyText variant="button" color={colors.plum}>{copy.searchBack}</SeoullyText>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
              {turns.length === 0 ? (
                <View style={styles.starters}>
                  <SeoullyText variant="secondary">{copy.askSeoullyEmpty}</SeoullyText>
                  <Pressable accessibilityRole="button" onPress={() => { void send(locale === "ko" ? "아이템 찾아줘" : "Find collectibles"); }}>
                    <SeoullyText variant="button" color={colors.plum}>{copy.askStarterFind}</SeoullyText>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => { void send(locale === "ko" ? "내 컬렉션을 보여줘" : "What is in my collection?"); }}>
                    <SeoullyText variant="button" color={colors.plum}>{copy.askStarterCollection}</SeoullyText>
                  </Pressable>
                  <Pressable accessibilityRole="button" onPress={() => { void send(locale === "ko" ? "아이템을 어떻게 추가해?" : "How do I add a collectible?"); }}>
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
              {error ? <SeoullyText variant="caption" color={colors.plum}>{error}</SeoullyText> : null}
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
                style={styles.input}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={copy.askSeoullySend} onPress={() => { void send(); }}>
                <SeoullyText variant="button" color={colors.plum}>{copy.askSeoullySend}</SeoullyText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    minHeight: 280,
    paddingHorizontal: 16,
    paddingTop: 16,
    ...elevation.card,
  },
  sheetHead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  thread: {
    gap: 10,
    paddingBottom: 12,
    paddingTop: 4,
  },
  starters: {
    gap: 10,
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
