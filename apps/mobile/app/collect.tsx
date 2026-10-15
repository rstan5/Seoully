import { useBootstrap } from "../src/startup/BootstrapProvider";
import { onboardingHeading, onboardingDescription } from "../src/onboarding/presentation";
import { useEffect, useRef, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { type NativeCatalogTemplate } from "../src/api";
import { queueFirstCollectible } from "../src/onboarding/firstCollectibleStorage";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { PhotocardCropper, type CropRect } from "../src/media/PhotocardCropper";
import { loadCatalogPublication, saveCatalogPublication, clearCatalogPublication, publishCommunityCatalog } from "../src/communityCatalog";
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
  const [referenceUri, setReferenceUri] = useState<string | null>(null);
  const [cropAsset, setCropAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [candidates, setCandidates] = useState<NativeCatalogTemplate[] | null>(null);
  const submitting = useRef(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (social.kind === "demo") return;
    let active = true;
    void loadCatalogPublication().then(draft => {
      if (!active || !draft) return;
      const d = draft.details;
      setName(d.name); setGroupName(d.groupName); setMemberName(d.memberName ?? "");
      setReleaseName(d.releaseName ?? ""); setVersionName(d.descriptor ?? "");
      setKind(d.kind as (typeof COLLECTIBLE_KINDS)[number]);
      setReferenceUri(draft.referenceUri); setStep("manual");
    }).catch(() => {});
    return () => { active = false; };
  }, [social.kind]);

  function details() {
    return { name: name.trim(), groupName: groupName.trim(),
      memberName: memberName.trim() || undefined, releaseName: releaseName.trim() || undefined,
      kind, ...(versionName.trim() ? { descriptor: versionName.trim() } : {}) };
  }
  async function chooseReference() {
    if (social.kind === "demo") return setMessage(copy.demoWriteBlocked);
    setMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setMessage(copy.photoAccessRequired); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (kind === "photocard") setCropAsset({ uri: asset.uri, width: asset.width, height: asset.height });
    else await retainReference(asset.uri);
  }
  async function retainReference(uri: string) {
    // Normalize format/orientation; durable copy survives picker cache eviction.
    const image = await ImageManipulator.manipulateAsync(uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
    const draft = await saveCatalogPublication(details(), image.uri);
    setReferenceUri(draft.referenceUri); setCandidates(null);
  }
  async function useReferenceCrop(crop: CropRect) {
    if (!cropAsset) return;
    try {
      const image = await ImageManipulator.manipulateAsync(cropAsset.uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      await retainReference(image.uri); setCropAsset(null);
    } catch { setMessage(copy.photoPrepareFailed); }
  }
  async function reviewMatches() {
    if (submitting.current) return;
    if (!name.trim()) return setMessage(copy.collectibleNameRequired);
    if (!groupName.trim()) return setMessage(copy.groupNameRequired);
    submitting.current = true;
    setWorking(true); setMessage(null);
    try {
      if (referenceUri) {
        const draft = await saveCatalogPublication(details(), referenceUri);
        setReferenceUri(draft.referenceUri);
      }
      // Separate bounded queries avoid requiring an exact concatenated phrase.
      const terms = [...new Set([groupName, memberName, releaseName, name].map(v => v.trim().slice(0, 120)).filter(Boolean))];
      const results = await Promise.all(terms.map(term => social.searchCatalog(term)));
      setCandidates([...new Map(results.flat().filter(t => t.kind === kind).map(t => [t.id, t])).values()]);
    } catch { setMessage(copy.catalogUnavailable); }
    finally { submitting.current = false; setWorking(false); }
  }

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

  async function selectExisting(template: NativeCatalogTemplate) {
    if (submitting.current) return;
    submitting.current = true; setWorking(true);
    try {
      const draft = await loadCatalogPublication();
      await openPhoto(template);
      if (draft) await clearCatalogPublication(draft);
    } catch { setMessage(copy.collectibleCreateFailed); }
    finally { submitting.current = false; setWorking(false); }
  }

  async function submitManual() {
    if (social.kind === "demo") return setMessage(copy.demoWriteBlocked);
    if (!name.trim()) return setMessage(copy.collectibleNameRequired);
    if (!groupName.trim()) return setMessage(copy.groupNameRequired);
    if (!referenceUri) return setMessage(copy.catalogImageRequired);
    if (candidates?.length && !versionName.trim()) return setMessage(copy.catalogDistinctVersionRequired);
    if (submitting.current) return;
    submitting.current = true;
    setWorking(true);
    setMessage(null);
    try {
      if (!referenceUri) throw new Error("catalog_reference_required");
      const draft = await saveCatalogPublication(details(), referenceUri);
      const template = await publishCommunityCatalog(draft);
      // The shared reference is already uploaded. /add only creates the private copy.
      await openPhoto(template);
      await clearCatalogPublication(draft);
    } catch (error) {
      setMessage(error instanceof Error && error.message === "catalog_identity_ambiguous" ? copy.catalogIdentityAmbiguous : copy.catalogPublicationFailed);
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
                  meta={[template.groupName, template.memberName, template.releaseName, template.descriptor, template.needsReferenceImage ? copy.catalogNeedsMedia : null, collectibleKindLabel(template.kind, copy)].filter(Boolean).join(" · ")}
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
                editable={!working}
                value={name}
                onChangeText={v => { setName(v); setCandidates(null); }}
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
                    onPress={() => { if (working) return; setKind(item); setCandidates(null); }}
                  />
                ))}
              </View>
              <SeoullyField
                label={copy.catalogGroup}
                editable={!working}
                value={groupName}
                onChangeText={v => { setGroupName(v); setCandidates(null); }}
                placeholder={copy.groupPlaceholder}
              />
              <SeoullyField
                label={`${copy.catalogMember} · ${copy.catalogOptional}`}
                editable={!working}
                value={memberName}
                onChangeText={v => { setMemberName(v); setCandidates(null); }}
                placeholder={copy.memberOptionalPlaceholder}
              />
              <SeoullyField
                label={`${copy.catalogRelease} · ${copy.catalogOptional}`}
                editable={!working}
                value={releaseName}
                onChangeText={v => { setReleaseName(v); setCandidates(null); }}
                placeholder={copy.releaseOptionalPlaceholder}
              />
              <SeoullyField
                label={`${copy.catalogVersion} · ${copy.catalogOptional}`}
                editable={!working}
                value={versionName}
                onChangeText={v => { setVersionName(v); setCandidates(null); }}
                placeholder={copy.catalogVersionPlaceholder}
              />
              <SeoullyText variant="secondary">{copy.catalogSharedConsent}</SeoullyText>
              {referenceUri ? <Image source={{ uri: referenceUri }} resizeMode="contain" accessibilityLabel={copy.catalogSharedImage} style={{ height: 180, width: "100%", marginVertical: 16 }} /> : null}
              <SeoullyButton label={copy.catalogSharedImage} variant="ghost" disabled={working} onPress={() => { void chooseReference().catch(() => setMessage(copy.photoPrepareFailed)); }} />
              {candidates !== null ? <View style={{ gap: 12, marginVertical: 16 }}>
                <SeoullyText variant="secondary">{copy.catalogMatchesLede}</SeoullyText>
                {candidates.map(template => <View key={template.id}>
                  <SeoullyShelfRow template={template} title={template.name}
                    meta={[template.groupName, template.memberName, template.releaseName].filter(Boolean).join(" · ")}
                    onPress={() => { if (working) return; void selectExisting(template); }} />
                  {template.descriptor ? <SeoullyText variant="caption">{template.descriptor}</SeoullyText> : null}
                  {template.needsReferenceImage ? <SeoullyText variant="caption">{copy.catalogNeedsMedia}</SeoullyText> : null}
                </View>)}
              </View> : null}
              {message ? <SeoullyText accessibilityRole="alert" variant="caption" color={colors.plum}>{message}</SeoullyText> : null}
              <SeoullyButton
                label={working ? copy.saving : candidates === null ? copy.reviewCatalogMatches : candidates.length ? copy.catalogDistinct : copy.publishCatalog}
                disabled={working}
                block
                onPress={() => { void (candidates === null ? reviewMatches() : submitManual()); }}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardScreen>
      <PhotocardCropper key={cropAsset?.uri ?? "no-crop"} asset={cropAsset} title={copy.cropPhotocard} hint={copy.cropPhotocardHint}
        useLabel={copy.useCrop} backLabel={copy.back} zoomInLabel={copy.zoomIn} zoomOutLabel={copy.zoomOut}
        errorLabel={copy.photoPrepareFailed} retryLabel={copy.retry} onUse={useReferenceCrop} onCancel={() => setCropAsset(null)} />
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
