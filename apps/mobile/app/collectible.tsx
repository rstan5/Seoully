import { PhotocardCollectorCount } from "../src/ui/PhotocardCollectorCount";
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { loadMyHolding, uploadHoldingPhoto, type NativeHolding } from "../src/api";
import { useSocialRepository } from "../src/data";
import { useReportAskSurface } from "../src/ask-surface";
import { isBinderEligible, isRoomEligible } from "../src/data/ownership";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy, useLocale } from "../src/locale";
import { useCachedSignedMedia } from "../src/media/cachedMedia";
import { PhotocardCropper, type CropRect } from "../src/media/PhotocardCropper";
import { colors } from "../src/theme";
import { SeoullyButton } from "../src/ui/SeoullyControls";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function CollectibleDetailScreen() {
  const copy = useCopy();
  const { locale } = useLocale();
  const router = useRouter();
  const { holdingId = "", photoWarning } = useLocalSearchParams<{ holdingId?: string; photoWarning?: string }>();
  const [holding, setHolding] = useState<NativeHolding | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropAsset, setCropAsset] = useState<{ uri: string; width: number; height: number } | null>(null);
  const mediaUri = useCachedSignedMedia(holding?.id, holding?.personalMediaUrl);
  const social = useSocialRepository();
  useReportAskSurface({
    surface: "collectible",
    ...(holdingId ? { holdingId } : {}),
    ...(holding?.templateId ? { templateId: holding.templateId } : {}),
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let item: NativeHolding | null = null;
      if (holdingId) {
        if (social.kind === "demo") {
          item = (await social.loadMyHoldings(0, 100)).find((holding) => holding.id === holdingId) ?? null;
        } else {
          item = await loadMyHolding(holdingId);
        }
      }
      setHolding(item);
      setError(item ? null : copy.collectibleUnavailable);
    } catch {
      setError(copy.collectibleUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.collectibleUnavailable, holdingId, social]);
  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  async function choosePhoto(source: "camera" | "library") {
    if (!holding || busy) return;
    setError(null);
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setError(copy.photoAccessRequired); return; }
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (holding.template.kind === "photocard" && asset.width && asset.height) {
      setCropAsset({ uri: asset.uri, width: asset.width, height: asset.height });
      return;
    }
    await savePhoto(asset.uri);
  }

  async function useCrop(crop: CropRect) {
    if (!cropAsset) return;
    try {
      const cropped = await ImageManipulator.manipulateAsync(cropAsset.uri, [{ crop }], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG });
      setCropAsset(null);
      await savePhoto(cropped.uri);
    } catch {
      setError(copy.photoPrepareFailed);
    }
  }

  async function savePhoto(uri: string) {
    if (social.kind === "demo") { setError(copy.demoWriteBlocked); return; }
    if (!holding) return;
    setBusy(true);
    try {
      await uploadHoldingPhoto(holding.id, uri);
      setHolding(await loadMyHolding(holding.id));
      setError(null);
    } catch {
      setError(copy.photoUpdateFailed);
    } finally {
      setBusy(false);
    }
  }

  async function toggleTrade() {
    if (!holding || busy) return;
    setBusy(true);
    try {
      setHolding(await social.setHoldingTradeStatus(holding.id, holding.tradeStatus === "for-trade" ? "not-for-trade" : "for-trade"));
      setError(null);
    } catch {
      setError(copy.holdingTradeFailed);
    } finally {
      setBusy(false);
    }
  }

  async function removeOwned() {
    if (!holding || busy) return;
    setBusy(true);
    try {
      await social.removeHolding(holding.id);
      router.replace("/collection");
    } catch {
      setError(copy.holdingRemoveFailed);
      setBusy(false);
    }
  }

  if (loading && !holding && !error) return <SeoullyLoadingState fullScreen label={copy.viewCollectible} />;

  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
        {holding ? (
          <>
            {mediaUri ? (
              <Image
                accessibilityLabel={copy.personalPreview}
                resizeMode="contain"
                source={{ uri: mediaUri }}
                style={holding.template.kind === "photocard" ? styles.image : styles.objectImage}
              />
            ) : (
              <View style={holding.template.kind === "photocard" ? styles.fallback : styles.objectFallback}>
                <SeoullyText variant="title" style={styles.fallbackText}>{holding.template.name}</SeoullyText>
              </View>
            )}
            {photoWarning === "1" ? <SeoullyText variant="secondary" color={colors.plum} style={styles.kind}>{copy.holdingAddedPhotoFailed}</SeoullyText> : null}
            <SeoullyText variant="caption" color={colors.plum} style={styles.kind}>
              {collectibleKindLabel(holding.template.kind, copy)}
            </SeoullyText>
            <SeoullyText variant="title">{holding.template.name}</SeoullyText>
            <PhotocardCollectorCount templateId={holding.templateId} kind={holding.template.kind} />
            <SeoullyText variant="secondary" style={styles.meta}>
              {[holding.template.groupName, holding.template.memberName, holding.template.releaseName].filter(Boolean).join(" · ")}
            </SeoullyText>
            {holding.template.descriptor ? <SeoullyText variant="body" style={styles.descriptor}>{holding.template.descriptor}</SeoullyText> : null}
            <View style={styles.statusRow}>
              <SeoullyText variant="handle" color={colors.plum}>
                {holding.tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}
              </SeoullyText>
              <SeoullyText variant="metadata">
                {copy.acquired} {new Date(holding.acquiredAt).toLocaleDateString(locale === "ko" ? "ko-KR" : "en-US")}
              </SeoullyText>
            </View>
            <View style={styles.stack}>
              <SeoullyButton
                label={holding.tradeStatus === "for-trade" ? copy.keepInCollection : copy.markForTrade}
                disabled={busy}
                block
                onPress={() => { void toggleTrade(); }}
              />
              <View style={styles.row}>
                <SeoullyButton label={copy.takePhoto} variant="ghost" disabled={busy} fill onPress={() => { void choosePhoto("camera"); }} />
                <SeoullyButton
                  label={holding.personalMediaUrl ? copy.replacePersonalPhoto : copy.addPersonalPhoto}
                  variant="ghost"
                  disabled={busy}
                  fill
                  onPress={() => { void choosePhoto("library"); }}
                />
              </View>
              <View style={styles.row}>
                <SeoullyButton
                  label={copy.viewRoom}
                  variant="ghost"
                  fill
                  disabled={!isRoomEligible(holding)}
                  onPress={() => {
                    router.push("/room");
                  }}
                />
                {isBinderEligible(holding) ? (
                  <SeoullyButton label={copy.viewBinder} variant="ghost" fill onPress={() => router.push({ pathname: "/room", params: { holdingId: holding.id } })} />
                ) : (
                  <SeoullyButton label={copy.removeFromCollection} variant="ghost" fill disabled={busy} onPress={() => { void removeOwned(); }} />
                )}
              </View>
              {isBinderEligible(holding) ? (
                <SeoullyButton label={copy.removeFromCollection} variant="ghost" block disabled={busy} onPress={() => { void removeOwned(); }} />
              ) : null}
              <SeoullyText variant="caption" color={colors.muted}>
                {isBinderEligible(holding) ? copy.binderEligibleHint : copy.roomEligibleHint}
              </SeoullyText>
            </View>
          </>
        ) : null}
      </ScrollView>
      <PhotocardCropper key={cropAsset?.uri ?? "no-crop"}
        errorLabel={copy.photoPrepareFailed}
        retryLabel={copy.retry}
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
  container: { paddingBottom: 80, paddingHorizontal: 16 },
  image: { alignSelf: "center", aspectRatio: 55 / 85, marginTop: 16, maxHeight: 500, width: "78%" },
  objectImage: { alignSelf: "center", aspectRatio: 1, marginTop: 16, maxHeight: 280, width: "72%" },
  fallback: {
    alignItems: "center",
    alignSelf: "center",
    aspectRatio: 55 / 85,
    backgroundColor: colors.lilacSoft,
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 16,
    padding: 18,
    width: "78%",
  },
  objectFallback: {
    alignItems: "center",
    alignSelf: "center",
    aspectRatio: 1,
    backgroundColor: colors.lilacSoft,
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 16,
    padding: 18,
    width: "72%",
  },
  fallbackText: { textAlign: "center" },
  kind: { letterSpacing: 0.4, marginTop: 18, textTransform: "uppercase" },
  meta: { marginTop: 4 },
  descriptor: { lineHeight: 20, marginTop: 12 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 16 },
  stack: { gap: 10, marginTop: 18 },
  row: { flexDirection: "row", gap: 8 },
});
