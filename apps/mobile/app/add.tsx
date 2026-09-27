import { useState } from "react";
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { createHolding, uploadCatalogReferencePhoto, uploadHoldingPhoto } from "../src/api";
import { useCopy } from "../src/locale";
import { PhotocardCropper, type CropRect } from "../src/media/PhotocardCropper";
import { colors, spacing } from "../src/theme";

export default function AddCollectibleScreen() {
  const copy = useCopy();
  const router = useRouter();
  const params = useLocalSearchParams<{ templateId: string; name: string; kind: string; newTemplate?: string }>();
  const [uri, setUri] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shareReference, setShareReference] = useState(false);
  const [cropAsset, setCropAsset] = useState<{ uri: string; width: number; height: number } | null>(null);

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
      if (params.kind === "photocard" && asset.width && asset.height) {
        setCropAsset({ uri: asset.uri, width: asset.width, height: asset.height });
      } else setUri(asset.uri);
    } catch { setMessage(copy.photoPrepareFailed); }
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
    if (!params.templateId) { setMessage(copy.chooseCatalogFirst); return; }
    setWorking(true); setMessage(null);
    try {
      const result = await createHolding(params.templateId) as { holding?: { id: string } };
      if (uri && result.holding?.id) await uploadHoldingPhoto(result.holding.id, uri);
      if (uri && shareReference && params.newTemplate === "true") await uploadCatalogReferencePhoto(params.templateId, uri);
      if (result.holding?.id) {
        router.replace({ pathname: "/collectible", params: { holdingId: result.holding.id } });
        return;
      }
      router.replace("/collection");
    } catch { setMessage(copy.holdingCreateFailed); }
    setWorking(false);
  }

  return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.title}>{copy.addCollectible}</Text><Text style={styles.name}>{params.name ?? copy.catalogItemFallback}</Text><Text style={styles.body}>{copy.addPhotoLead}</Text>{uri ? <Image accessibilityLabel={copy.personalPreview} source={{ uri }} style={styles.preview} /> : <View style={styles.empty}><Text style={styles.emptyText}>{copy.personalPhotoOptional}</Text></View>}<View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => choose("camera")} style={styles.secondary}><Text style={styles.secondaryText}>{copy.takePhoto}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => choose("library")} style={styles.secondary}><Text style={styles.secondaryText}>{copy.chooseFromLibrary}</Text></Pressable></View>{params.newTemplate === "true" && <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: shareReference }} onPress={() => setShareReference((value) => !value)} style={styles.consent}><Text style={styles.consentText}>{shareReference ? "☑" : "☐"} {copy.shareCatalogPhoto}</Text></Pressable>}<Pressable accessibilityRole="button" disabled={working} onPress={add} style={styles.primary}><Text style={styles.primaryText}>{working ? copy.saving : copy.addToCollection}</Text></Pressable>{message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}<Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.cancel}>{copy.back}</Text></Pressable></View><PhotocardCropper asset={cropAsset} title={copy.cropPhotocard} hint={copy.cropPhotocardHint} useLabel={copy.useCrop} backLabel={copy.back} zoomInLabel={copy.zoomIn} zoomOutLabel={copy.zoomOut} onUse={useCrop} onCancel={() => setCropAsset(null)} /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { flex: 1, padding: spacing.lg }, title: { color: colors.ink, fontSize: 32, fontWeight: "700" }, name: { color: colors.plum, fontSize: 18, fontWeight: "700", marginTop: spacing.sm }, body: { color: colors.muted, fontSize: 16, marginTop: spacing.xs }, preview: { alignSelf: "center", borderRadius: 16, height: 280, marginVertical: spacing.lg, resizeMode: "contain", width: 182 }, empty: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderWidth: 1, justifyContent: "center", marginVertical: spacing.lg, minHeight: 180, padding: spacing.lg }, emptyText: { color: colors.muted, lineHeight: 21, textAlign: "center" }, actions: { gap: spacing.sm }, secondary: { alignItems: "center", borderColor: colors.plum, borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 48 }, secondaryText: { color: colors.plum, fontWeight: "700" }, consent: { marginTop: spacing.md, paddingVertical: spacing.sm }, consentText: { color: colors.ink, lineHeight: 20 }, primary: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", marginTop: spacing.md, minHeight: 52 }, primaryText: { color: colors.surface, fontWeight: "700" }, message: { color: colors.plum, marginTop: spacing.md }, cancel: { color: colors.muted, paddingVertical: spacing.md, textAlign: "center" } });
