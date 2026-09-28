import { useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { createHolding, uploadCatalogReferencePhoto, uploadHoldingPhoto } from "../src/api";
import { useSocialRepository } from "../src/data";
import { ScreenBack } from "../src/components/ScreenBack";
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
  const params = useLocalSearchParams<{ templateId: string; name: string; kind: string; newTemplate?: string }>();
  const [uri, setUri] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareReference, setShareReference] = useState(false);
  const [cropAsset, setCropAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  const photocard = params.kind === "photocard";

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
      const result = await createHolding(params.templateId) as { holding?: { id: string } };
      if (uri && result.holding?.id) await uploadHoldingPhoto(result.holding.id, uri);
      if (uri && shareReference && params.newTemplate === "true") await uploadCatalogReferencePhoto(params.templateId, uri);
      if (result.holding?.id) {
        router.replace({ pathname: "/collectible", params: { holdingId: result.holding.id } });
        return;
      }
      router.replace("/collection");
    } catch {
      setMessage(copy.holdingCreateFailed);
    }
    setWorking(false);
  }

  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        <SeoullyText variant="title" style={styles.headline}>{copy.myCopyTitle}</SeoullyText>
        <SeoullyText variant="handle" color={colors.plum}>{params.name ?? copy.catalogItemFallback}</SeoullyText>
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
        {params.newTemplate === "true" ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: shareReference }}
            onPress={() => setShareReference((value) => !value)}
            style={styles.consent}
          >
            <SeoullyText variant="body">{shareReference ? "☑" : "☐"} {copy.shareCatalogPhoto}</SeoullyText>
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
  consent: { minHeight: 44, justifyContent: "center" },
});
