import { readSelectedCatalogIdentity } from "../src/data/collectorIdentity";
import { readOnboardingIdentityDraft, saveOnboardingIdentityDraft, clearOnboardingIdentityDraft } from "../src/onboarding/identityDraft";
import { ProfileTastePicker, type TasteOption } from "../src/ui/ProfileTastePicker";
import { HeartFarewell } from "../src/ui/HeartFarewell";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  loadMyHolding,
  loadNativeOnboarding,
  readProfileCapabilities,
  updateNativeOnboarding,
  type NativeHolding,
  type NativeOnboardingState,
} from "../src/api";
import { ScreenBack } from "../src/components/ScreenBack";
import { useDataMode } from "../src/data";
import { isBinderEligible } from "../src/data/ownership";
import { useCopy } from "../src/locale";
import {
  ONBOARDING_INTERESTS,
  resolveOnboardingPhase,
  type OnboardingPhase,
} from "../src/onboarding/journey";
import { colors } from "../src/theme";
import { readFirstCollectibleDraft } from "../src/onboarding/firstCollectibleStorage";
import { SeoullyButton, SeoullyChoiceChip } from "../src/ui/SeoullyControls";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { useBootstrap } from "../src/startup/BootstrapProvider";
import { SeoullyMessageScreen } from "../src/ui/SeoullyMessageScreen";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

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
  const { setDemo } = useDataMode();
  const boot = useBootstrap();
  const loadGeneration = useRef(0);
  const savingIdentity = useRef(false);
  const [state, setState] = useState<NativeOnboardingState | null>(null);
  const [phase, setPhase] = useState<OnboardingPhase>("group");
  const [greeted, setGreeted] = useState<Set<OnboardingPhase>>(() => new Set());
  const [identityUserId, setIdentityUserId] = useState("");
  const [canContribute, setCanContribute] = useState(false);
  const [groupOptions, setGroupOptions] = useState<TasteOption[]>([]);
  const [biasOptions, setBiasOptions] = useState<TasteOption[]>([]);
  const [tastePending, setTastePending] = useState(0);
  const tasteBusyChanged = useCallback((active: boolean) => setTastePending(n => Math.max(0, n + (active ? 1 : -1))), []);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [biasIds, setBiasIds] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>(["photocards"]);
  const [holding, setHolding] = useState<NativeHolding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setState(null);
    setError(null);
    try {
      if (!editingTastes) setDemo(false);
      const [next, capabilities] = await Promise.all([
        loadNativeOnboarding(), readProfileCapabilities(),
      ]);
      const userId = next.userId;
      if (!userId) throw new Error("unauthenticated");
      if (generation !== loadGeneration.current) return;
      if (next.step === "done" && !editingTastes) {
        boot.enterApp();
        router.replace("/(tabs)");
        return;
      }
      let confirmedHolding: NativeHolding | null = null;
      if (!editingTastes && next.step === "interest") {
        const pending = await readFirstCollectibleDraft();
        if (generation !== loadGeneration.current) return;
        if (pending) {
          router.replace({ pathname: "/add", params: { templateId: pending.templateId, name: pending.templateInfo?.name ?? "", kind: pending.templateInfo?.kind ?? "", from: "onboarding", ...(pending.newTemplate ? { newTemplate: "true" } : {}) } });
          return;
        }
        if (next.firstHome?.holdingId) {
          confirmedHolding = await loadMyHolding(next.firstHome.holdingId);
          if (!confirmedHolding) throw new Error("first_holding_unavailable");
        }
      }
      if (generation !== loadGeneration.current) return;
      const resolved = resolveOnboardingPhase({
        durableStep: next.step === "done" && editingTastes ? "done" : next.step,
        editingTastes,
        holdingCount: confirmedHolding ? 1 : 0,
        requestedPhase: typeof params.phase === "string" ? params.phase : null,
        interestsSaved: next.collectorInterests.length > 0,
      });
      if (resolved === "app") {
        boot.enterApp();
        router.replace("/(tabs)");
        return;
      }
      const draft = !editingTastes && (resolved === "group" || resolved === "bias")
        ? await readOnboardingIdentityDraft(userId) : null;
      const restoredGroups = draft?.groupIds ?? next.favoriteGroupIds;
      const restoredBiases = draft?.biasIds ?? next.biasMemberIds;
      const selected = await readSelectedCatalogIdentity(restoredGroups, restoredBiases);
      if (generation !== loadGeneration.current) return;
      setIdentityUserId(userId);
      setCanContribute(capabilities.catalogIdentityContributions);
      setGroupOptions([...next.groups.map(g => ({ id: g.id, name: g.name })), ...selected.groups]);
      setBiasOptions([...next.members.map(m => ({ id: m.id, name: m.stageName, groupId: m.groupId })), ...selected.members.map(m => ({ id: m.id, name: m.stageName, groupId: m.groupId, groupName: m.groupName }))]);
      setState(next);
      setPhase(resolved === "edit" ? "group" : resolved);
      setGroupIds(restoredGroups);
      setBiasIds(restoredBiases);
      if (next.collectorInterests.length > 0) setInterests(next.collectorInterests);
      setHolding(confirmedHolding);
    } catch {
      if (generation === loadGeneration.current) setError(t.onboardingUnavailable);
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }

  useFocusEffect(useCallback(() => {
    void load();
    return () => { loadGeneration.current++; };
    // First-run identity is Live. Demo stays a post-arrival explorer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTastes, params.phase, params.holdingId]));

  useEffect(() => {
    if (phase !== "collect" || editingTastes || !greeted.has("collect")) return;
    router.replace({ pathname: "/collect", params: { from: "onboarding" } });
  }, [editingTastes, greeted, phase, router]);

  function changeTastes(groups: string[], biases: string[]) {
    setGroupIds(groups);
    setBiasIds(biases);
    return saveOnboardingIdentityDraft(identityUserId, { groupIds: groups, biasIds: biases })
      .catch(error => { setError(t.onboardingSaveFailed); throw error; });
  }

  async function advanceIdentity() {
    if (!state || savingIdentity.current || tastePending > 0) return;
    savingIdentity.current = true;
    setSaving(true);
    setError(null);
    try {
      await saveOnboardingIdentityDraft(identityUserId, { groupIds, biasIds });
      const action = phase === "group" ? "groups" as const : phase === "bias" ? "bias" as const : "interests" as const;
      if (action === "groups") {
        await updateNativeOnboarding({ action: "groups", favoriteGroupIds: groupIds });
        setState(previous => previous ? { ...previous, favoriteGroupIds: groupIds } : previous);
      } else if (action === "bias") {
        // Back/edit interruption can leave an unsaved group draft at the Biases
        // checkpoint. Confirm it before saving members; never lose that choice.
        if (JSON.stringify(groupIds) !== JSON.stringify(state.favoriteGroupIds)) {
          await updateNativeOnboarding({ action: "groups", favoriteGroupIds: groupIds });
          setState(previous => previous ? { ...previous, favoriteGroupIds: groupIds } : previous);
        }
        await updateNativeOnboarding({ action: "bias", biasMemberIds: biasIds });
      } else {
        await updateNativeOnboarding({ action: "interests", collectorInterests: interests });
        await clearOnboardingIdentityDraft(identityUserId);
      }
      if (editingTastes) {
        if (phase === "group") setPhase("bias");
        else if (phase === "bias") setPhase("interest");
        else router.back();
        return;
      }
      if (action === "interests") {
        setPhase(holding ? "room" : "collect");
        return;
      }
      if (action === "groups") setPhase("bias");
      else setPhase("interest");
    } catch {
      setError(t.onboardingSaveFailed);
    } finally {
      savingIdentity.current = false;
      setSaving(false);
    }
  }

  function backIdentity() {
    if (phase === "bias") setPhase("group");
    else if (phase === "interest") setPhase("bias");
  }

  function finish() {
    boot.enterApp();
    router.replace("/(tabs)");
  }

  if (loading || (phase === "collect" && greeted.has("collect"))) {
    return <SeoullyLoadingState fullScreen label={t.brand} />;
  }

  if (!state) {
    return (
      <SeoullyMessageScreen message={error} alert>
        <SeoullyButton label={t.retry} block multiline onPress={() => { void load(); }} />
      </SeoullyMessageScreen>
    );
  }

  if (phase === "room") {
    return (
      <View style={styles.world}>
        <Suspense fallback={<SeoullyLoadingState fullScreen label={t.room} />}>
          <OnboardingWorldIntro
            holdingId={holding?.id}
            photocard={holding ? isBinderEligible(holding) : false}
            copy={t}
            onContinue={finish}
            onBack={() => setPhase("interest")}
          />
        </Suspense>
      </View>
    );
  }

  const title = phase === "group"
    ? t.profileFavoriteGroups
    : phase === "bias"
      ? t.profileBiases
      : t.onboardingInterestTitle;
  const lead = phase === "group"
    ? t.onboardingGroupLead
    : phase === "bias"
      ? t.onboardingBiasLead
      : t.onboardingInterestLead;

  if (!editingTastes && !greeted.has(phase)) return <View style={styles.world}>
    <HeartFarewell destination="next" text={phase === "collect" ? t.onboardCollectFirstTitle : title} onContinue={() => setGreeted(previous => new Set(previous).add(phase))} />
  </View>;

  return (
    <SeoullyScreen edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.container}>
        {editingTastes || phase === "bias" || phase === "interest" ? (
          <ScreenBack label={t.back} onPress={() => (editingTastes && phase === "group" ? router.back() : backIdentity())} />
        ) : null}
        <SeoullyText variant="title" style={styles.headline}>{title}</SeoullyText>
        <SeoullyText variant="secondary" style={styles.lead}>{lead}</SeoullyText>

        {phase === "group" ? <ProfileTastePicker showHeading={false} kind="groups" selected={groupIds}
          onChange={ids => changeTastes(ids, biasIds)} initialOptions={groupOptions}
          canContribute={canContribute} userId={identityUserId} onBusyChange={tasteBusyChanged} disabled={saving} /> : null}
        {phase === "bias" ? <ProfileTastePicker showHeading={false} kind="biases" selected={biasIds}
          onChange={ids => changeTastes(groupIds, ids)} initialOptions={biasOptions} preferredGroups={groupIds}
          canContribute={canContribute} userId={identityUserId} onBusyChange={tasteBusyChanged} disabled={saving} /> : null}
        <View style={styles.chips}>
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
            disabled={saving || tastePending > 0 || (phase === "interest" && interests.length === 0)}
            block
            onPress={() => { void advanceIdentity(); }}
          />
          {error ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{error}</SeoullyText> : null}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 16, paddingHorizontal: 24 },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  language: { justifyContent: "center", minHeight: 44, paddingHorizontal: 4 },
  headline: { marginTop: 32, fontSize: 32, lineHeight: 38 },
  lead: { marginTop: 6, maxWidth: 340 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 20, paddingBottom: 24 },
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
