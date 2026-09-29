import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { createHolding, uploadCatalogReferencePhoto, uploadHoldingPhoto } from "../src/api";
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
  const [uri, setUri] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareReference, setShareReference] = useState(catalogReferenceConsentDefault());
  const [cropAsset, setCropAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  const photocard = params.kind === "photocard";
  const isNewTemplate = params.newTemplate === "true";

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
      } else setUri(asset.uri);
    } catch {
      setMessage(copy.photoPrepareFailed);
    }
    setWorking(false);
  }

  async function useCrop(crop: CropRect) {
    if (!cropAsset) return;
    setWorking(true);
    try {
      const cropped = await ImageManipulator.manipulateAsync(cropAsset.uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
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
    setWorking(true);
    setMessage(null);
    try {
      const { holding } = await createHolding(params.templateId);
      let photoFailed = false;
      if (uri) {
        try {
          await uploadHoldingPhoto(holding.id, uri);
        } catch {
          photoFailed = true;
        }
        if (shouldShareCatalogReference({ consent: shareReference, isNewTemplate, hasPersonalMedia: !photoFailed })) {
          try {
            await uploadCatalogReferencePhoto(params.templateId, uri);
          } catch {
            photoFailed = true;
          }
        }
      }
      const fromOnboarding = params.from === "onboarding";
      router.replace(fromOnboarding
        ? {
            pathname: "/onboarding",
            params: { phase: "reveal", holdingId: holding.id, ...(photoFailed ? { photoWarning: "1" } : {}) },
          }
        : {
            pathname: "/collectible",
            params: { holdingId: holding.id, ...(photoFailed ? { photoWarning: "1" } : {}) },
          });
      return;
    } catch {
      setMessage(copy.holdingCreateFailed);
    }
    setWorking(false);
  }

  const meta = [
    typeof params.groupName === "string" ? params.groupName : "",
    typeof params.memberName === "string" ? params.memberName : "",
    typeof params.releaseName === "string" ? params.releaseName : "",
    params.kind ? collectibleKindLabel(params.kind, copy) : "",
  ].filter(Boolean).join(" · ");

  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        <SeoullyText variant="title" style={styles.headline}>{copy.myCopyTitle}</SeoullyText>
        <SeoullyText variant="handle" color={colors.plum}>{params.name ?? copy.catalogItemFallback}</SeoullyText>
        {meta ? <SeoullyText variant="caption" style={styles.meta}>{meta}</SeoullyText> : null}
        <SeoullyText variant="secondary" style={styles.lede}>{copy.myCopyLede}</SeoullyText>
        {uri ? (
          <Image
            accessibilityLabel={copy.personalPreview}
            resizeMode="contain"
            source={{ uri }}
            style={photocard ? styles.cardPreview : styles.preview}
          />
        ) : (
          <View style={styles.empty}>
            <SeoullyText variant="secondary" style={styles.emptyText}>{copy.personalPhotoOptional}</SeoullyText>
          </View>
        )}
        <View style={styles.row}>
          <SeoullyButton label={copy.takePhoto} variant="ghost" fill onPress={() => { void choose("camera"); }} />
          <SeoullyButton label={copy.chooseFromLibrary} variant="ghost" fill onPress={() => { void choose("library"); }} />
        </View>
        {isNewTemplate ? (
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
          label={working ? copy.saving : copy.addToCollection}
          disabled={working}
          block
          onPress={() => { void add(); }}
        />
        {message ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{message}</SeoullyText> : null}
      </ScrollView>
      <PhotocardCropper
        asset={cropAsset}
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
  cardPreview: { alignSelf: "center", aspectRatio: 55 / 85, borderRadius: 10, width: "58%" },
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
