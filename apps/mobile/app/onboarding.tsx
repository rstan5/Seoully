import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  loadMyHolding,
  loadMyHoldings,
  loadNativeOnboarding,
  updateNativeOnboarding,
  type NativeHolding,
  type NativeOnboardingState,
} from "../src/api";
import { ScreenBack } from "../src/components/ScreenBack";
import { useDataMode, useSocialRepository, type SocialSuggested } from "../src/data";
import { isBinderEligible } from "../src/data/ownership";
import { useCopy, useLocale } from "../src/locale";
import {
  ONBOARDING_INTERESTS,
  resolveOnboardingPhase,
  type OnboardingPhase,
} from "../src/onboarding/journey";
import { colors } from "../src/theme";
import { BrandMark } from "../src/ui/BrandMark";
import { SeoullyAvatar } from "../src/ui/SeoullyAvatar";
import { SeoullyButton, SeoullyChoiceChip } from "../src/ui/SeoullyControls";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { useBootstrap } from "../src/startup/BootstrapProvider";
import { useReduceMotion } from "../src/ui/motion";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

const HEART = require("../assets/brand/seoully-heart-mark.png");
const OnboardingWorldIntro = lazy(() => import("../src/onboarding/OnboardingWorldIntro"));

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

function interestLabel(id: string, t: ReturnType<typeof useCopy>) {
  if (id === "vinyl") return t.interestVinyl;
  if (id === "posters") return t.interestPosters;
  if (id === "lightsticks") return t.interestLightsticks;
  if (id === "photocards") return t.photocards;
  if (id === "albums") return t.albums;
  if (id === "merch") return t.merch;
  return t.everything;
}

