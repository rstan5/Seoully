import { useBootstrap } from "../src/startup/BootstrapProvider";
import { onboardingHeading, onboardingDescription } from "../src/onboarding/presentation";
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { type NativeCatalogTemplate } from "../src/api";
import { queueFirstCollectible } from "../src/onboarding/firstCollectibleStorage";
import { submitManualCatalog } from "../src/manualCatalog";
import { useSocialRepository } from "../src/data";
import { KeyboardScreen } from "../src/components/KeyboardScreen";
import { ScreenBack } from "../src/components/ScreenBack";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy } from "../src/locale";
import { colors } from "../src/theme";
import { SeoullyButton, SeoullyChoiceChip } from "../src/ui/SeoullyControls";
import { SeoullyField } from "../src/ui/SeoullyField";
import { SeoullyShelfRow } from "../src/ui/SeoullyProfile";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

const COLLECTIBLE_KINDS = ["photocard", "album", "vinyl", "poster", "lightstick", "plushie", "figure", "book", "apparel", "memorabilia"] as const;

type Step = "entry" | "search" | "manual";

export default function CollectScreen() {
  const copy = useCopy();
  const router = useRouter();
  const boot = useBootstrap();
  const social = useSocialRepository();
  const params = useLocalSearchParams<{ from?: string }>();
  const fromOnboarding = params.from === "onboarding";
  const [step, setStep] = useState<Step>("entry");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<NativeCatalogTemplate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [versionName, setVersionName] = useState("");
  const [kind, setKind] = useState<(typeof COLLECTIBLE_KINDS)[number]>("photocard");
  const submitting = useRef(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (step !== "search") return;
    const text = query.trim();
    if (!text) return;
    const timer = setTimeout(() => {
      setSearching(true);
      void social.searchCatalog(text).then((results) => {
        setHits(results);
        setSearchError(null);
      }).catch(() => {
        setHits([]);
        setSearchError(copy.catalogUnavailable);
      }).finally(() => setSearching(false));
    }, 180);
    return () => clearTimeout(timer);
  }, [copy.catalogUnavailable, query, social, step]);

  function updateQuery(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setHits([]);
      setSearchError(null);
    }
  }

  async function openPhoto(template: NativeCatalogTemplate, extra?: { newTemplate?: string }) {
    if (fromOnboarding) await queueFirstCollectible(template.id, Boolean(extra?.newTemplate), template);
    router.push({
      pathname: "/add",
      params: {
        templateId: template.id,
        name: template.name,
        kind: template.kind,
        groupName: template.groupName,
        memberName: template.memberName ?? "",
        releaseName: template.releaseName ?? "",
        ...(extra?.newTemplate ? { newTemplate: "true" } : {}),
        ...(fromOnboarding ? { from: "onboarding" } : {}),
      },
    });
  }

  async function submitManual() {
    if (social.kind === "demo") return setMessage(copy.demoWriteBlocked);
    if (!name.trim()) return setMessage(copy.collectibleNameRequired);
    if (!groupName.trim()) return setMessage(copy.groupNameRequired);
    if (submitting.current) return;
    submitting.current = true;
    setWorking(true);
    setMessage(null);
    try {
      const result = await submitManualCatalog({
        name: name.trim(),
        groupName: groupName.trim(),
        memberName: memberName.trim() || undefined,
        releaseName: releaseName.trim() || undefined,
        kind,
        ...(versionName.trim() ? { descriptor: versionName.trim() } : {}),
      }, fromOnboarding ? async (accepted) => { await queueFirstCollectible(accepted.contribution.template.id, true, accepted.contribution.template); } : undefined);
      await openPhoto(result.contribution.template, { newTemplate: "true" });
    } catch {
      setMessage(copy.collectibleCreateFailed);
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }

  return (
    <SeoullyScreen>
      <KeyboardScreen>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <ScreenBack disabled={working} label={copy.back} onPress={() => {
            if (step !== "entry") { setStep("entry"); return; }
            if (fromOnboarding && boot.onboardingStep === "done") { boot.enterApp("discover"); return; }
            if (fromOnboarding) router.replace({ pathname: "/onboarding", params: { phase: "interest", back: "1" } });
            else router.back();
          }} />

          {step === "entry" ? (
            <View style={[styles.entry, fromOnboarding ? { paddingTop: 0 } : null]}>
              <SeoullyText variant="title" style={[styles.headline, fromOnboarding ? onboardingHeading : null]}>{fromOnboarding ? copy.onboardCollectFirstTitle : copy.catalogEntryTitle}</SeoullyText>
              <SeoullyText variant="secondary" style={[styles.lede, fromOnboarding ? onboardingDescription : null]}>{fromOnboarding ? copy.onboardCollectFirstLede : copy.catalogEntryLede}</SeoullyText>
              <View style={styles.choices}>
                <Pressable accessibilityRole="button" onPress={() => setStep("search")} style={({ pressed }) => [styles.choice, styles.catalogChoice, pressed && styles.choicePressed]}>
                  <SeoullyText variant="button" color={colors.onPrimary} style={styles.choiceTitle}>{copy.searchSeoullyCatalog}</SeoullyText>
                  <SeoullyText variant="secondary" color={colors.onPrimary} style={styles.choiceCopy}>{copy.searchSeoullyCatalogLede}</SeoullyText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => setStep("manual")} style={({ pressed }) => [styles.choice, styles.manualChoice, pressed && styles.choicePressed]}>
                  <SeoullyText variant="button" color={colors.plum} style={styles.choiceTitle}>{copy.addManuallyTitle}</SeoullyText>
                  <SeoullyText variant="secondary" color={colors.plum} style={styles.choiceCopy}>{copy.addManuallyLede}</SeoullyText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "search" ? (
            <View>
              <SeoullyText variant="title" style={[styles.headline, fromOnboarding ? onboardingHeading : null]}>{copy.searchSeoullyCatalog}</SeoullyText>
              <SeoullyText variant="secondary" style={[styles.lede, fromOnboarding ? onboardingDescription : null]}>{copy.catalogDetailSearchLede}</SeoullyText>
              <SeoullyField
                label={copy.catalogDetailSearchLabel}
                value={query}
                onChangeText={updateQuery}
                placeholder={copy.catalogDetailSearchPlaceholder}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {searchError ? <SeoullyText variant="caption" color={colors.plum}>{searchError}</SeoullyText> : null}
              {hits.map((template) => (
                <SeoullyShelfRow
                  key={template.id}
                  template={template}
                  title={template.name}
                  meta={[template.groupName, template.memberName, template.releaseName, template.descriptor, collectibleKindLabel(template.kind, copy)].filter(Boolean).join(" · ")}
                  onPress={() => { void openPhoto(template).catch(() => setSearchError(copy.collectibleCreateFailed)); }}
                />
              ))}
              {query.trim() && !searching && hits.length === 0 && !searchError ? (
                <SeoullyText variant="secondary" style={styles.empty}>{copy.catalogDetailNoResults}</SeoullyText>
              ) : null}
              <View style={styles.footer}>
                <SeoullyButton label={copy.addManuallyTitle} variant="ghost" block onPress={() => setStep("manual")} />
              </View>
            </View>
          ) : null}

          {step === "manual" ? (
            <View>
              <SeoullyText variant="title" style={[styles.headline, fromOnboarding ? onboardingHeading : null]}>{copy.catalogDescribeTitle}</SeoullyText>
              <SeoullyText variant="secondary" style={[styles.lede, fromOnboarding ? onboardingDescription : null]}>{copy.catalogDescribeLede}</SeoullyText>
              <SeoullyField
                label={copy.catalogName}
                value={name}
                onChangeText={setName}
                placeholder={copy.catalogNamePlaceholder}
              />
              <SeoullyText variant="caption" style={styles.kindLabel}>{copy.catalogKind}</SeoullyText>
              <View style={styles.kinds}>
                {COLLECTIBLE_KINDS.map((item) => (
                  <SeoullyChoiceChip
                    key={item}
                    role="checkbox"
                    selected={kind === item}
                    label={collectibleKindLabel(item, copy)}
                    onPress={() => setKind(item)}
                  />
                ))}
              </View>
              <SeoullyField
                label={copy.catalogGroup}
                value={groupName}
                onChangeText={setGroupName}
                placeholder={copy.groupPlaceholder}
              />
              <SeoullyField
                label={`${copy.catalogMember} · ${copy.catalogOptional}`}
                value={memberName}
                onChangeText={setMemberName}
                placeholder={copy.memberOptionalPlaceholder}
              />
              <SeoullyField
                label={`${copy.catalogRelease} · ${copy.catalogOptional}`}
                value={releaseName}
                onChangeText={setReleaseName}
                placeholder={copy.releaseOptionalPlaceholder}
              />
              <SeoullyField
                label={`${copy.catalogVersion} · ${copy.catalogOptional}`}
                value={versionName}
                onChangeText={setVersionName}
                placeholder={copy.catalogVersionPlaceholder}
              />
              {message ? <SeoullyText accessibilityRole="alert" variant="caption" color={colors.plum}>{message}</SeoullyText> : null}
              <SeoullyButton
                label={working ? copy.saving : copy.continue}
                disabled={working}
                block
                onPress={() => { void submitManual(); }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingBottom: 32, paddingHorizontal: 16 },
  entry: { flexGrow: 1, paddingTop: 24, paddingBottom: 24 },
  // Share surplus height with the space below, instead of centering in all of it.
  choices: { flexGrow: 0.5, justifyContent: "center", gap: 24, paddingVertical: 24 },
  choice: { minHeight: 120, justifyContent: "center", borderRadius: 20, paddingVertical: 28, paddingHorizontal: 24, gap: 10, borderWidth: 1 },
  catalogChoice: { backgroundColor: colors.action, borderColor: colors.action },
  manualChoice: { backgroundColor: colors.lilacSoft, borderColor: colors.border },
  choicePressed: { opacity: 0.85 },
  choiceTitle: { textAlign: "center" },
  choiceCopy: { textAlign: "center", lineHeight: 22 },
  headline: { letterSpacing: -0.8, marginBottom: 8, marginTop: 10 },
  lede: { lineHeight: 22, marginBottom: 28 },
  kicker: { letterSpacing: 0.6, marginBottom: 18, marginTop: 8, textTransform: "uppercase" },
  empty: { marginTop: 12 },
  footer: { marginTop: 24 },
  kindLabel: { letterSpacing: 0.2, marginBottom: 8 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
});
