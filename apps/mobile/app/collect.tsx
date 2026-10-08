import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
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
          {step !== "entry" || !fromOnboarding ? (
            <ScreenBack
              label={copy.back}
              onPress={() => (step === "entry" ? router.back() : setStep("entry"))}
            />
          ) : null}

          {step === "entry" ? (
            <View style={styles.entry}>
              <SeoullyText variant="title" style={styles.headline}>{fromOnboarding ? copy.onboardCollectFirstTitle : copy.catalogEntryTitle}</SeoullyText>
              <SeoullyText variant="secondary" style={styles.lede}>{fromOnboarding ? copy.onboardCollectFirstLede : copy.catalogEntryLede}</SeoullyText>
              <SeoullyButton label={copy.searchSeoullyCatalog} block onPress={() => setStep("search")} />
              <SeoullyText variant="caption" style={styles.kicker}>{copy.searchSeoullyCatalogLede}</SeoullyText>
              <SeoullyButton label={copy.addManuallyTitle} variant="ghost" block onPress={() => setStep("manual")} />
              <SeoullyText variant="caption" style={styles.kicker}>{copy.addManuallyLede}</SeoullyText>
            </View>
          ) : null}

          {step === "search" ? (
            <View>
              <SeoullyText variant="title" style={styles.headline}>{copy.searchSeoullyCatalog}</SeoullyText>
              <SeoullyText variant="secondary" style={styles.lede}>{copy.catalogDetailSearchLede}</SeoullyText>
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
              <SeoullyText variant="title" style={styles.headline}>{copy.catalogDescribeTitle}</SeoullyText>
              <SeoullyText variant="secondary" style={styles.lede}>{copy.catalogDescribeLede}</SeoullyText>
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
  container: { paddingBottom: 64, paddingHorizontal: 16 },
  entry: { paddingTop: 8 },
  headline: { letterSpacing: -0.8, marginBottom: 8, marginTop: 10 },
  lede: { lineHeight: 22, marginBottom: 28 },
  kicker: { letterSpacing: 0.6, marginBottom: 18, marginTop: 8, textTransform: "uppercase" },
  empty: { marginTop: 12 },
  footer: { marginTop: 24 },
  kindLabel: { letterSpacing: 0.2, marginBottom: 8 },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
});
