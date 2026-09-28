import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  loadNativeOnboarding,
  updateNativeOnboarding,
  type NativeOnboardingState,
  type NativeOnboardingStep,
} from "../src/api";
import { ScreenBack } from "../src/components/ScreenBack";
import { useCopy, useLocale } from "../src/locale";
import { colors } from "../src/theme";
import { BrandMark } from "../src/ui/BrandMark";
import { SeoullyButton, SeoullyChoiceChip } from "../src/ui/SeoullyControls";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

const INTERESTS = ["photocards", "albums", "merch", "everything"] as const;

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editingTastes = edit === "1";
  const t = useCopy();
  const { locale, toggleLocale } = useLocale();
  const [state, setState] = useState<NativeOnboardingState | null>(null);
  const [step, setStep] = useState<NativeOnboardingStep>("group");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [biasIds, setBiasIds] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>(["photocards"]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialUnavailable] = useState(() => t.onboardingUnavailable);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const next = await loadNativeOnboarding();
      if (next.step === "done" && !editingTastes) {
        router.replace("/(tabs)");
        return;
      }
      setState(next);
      setStep(next.step === "done" && editingTastes ? "group" : next.step);
      setGroupIds(next.favoriteGroupIds);
      setBiasIds(next.biasMemberIds);
      if (next.collectorInterests.length > 0) setInterests(next.collectorInterests);
    } catch {
      setError(t.onboardingUnavailable);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    void loadNativeOnboarding()
      .then((next) => {
        if (!mounted) return;
        if (next.step === "done" && !editingTastes) {
          router.replace("/(tabs)");
          return;
        }
        setState(next);
        setStep(next.step === "done" && editingTastes ? "group" : next.step);
        setGroupIds(next.favoriteGroupIds);
        setBiasIds(next.biasMemberIds);
        if (next.collectorInterests.length > 0) setInterests(next.collectorInterests);
      })
      .catch(() => {
        if (mounted) setError(initialUnavailable);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [editingTastes, initialUnavailable, router]);

  const members = useMemo(
    () => state?.members.filter((member) => groupIds.includes(member.groupId)) ?? [],
    [groupIds, state],
  );

  async function advance() {
    setSaving(true);
    setError(null);
    try {
      const result = step === "group"
        ? await updateNativeOnboarding({ action: "groups", favoriteGroupIds: groupIds })
        : step === "bias"
          ? await updateNativeOnboarding({ action: "bias", biasMemberIds: biasIds })
          : await updateNativeOnboarding({ action: "interests", collectorInterests: interests });
      if (editingTastes) {
        if (step === "group") setStep("bias");
        else if (step === "bias") setStep("interest");
        else router.back();
        return;
      }
      if (result.step === "done") {
        router.replace("/(tabs)");
        return;
      }
      setStep(result.step);
    } catch {
      setError(t.onboardingSaveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <SeoullyScreen><SeoullyLoadingState label={t.brand} /></SeoullyScreen>;
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

  const title = step === "group"
    ? t.onboardingGroupTitle
    : step === "bias"
      ? t.onboardingBiasTitle
      : t.onboardingInterestTitle;
  const lead = step === "group"
    ? t.onboardingGroupLead
    : step === "bias"
      ? t.onboardingBiasLead
      : t.onboardingInterestLead;

  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        {editingTastes ? <ScreenBack label={t.back} onPress={() => router.back()} /> : null}
        <View style={styles.topline}>
          <BrandMark />
          <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
            <SeoullyText variant="button">{t.switchLanguage}</SeoullyText>
          </Pressable>
        </View>
        <SeoullyText variant="caption" color={colors.plum} style={styles.step}>
          {step === "group" ? "1 / 3" : step === "bias" ? "2 / 3" : "3 / 3"}
        </SeoullyText>
        <SeoullyText variant="title">{title}</SeoullyText>
        <SeoullyText variant="secondary" style={styles.lead}>{lead}</SeoullyText>

        <View style={styles.chips}>
          {step === "group" && state.groups.map((group) => (
            <SeoullyChoiceChip
              key={group.id}
              role="checkbox"
              selected={groupIds.includes(group.id)}
              label={locale === "ko" ? group.nativeName : group.name}
              onPress={() => setGroupIds((items) => toggle(items, group.id))}
            />
          ))}
          {step === "bias" && members.map((member) => (
            <SeoullyChoiceChip
              key={member.id}
              role="checkbox"
              selected={biasIds.includes(member.id)}
              label={locale === "ko" ? member.nativeName : member.stageName}
              onPress={() => setBiasIds((items) => toggle(items, member.id))}
            />
          ))}
          {step === "interest" && INTERESTS.map((interest) => (
            <SeoullyChoiceChip
              key={interest}
              role="checkbox"
              selected={interests.includes(interest)}
              label={t[interest]}
              onPress={() => setInterests((items) => toggle(items, interest))}
            />
          ))}
        </View>

        <View style={styles.footer}>
          <SeoullyButton
            label={saving
              ? t.saving
              : ((step === "group" && groupIds.length === 0) || (step === "bias" && biasIds.length === 0)
                ? t.skipForNow
                : t.continue)}
            disabled={saving || (step === "interest" && interests.length === 0)}
            block
            onPress={() => { void advance(); }}
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
  step: { marginTop: 24 },
  lead: { marginTop: 6, maxWidth: 320 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 24 },
  footer: { gap: 12, marginTop: "auto", paddingTop: 24 },
});