export default function OnboardingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string; phase?: string; holdingId?: string; photoWarning?: string }>();
  const editingTastes = params.edit === "1";
  const t = useCopy();
  const { locale, toggleLocale } = useLocale();
  const reduceMotion = useReduceMotion();
  const social = useSocialRepository();
  const { setDemo } = useDataMode();
  const boot = useBootstrap();
  const [state, setState] = useState<NativeOnboardingState | null>(null);
  const [phase, setPhase] = useState<OnboardingPhase>("group");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [biasIds, setBiasIds] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>(["photocards"]);
  const [holding, setHolding] = useState<NativeHolding | null>(null);
  const [people, setPeople] = useState<SocialSuggested[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoWarning] = useState(params.photoWarning === "1");
  const [revealOpacity] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  async function load() {
    setLoading(true);
    setError(null);
    try {
      if (!editingTastes) setDemo(false);
      const next = await loadNativeOnboarding();
      if (next.step === "done" && !editingTastes) {
        router.replace("/(tabs)");
        return;
      }
      let holdings: NativeHolding[] = [];
      let hinted: NativeHolding | null = null;
      if (!editingTastes && next.step === "interest") {
        try {
          holdings = await loadMyHoldings(0, 20);
        } catch {
          holdings = [];
        }
        if (typeof params.holdingId === "string" && params.holdingId) {
          hinted = holdings.find((item) => item.id === params.holdingId) ?? await loadMyHolding(params.holdingId).catch(() => null);
        }
      }
      const resolved = resolveOnboardingPhase({
        durableStep: next.step === "done" && editingTastes ? "done" : next.step,
        editingTastes,
        holdingCount: holdings.length,
        requestedPhase: typeof params.phase === "string" ? params.phase : null,
        hasHoldingHint: Boolean(hinted || params.holdingId),
        interestsSaved: next.collectorInterests.length > 0,
      });
      if (resolved === "app") {
        router.replace("/(tabs)");
        return;
      }
      setState(next);
      setPhase(resolved === "edit" ? "group" : resolved);
      setGroupIds(next.favoriteGroupIds);
      setBiasIds(next.biasMemberIds);
      if (next.collectorInterests.length > 0) setInterests(next.collectorInterests);
      setHolding(hinted ?? holdings[0] ?? null);
    } catch {
      setError(t.onboardingUnavailable);
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => { void load(); }, 0);
    return () => clearTimeout(timer);
    // First-run identity is Live. Demo stays a post-arrival explorer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTastes, params.phase, params.holdingId]));

  useEffect(() => {
    if (phase !== "collect" || editingTastes) return;
    router.replace({ pathname: "/collect", params: { from: "onboarding" } });
  }, [editingTastes, phase, router]);

  useEffect(() => {
    if (phase !== "reveal") return;
    revealOpacity.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;
    const anim = Animated.timing(revealOpacity, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [phase, reduceMotion, revealOpacity]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const timer = setTimeout(() => setPhase("room"), reduceMotion ? 1600 : 2200);
    return () => clearTimeout(timer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== "meet" || social.kind !== "production") return;
    let mounted = true;
    void social.loadSuggested().then((items) => {
      if (mounted) setPeople(items.slice(0, 3));
    }).catch(() => {
      if (mounted) setPeople([]);
    });
    return () => {
      mounted = false;
    };
  }, [phase, social]);

  const members = useMemo(
    () => state?.members.filter((member) => groupIds.includes(member.groupId)) ?? [],
    [groupIds, state],
  );

  async function advanceIdentity() {
    if (!state) return;
    setSaving(true);
    setError(null);
    try {
      const action = phase === "group" ? "groups" as const : phase === "bias" ? "bias" as const : "interests" as const;
      if (action === "groups") await updateNativeOnboarding({ action: "groups", favoriteGroupIds: groupIds });
      else if (action === "bias") await updateNativeOnboarding({ action: "bias", biasMemberIds: biasIds });
      else await updateNativeOnboarding({ action: "interests", collectorInterests: interests });
      if (editingTastes) {
        if (phase === "group") setPhase("bias");
        else if (phase === "bias") setPhase("interest");
        else router.back();
        return;
      }
      if (action === "interests") {
        setPhase("collect");
        return;
      }
      if (action === "groups") setPhase(groupIds.length > 0 ? "bias" : "interest");
      else setPhase("interest");
    } catch {
      setError(t.onboardingSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  function backIdentity() {
    if (phase === "bias") setPhase("group");
    else if (phase === "interest") setPhase("bias");
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      await updateNativeOnboarding({ action: "complete" });
      boot.enterApp();
      router.replace("/(tabs)");
    } catch {
      setError(t.onboardingSaveFailed);
      setSaving(false);
    }
  }

  async function openCollector(userId: string) {
    setSaving(true);
    setError(null);
    try {
      await updateNativeOnboarding({ action: "complete" });
      boot.enterApp();
      router.replace({ pathname: "/collector", params: { userId } });
    } catch {
      setError(t.onboardingSaveFailed);
      setSaving(false);
    }
  }

  if (loading || phase === "collect") {
    return <SeoullyLoadingState fullScreen label={t.brand} />;
  }

  if (!state) {
    return (
      <SeoullyScreen>
        <View style={styles.centered}>
          <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{error}</SeoullyText>
          <SeoullyButton label={t.retry} block onPress={() => { void load(); }} />
        </View>
      </SeoullyScreen>
    );
  }

  if (phase === "room") {
    return (
      <View style={styles.world}>
        <Suspense fallback={<SeoullyLoadingState label={t.room} />}>
          <OnboardingWorldIntro
            holdingId={holding?.id ?? (typeof params.holdingId === "string" ? params.holdingId : undefined)}
            photocard={holding ? isBinderEligible(holding) : false}
            copy={t}
            onContinue={() => setPhase("meet")}
          />
        </Suspense>
      </View>
    );
  }

  if (phase === "reveal") {
    const preview = holding?.personalMediaUrl;
    return (
      <SeoullyScreen>
        <Animated.View style={[styles.container, { opacity: revealOpacity }]}>
          <View style={styles.topline}>
            <BrandMark />
            <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
              <SeoullyText variant="button">{t.switchLanguage}</SeoullyText>
            </Pressable>
          </View>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HEART} style={styles.heart} />
          <SeoullyText variant="title">{t.onboardRevealTitle}</SeoullyText>
          <SeoullyText variant="secondary" style={styles.lead}>{t.onboardRevealLede}</SeoullyText>
          {preview ? (
            <Image
              accessibilityLabel={holding?.template.name ?? t.personalPreview}
              resizeMode="contain"
              source={{ uri: preview }}
              style={holding?.template.kind === "photocard" ? styles.cardPreview : styles.preview}
            />
          ) : (
            <View style={styles.object}>
              <SeoullyText variant="handle" color={colors.plum}>{holding?.template.name ?? t.catalogItemFallback}</SeoullyText>
              <SeoullyText variant="caption">{t.roomEligibleHint}</SeoullyText>
            </View>
          )}
          {photoWarning ? <SeoullyText variant="caption" color={colors.plum}>{t.onboardPhotoLater}</SeoullyText> : null}
          <View style={styles.footer}>
            <SeoullyButton label={t.onboardOpenRoom} block onPress={() => setPhase("room")} />
          </View>
        </Animated.View>
      </SeoullyScreen>
    );
  }

  if (phase === "meet") {
    return (
      <SeoullyScreen>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topline}>
            <BrandMark />
            <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
              <SeoullyText variant="button">{t.switchLanguage}</SeoullyText>
            </Pressable>
          </View>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={HEART} style={styles.heart} />
          <SeoullyText variant="title">{t.onboardMeetTitle}</SeoullyText>
          <SeoullyText variant="secondary" style={styles.lead}>{t.onboardMeetLede}</SeoullyText>
          <SeoullyText variant="caption" color={colors.plum} style={styles.ask}>{t.onboardAskHelp}</SeoullyText>
          {people.length === 0 ? (
            <SeoullyText variant="secondary" style={styles.lead}>{t.onboardMeetEmpty}</SeoullyText>
          ) : people.map((person) => (
            <Pressable
              key={person.user.userId}
              accessibilityRole="button"
              onPress={() => { void openCollector(person.user.userId); }}
              style={styles.person}
            >
              <SeoullyAvatar name={person.user.displayName} imageUrl={person.avatarUrl} />
              <View style={styles.personCopy}>
                <SeoullyText variant="body">{person.user.displayName}</SeoullyText>
                <SeoullyText variant="caption">@{person.user.handle}</SeoullyText>
                {person.subtitle ? <SeoullyText variant="caption" color={colors.plum}>{person.subtitle}</SeoullyText> : person.meta ? <SeoullyText variant="caption" color={colors.plum}>{person.meta}</SeoullyText> : null}
              </View>
            </Pressable>
          ))}
          <View style={styles.footer}>
            <SeoullyButton
              label={saving ? t.saving : t.onboardFindPeople}
              disabled={saving}
              block
              onPress={() => { void finish(); }}
            />
            {error ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{error}</SeoullyText> : null}
          </View>
        </ScrollView>
      </SeoullyScreen>
    );
  }

  const title = phase === "group"
    ? t.onboardingGroupTitle
    : phase === "bias"
      ? t.onboardingBiasTitle
      : t.onboardingInterestTitle;
  const lead = phase === "group"
    ? t.onboardingGroupLead
    : phase === "bias"
      ? t.onboardingBiasLead
      : t.onboardingInterestLead;

  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        {editingTastes || phase === "bias" || phase === "interest" ? (
          <ScreenBack label={t.back} onPress={() => (editingTastes && phase === "group" ? router.back() : backIdentity())} />
        ) : null}
        <View style={styles.topline}>
          <BrandMark />
          <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
            <SeoullyText variant="button">{t.switchLanguage}</SeoullyText>
          </Pressable>
        </View>
        <SeoullyText variant="title" style={styles.headline}>{title}</SeoullyText>
        <SeoullyText variant="secondary" style={styles.lead}>{lead}</SeoullyText>

        <View style={styles.chips}>
          {phase === "group" && state.groups.map((group) => (
            <SeoullyChoiceChip
              key={group.id}
              role="checkbox"
              selected={groupIds.includes(group.id)}
              label={locale === "ko" ? group.nativeName : group.name}
              onPress={() => setGroupIds((items) => toggle(items, group.id))}
            />
          ))}
          {phase === "bias" && members.map((member) => (
            <SeoullyChoiceChip
              key={member.id}
              role="checkbox"
              selected={biasIds.includes(member.id)}
              label={locale === "ko" ? member.nativeName : member.stageName}
              onPress={() => setBiasIds((items) => toggle(items, member.id))}
            />
          ))}
          {phase === "interest" && ONBOARDING_INTERESTS.map((interest) => (
            <SeoullyChoiceChip
              key={interest}
              role="checkbox"
              selected={interests.includes(interest)}
              label={interestLabel(interest, t)}
              onPress={() => setInterests((items) => toggle(items, interest))}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <SeoullyButton
            label={saving
              ? t.saving
              : ((phase === "group" && groupIds.length === 0) || (phase === "bias" && biasIds.length === 0)
                ? t.skipForNow
                : t.continue)}
            disabled={saving || (phase === "interest" && interests.length === 0)}
            block
            onPress={() => { void advanceIdentity(); }}
          />
          {error ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{error}</SeoullyText> : null}
        </View>
      </ScrollView>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 40, paddingHorizontal: 16 },
  centered: { flex: 1, gap: 16, justifyContent: "center", paddingHorizontal: 16 },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  language: { justifyContent: "center", minHeight: 44, paddingHorizontal: 4 },
  headline: { marginTop: 24 },
  lead: { marginTop: 6, maxWidth: 340 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 },
  footer: { gap: 12, marginTop: "auto", paddingTop: 24 },
  heart: { height: 48, marginTop: 28, width: 48 },
  ask: { marginTop: 10 },
  preview: { alignSelf: "center", borderRadius: 14, height: 220, marginTop: 20, width: 160 },
  cardPreview: { alignSelf: "center", aspectRatio: 55 / 85, borderRadius: 10, marginTop: 20, width: "52%" },
  object: {
    backgroundColor: colors.mist,
    borderRadius: 16,
    gap: 6,
    marginTop: 20,
    padding: 18,
  },
  person: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    minHeight: 72,
    paddingHorizontal: 12,
  },
  personCopy: { flex: 1, gap: 2 },
  world: { flex: 1 },
});
