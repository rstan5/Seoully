import { PHOTOCARD } from "../src/media/photocard";
import { useEffect, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { loadMyHolding, createHolding, uploadCatalogReferencePhoto, uploadHoldingPhoto } from "../src/api";
import { confirmFirstCollectible, type FirstCollectibleDraft } from "../src/onboarding/firstCollectible";
import { prepareAddCollectibleDraft, saveFirstCollectibleDraft, clearFirstCollectibleDraft } from "../src/onboarding/firstCollectibleStorage";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { useSocialRepository } from "../src/data";
import { catalogReferenceConsentDefault, shouldShareCatalogReference } from "../src/data/ownership";
import { ScreenBack } from "../src/components/ScreenBack";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy } from "../src/locale";
import { PhotocardCropper, type CropRect } from "../src/media/PhotocardCropper";
import { colors } from "../src/theme";
import { SeoullyButton } from "../src/ui/SeoullyControls";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function AddCollectibleScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const params = useLocalSearchParams<{
    templateId: string;
    name: string;
    kind: string;
    groupName?: string;
    memberName?: string;
    releaseName?: string;
    newTemplate?: string;
    from?: string;
  }>();
  const fromOnboarding = params.from === "onboarding";
  const submitting = useRef(false);
  const draftScope = useRef<string | undefined>(undefined);
  const photoTemplate = useRef(params.templateId);
  const [pendingDraft, setPendingDraft] = useState<FirstCollectibleDraft | null>(null);
  const [draft, setDraft] = useState<FirstCollectibleDraft | null>(null);
  const [hydrating, setHydrating] = useState(true);
  const [uri, setUri] = useState<string | null>(null);
  const [savedHoldingId, setSavedHoldingId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareReference, setShareReference] = useState(catalogReferenceConsentDefault());
  const [cropAsset, setCropAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  const photocard = params.kind === "photocard";
  const isNewTemplate = params.newTemplate === "true";

  function persistDraft(next: FirstCollectibleDraft) { return saveFirstCollectibleDraft(next, draftScope.current); }
  function fetchDraft() {
    return prepareAddCollectibleDraft(params.templateId, isNewTemplate, fromOnboarding, {
      name: params.name ?? "", kind: params.kind ?? "", groupName: params.groupName, memberName: params.memberName, releaseName: params.releaseName,
    }).then(prepared => {
      draftScope.current = prepared.scope;
      if (prepared.draft.templateId !== params.templateId) {
        setPendingDraft(prepared.draft);
        throw new Error("pending_first_collectible");
      }
      return prepared.draft;
    });
  }
  function restoreDraft() {
    return fetchDraft().then((existing) => {
      setDraft(existing);
      const samePhotoOperation = photoTemplate.current === existing.templateId;
      photoTemplate.current = existing.templateId;
      setUri(current => samePhotoOperation ? current ?? existing.photoUri : existing.photoUri);
      setPendingDraft(null);
      setShareReference(fromOnboarding ? false : existing.shareReference);
      setMessage(null);
    }).catch(error => {
      const reason = error instanceof Error && ["pending_first_collectible", "add_template_missing", "unauthenticated", "invalid_first_collectible_draft"].includes(error.message) ? error.message : "draft_storage_failed";
      setMessage(__DEV__ ? `${copy.addDraftFailed} (add_draft:000:${reason})` : copy.addDraftFailed);
    })
      .finally(() => { setHydrating(false); });
  }
  useEffect(() => {
    if (social.kind !== "demo") void restoreDraft();
    // Only restore when entering this logical Add operation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromOnboarding, params.templateId, social.kind]);

  async function choose(source: "camera" | "library") {
    setMessage(null);
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setMessage(copy.photoAccessRequired); return; }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setWorking(true);
    try {
      if (photocard && asset.width && asset.height) {
        setCropAsset({ uri: asset.uri, width: asset.width, height: asset.height });
      } else {
        if (draft) await persistDraft({ ...draft, photoUri: asset.uri });
        setUri(asset.uri);
      }
    } catch {
      setMessage(copy.photoPrepareFailed);
    }
    setWorking(false);
  }

  async function useCrop(crop: CropRect) {
    if (!cropAsset || working) return;
    setWorking(true);
    try {
      const cropped = await ImageManipulator.manipulateAsync(cropAsset.uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      if (draft) await persistDraft({ ...draft, photoUri: cropped.uri });
      setUri(cropped.uri);
      setCropAsset(null);
    } catch {
      setMessage(copy.photoPrepareFailed);
    }
    setWorking(false);
  }

  async function add() {
    if (social.kind === "demo") { setMessage(copy.demoWriteBlocked); return; }
    if (!params.templateId) { setMessage(copy.chooseCatalogFirst); return; }
    if (submitting.current) return;
    submitting.current = true;
    setWorking(true);
    setMessage(null);
    let ownershipConfirmed = false;
    try {
      if (!draft || draft.templateId !== params.templateId) throw new Error("draft_unavailable");
      const next = { ...draft, photoUri: uri, shareReference: fromOnboarding ? false : shouldShareCatalogReference({ consent: shareReference, isNewTemplate, hasPersonalMedia: Boolean(uri) }) };
      await persistDraft(next);
      const holding = await confirmFirstCollectible(next, { read: loadMyHolding, create: createHolding,
        photo: uploadHoldingPhoto, reference: uploadCatalogReferencePhoto, save: persistDraft });
      if (!holding) throw new Error("holding_unavailable");
      ownershipConfirmed = true;
      setSavedHoldingId(holding.id);
      await clearFirstCollectibleDraft(draftScope.current);
      if (fromOnboarding) router.replace({ pathname: "/onboarding", params: { phase: "reveal", holdingId: holding.id } });
      return;
    } catch (error) {
      const diagnostic = error instanceof Error && /^(holding_read|holding_create|media_upload):[0-9]{3}:[a-z_]+$/.test(error.message) ? error.message
        : error instanceof Error && ["media_local_file_unreadable", "media_too_large", "unsupported_media_type"].includes(error.message) ? `media_prepare:000:${error.message}` : null;
      const friendly = ownershipConfirmed ? copy.addConfirmationFailed : error instanceof Error && error.message.includes("media") ? copy.photoUpdateFailed : copy.holdingCreateFailed;
      setMessage(__DEV__ && diagnostic ? `${friendly} (${diagnostic})` : friendly);
    } finally {
      submitting.current = false;
      setWorking(false);
    }
  }

  const meta = [
    typeof params.groupName === "string" ? params.groupName : "",
    typeof params.memberName === "string" ? params.memberName : "",
    typeof params.releaseName === "string" ? params.releaseName : "",
    params.kind ? collectibleKindLabel(params.kind, copy) : "",
  ].filter(Boolean).join(" · ");

  if (hydrating && social.kind !== "demo") return <SeoullyLoadingState fullScreen label={copy.brand} />;
  if (savedHoldingId) return <SeoullyScreen>
    <View style={styles.container}>
      <SeoullyText variant="title">{copy.collectibleSaved}</SeoullyText>
      {message ? <SeoullyText accessibilityRole="alert">{message}</SeoullyText> : null}
      <SeoullyButton label={copy.viewInRoom} block onPress={() => { try { router.replace(fromOnboarding ? { pathname: "/onboarding", params: { phase: "reveal", holdingId: savedHoldingId } } : { pathname: "/room", params: { holdingId: savedHoldingId } }); } catch { setMessage(copy.addConfirmationFailed); } }} />
    </View>
  </SeoullyScreen>;
  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        <SeoullyText variant="title" style={styles.headline}>{copy.addPhotoTitle}</SeoullyText>
        <SeoullyText variant="handle" color={colors.plum}>{params.name ?? copy.catalogItemFallback}</SeoullyText>
        {meta ? <SeoullyText variant="caption" style={styles.meta}>{meta}</SeoullyText> : null}
        <SeoullyText variant="secondary" style={styles.lede}>{copy.onboardPhotoLead}</SeoullyText>
        {uri ? (
          <Pressable accessibilityRole="button" accessibilityLabel={copy.cropPhotocard} disabled={!photocard || working} onPress={() => { Image.getSize(uri, (width, height) => setCropAsset({ uri, width, height }), () => setMessage(copy.photoPrepareFailed)); }}>
          <Image
            accessibilityLabel={copy.personalPreview}
            resizeMode="contain"
            source={{ uri }}
            style={photocard ? styles.cardPreview : styles.preview}
          /></Pressable>
        ) : (
          <View style={styles.empty}>
            <SeoullyText variant="secondary" style={styles.emptyText}>{copy.personalPhotoOptional}</SeoullyText>
          </View>
        )}
        <View style={styles.row}>
          <SeoullyButton label={copy.takePhoto} variant="ghost" fill onPress={() => { void choose("camera"); }} />
          <SeoullyButton label={copy.chooseFromLibrary} variant="ghost" fill onPress={() => { void choose("library"); }} />
        </View>
        {isNewTemplate && !fromOnboarding ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: shareReference }}
            onPress={() => setShareReference((value) => !value)}
            style={styles.consent}
          >
            <SeoullyText variant="body">{shareReference ? "☑" : "☐"} {copy.shareCatalogPhoto}</SeoullyText>
            <SeoullyText variant="caption" color={colors.muted}>{copy.shareCatalogPhotoHelp}</SeoullyText>
          </Pressable>
        ) : null}
        <SeoullyButton
          label={working ? copy.saving : copy.saveCollectible}
          disabled={working || ((!draft || draft.templateId !== params.templateId) && social.kind !== "demo")}
          block
          onPress={() => { void add(); }}
        />
        {message ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{message}</SeoullyText> : null}
        {!draft && social.kind !== "demo" ? <SeoullyButton label={copy.retry} onPress={() => { setHydrating(true); void restoreDraft(); }} /> : null}
        {pendingDraft ? <SeoullyButton label={copy.resumeSavedAdd} onPress={() => router.replace({ pathname: "/add", params: { templateId: pendingDraft.templateId, name: pendingDraft.templateInfo?.name ?? "", kind: pendingDraft.templateInfo?.kind ?? "", from: "onboarding", ...(pendingDraft.newTemplate ? { newTemplate: "true" } : {}) } })} /> : null}
      </ScrollView>
      <PhotocardCropper key={cropAsset?.uri ?? "no-crop"}
        errorLabel={copy.photoPrepareFailed}
        retryLabel={copy.retry}
        asset={cropAsset}
        busy={working}
        title={copy.cropPhotocard}
        hint={copy.cropPhotocardHint}
        useLabel={copy.useCrop}
        backLabel={copy.back}
        zoomInLabel={copy.zoomIn}
        zoomOutLabel={copy.zoomOut}
        onUse={useCrop}
        onCancel={() => setCropAsset(null)}
      />
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14, paddingBottom: 80, paddingHorizontal: 16 },
  headline: { letterSpacing: -0.8, marginTop: 8 },
  meta: { marginTop: 2 },
  lede: { lineHeight: 21 },
  preview: { alignSelf: "center", borderRadius: 14, height: 240, width: 180 },
  cardPreview: { alignSelf: "center", aspectRatio: PHOTOCARD.aspect, borderRadius: 10, width: "58%" },
  empty: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 160,
    padding: 18,
  },
  emptyText: { textAlign: "center" },
  row: { flexDirection: "row", gap: 8 },
  consent: { gap: 4, minHeight: 44, justifyContent: "center" },
});
