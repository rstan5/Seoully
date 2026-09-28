import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { contributeCatalogItem, createNativePost } from "../../src/api";
import { useSocialRepository } from "../../src/data";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { collectibleKindLabel } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { colors } from "../../src/theme";
import { SeoullyButton, SeoullyChoiceChip } from "../../src/ui/SeoullyControls";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullyText } from "../../src/ui/SeoullyText";

const CREATE_DRAFT_KEY = "seoully.mobile.create-draft.v1";
const COLLECTIBLE_KINDS = ["photocard", "album", "vinyl", "poster", "lightstick", "plushie", "figure", "book", "apparel", "memorabilia"] as const;

export default function CreateScreen() {
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const [mode, setMode] = useState<"post" | "collectible">("post");
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [kind, setKind] = useState<(typeof COLLECTIBLE_KINDS)[number]>("photocard");
  const [caption, setCaption] = useState("");
  const [postUri, setPostUri] = useState<string | null>(null);
  const [postMimeType, setPostMimeType] = useState("image/jpeg");
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(CREATE_DRAFT_KEY).then((stored) => {
      if (!active || !stored) return;
      try {
        const draft = JSON.parse(stored) as Record<string, unknown>;
        if (draft.mode === "post" || draft.mode === "collectible") setMode(draft.mode);
        setName(draftText(draft.name, 200));
        setGroupName(draftText(draft.groupName, 120));
        setMemberName(draftText(draft.memberName, 120));
        setReleaseName(draftText(draft.releaseName, 160));
        if (COLLECTIBLE_KINDS.includes(draft.kind as (typeof COLLECTIBLE_KINDS)[number])) setKind(draft.kind as (typeof COLLECTIBLE_KINDS)[number]);
        setCaption(draftText(draft.caption, 2_000));
      } catch {
        void AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      }
    }).finally(() => { if (active) setDraftRestored(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    const task = setTimeout(() => {
      void AsyncStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({ mode, name, groupName, memberName, releaseName, kind, caption }));
    }, 250);
    return () => clearTimeout(task);
  }, [caption, draftRestored, groupName, kind, memberName, mode, name, releaseName]);

  async function choosePostPhoto(source: "camera" | "library") {
    setMessage(null);
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setMessage(copy.postPhotoRequired);
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) {
      setPostUri(asset.uri);
      setPostMimeType(asset.mimeType ?? "image/jpeg");
    }
  }

  async function publishPost() {
    if (social.kind === "demo") return setMessage(copy.demoWriteBlocked);
    if (!postUri) return setMessage(copy.postPhotoRequired);
    setWorking(true);
    setMessage(null);
    try {
      await createNativePost(postUri, caption, postMimeType);
      await AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      setCaption("");
      setPostUri(null);
      router.replace("/(tabs)");
    } catch {
      setMessage(copy.postCreateFailed);
    } finally {
      setWorking(false);
    }
  }

  async function submitCollectible() {
    if (social.kind === "demo") return setMessage(copy.demoWriteBlocked);
    if (!name.trim()) return setMessage(copy.collectibleNameRequired);
    if (!groupName.trim()) return setMessage(copy.groupNameRequired);
    setWorking(true);
    setMessage(null);
    try {
      const result = await contributeCatalogItem({ name, groupName, memberName: memberName || undefined, releaseName: releaseName || undefined, kind });
      await AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      setName(""); setGroupName(""); setMemberName(""); setReleaseName(""); setKind("photocard");
      router.push({ pathname: "/add", params: { templateId: result.contribution.template.id, name: result.contribution.template.name, kind: result.contribution.template.kind, newTemplate: "true" } });
    } catch {
      setMessage(copy.collectibleCreateFailed);
    } finally {
      setWorking(false);
    }
  }

  return (
    <SeoullyScreen>
      <KeyboardScreen>
        <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <SeoullyText variant="title">{copy.create}</SeoullyText>
          <View style={styles.tabs}>
            <SeoullyChoiceChip selected={mode === "post"} label={copy.sharePost} onPress={() => setMode("post")} />
            <SeoullyChoiceChip selected={mode === "collectible"} label={copy.addManually} onPress={() => setMode("collectible")} />
          </View>
          <SeoullyText variant="caption">{copy.draftSavedLocally}</SeoullyText>
          {mode === "post" ? (
            <>
              <SeoullyText variant="secondary">{copy.createPostLead}</SeoullyText>
              {postUri ? <Image source={{ uri: postUri }} style={styles.preview} /> : null}
              <View style={styles.row}>
                <SeoullyButton label={copy.takePostPhoto} variant="ghost" fill onPress={() => { void choosePostPhoto("camera"); }} />
                <SeoullyButton label={copy.choosePostPhoto} variant="ghost" fill onPress={() => { void choosePostPhoto("library"); }} />
              </View>
              <TextInput
                maxLength={2000}
                placeholder={copy.captionPlaceholder}
                placeholderTextColor={colors.muted}
                value={caption}
                onChangeText={setCaption}
                multiline
                style={[styles.input, styles.caption]}
              />
              <SeoullyButton label={copy.publishPost} disabled={working} block onPress={() => { void publishPost(); }} />
            </>
          ) : (
            <>
              <SeoullyText variant="secondary">{copy.addManualLead}</SeoullyText>
              <TextInput maxLength={200} placeholder={copy.collectibleNamePlaceholder} placeholderTextColor={colors.muted} value={name} onChangeText={setName} style={styles.input} />
              <TextInput maxLength={120} placeholder={copy.groupPlaceholder} placeholderTextColor={colors.muted} value={groupName} onChangeText={setGroupName} style={styles.input} />
              <TextInput maxLength={120} placeholder={copy.memberOptionalPlaceholder} placeholderTextColor={colors.muted} value={memberName} onChangeText={setMemberName} style={styles.input} />
              <TextInput maxLength={160} placeholder={copy.releaseOptionalPlaceholder} placeholderTextColor={colors.muted} value={releaseName} onChangeText={setReleaseName} style={styles.input} />
              <SeoullyText variant="caption">{copy.collectibleKind}</SeoullyText>
              <View style={styles.kinds}>
                {COLLECTIBLE_KINDS.map((id) => (
                  <SeoullyChoiceChip
                    key={id}
                    selected={kind === id}
                    label={collectibleKindLabel(id, copy)}
                    onPress={() => setKind(id)}
                  />
                ))}
              </View>
              <SeoullyButton label={copy.continue} disabled={working} block onPress={() => { void submitCollectible(); }} />
            </>
          )}
          {message ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{message}</SeoullyText> : null}
        </ScrollView>
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

function draftText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

const styles = StyleSheet.create({
  container: { gap: 12, paddingBottom: 120, paddingHorizontal: 16, paddingTop: 12 },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  row: { flexDirection: "row", gap: 8 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
  },
  caption: { minHeight: 100, paddingTop: 12, textAlignVertical: "top" },
  preview: { aspectRatio: 4 / 3, borderRadius: 14, width: "100%" },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
