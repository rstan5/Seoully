import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  loadNativeOnboarding,
  updateNativeOnboarding,
  type NativeOnboardingState,
  type NativeOnboardingStep,
} from "../src/api";
import { useCopy, useLocale } from "../src/locale";
import { colors, spacing } from "../src/theme";

const INTERESTS = ["photocards", "albums", "merch", "everything"] as const;

function toggle(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export default function OnboardingScreen() {
  const router = useRouter();
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
      if (next.step === "done") {
        router.replace("/(tabs)");
        return;
      }
      setState(next);
      setStep(next.step);
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
        if (next.step === "done") {
          router.replace("/(tabs)");
          return;
        }
        setState(next);
        setStep(next.step);
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
  }, [initialUnavailable, router]);

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
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  if (!state) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
          <Pressable accessibilityRole="button" onPress={load} style={styles.primary}>
            <Text style={styles.primaryText}>{t.retry}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topline}>
          <Text style={styles.brand}>{t.brand} ♡</Text>
          <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
            <Text style={styles.languageText}>{t.switchLanguage}</Text>
          </Pressable>
        </View>
        <Text style={styles.step}>{step === "group" ? "1 / 3" : step === "bias" ? "2 / 3" : "3 / 3"}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.lead}>{lead}</Text>

        <View style={styles.chips}>
          {step === "group" && state.groups.map((group) => {
            const selected = groupIds.includes(group.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={group.id}
                onPress={() => setGroupIds((items) => toggle(items, group.id))}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {locale === "ko" ? group.nativeName : group.name}
                </Text>
              </Pressable>
            );
          })}
          {step === "bias" && members.map((member) => {
            const selected = biasIds.includes(member.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={member.id}
                onPress={() => setBiasIds((items) => toggle(items, member.id))}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {locale === "ko" ? member.nativeName : member.stageName}
                </Text>
              </Pressable>
            );
          })}
          {step === "interest" && INTERESTS.map((interest) => {
            const selected = interests.includes(interest);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={interest}
                onPress={() => setInterests((items) => toggle(items, interest))}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {t[interest]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={saving || (step === "interest" && interests.length === 0)}
          onPress={advance}
          style={[styles.primary, (saving || (step === "interest" && interests.length === 0)) && styles.disabled]}
        >
          {saving
            ? <ActivityIndicator color={colors.surface} />
            : <Text style={styles.primaryText}>
                {(step === "group" && groupIds.length === 0) || (step === "bias" && biasIds.length === 0)
                  ? t.skipForNow
                  : t.continue}
              </Text>}
        </Pressable>
        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  centered: { flex: 1, justifyContent: "center", padding: spacing.lg },
  container: { flexGrow: 1, padding: spacing.lg },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  brand: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  language: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  languageText: { color: colors.plum, fontWeight: "700" },
  step: { color: colors.plum, fontSize: 13, fontWeight: "700", marginTop: spacing.xl },
  title: { color: colors.ink, fontSize: 34, fontWeight: "700", letterSpacing: -0.8, marginTop: spacing.xs },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
  chip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipSelected: { backgroundColor: colors.plum, borderColor: colors.plum },
  chipText: { color: colors.ink, fontSize: 15, fontWeight: "600" },
  chipTextSelected: { color: colors.surface },
  primary: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 16, justifyContent: "center", minHeight: 54, marginTop: "auto" },
  primaryText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  error: { color: colors.plum, lineHeight: 20, marginTop: spacing.md, textAlign: "center" },
});
