import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postFailureMessage } from "../../src/postPublish";
import { createNativePost } from "../../src/api";
import { useSocialRepository } from "../../src/data";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { useCopy, useLocale } from "../../src/locale";
import { colors } from "../../src/theme";
import { SeoullyButton, SeoullyChoiceChip } from "../../src/ui/SeoullyControls";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { PostTagPicker, type PostTag } from "../../src/ui/PostTagPicker";
import { SeoullyText } from "../../src/ui/SeoullyText";

const CREATE_DRAFT_KEY = "seoully.mobile.create-draft.v1";

export default function CreateScreen() {
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const [mode, setMode] = useState<"post" | "collectible">("post");
  const [caption, setCaption] = useState("");
  const [postUri, setPostUri] = useState<string | null>(null);
  const [postMimeType, setPostMimeType] = useState("image/jpeg");
  const [tagPicker, setTagPicker] = useState<"collectible" | "collector" | null>(null);
  const [collectibleTags, setCollectibleTags] = useState<PostTag[]>([]);
  const [collectorTags, setCollectorTags] = useState<PostTag[]>([]);
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
        for (const [key, setter] of [["collectibleTags", setCollectibleTags], ["collectorTags", setCollectorTags]] as const) {
          if (Array.isArray(draft[key])) setter((draft[key] as PostTag[]).filter(item => typeof item?.id === "string" && typeof item?.name === "string").slice(0, 10));
        }
        setPostUri(typeof draft.postUri === "string" ? draft.postUri : null);
        setPostMimeType(typeof draft.postMimeType === "string" ? draft.postMimeType : "image/jpeg");
        setCaption(typeof draft.caption === "string" ? draft.caption.slice(0, 2_000) : "");
      } catch {
        void AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      }
    }).finally(() => { if (active) setDraftRestored(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!draftRestored) return;
    const task = setTimeout(() => {
      void AsyncStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({ mode, caption, collectibleTags, collectorTags, postUri, postMimeType }));
    }, 250);
    return () => clearTimeout(task);
  }, [caption, collectibleTags, collectorTags, draftRestored, mode, postMimeType, postUri]);

  async function choosePostPhoto(source: "camera" | "library") {
    setMessage(null);
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setMessage(copy.postPhotoRequired);
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.9, exif: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) {
      try {
        // Native libraries may return HEIC; the existing post Storage contract accepts JPEG/PNG/WebP.
        const prepared = !asset.mimeType || !["image/jpeg", "image/png", "image/webp"].includes(asset.mimeType)
          ? await ImageManipulator.manipulateAsync(asset.uri, [], { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }) : asset;
        setPostUri(prepared.uri);
        setPostMimeType(prepared === asset ? asset.mimeType ?? "image/jpeg" : "image/jpeg");
      } catch { setMessage(copy.postMediaFailed); }
    }
  }

  async function publishPost() {
    if (social.kind === "demo") return setMessage(copy.demoWriteBlocked);
    if (!postUri && !caption.trim() && !collectibleTags.length && !collectorTags.length) return setMessage(copy.postContentRequired);
    setWorking(true);
    setMessage(null);
    try {
      await createNativePost(postUri, caption, postMimeType, { taggedUserIds: collectorTags.map(tag => tag.id), taggedTemplateIds: collectibleTags.map(tag => tag.id) });
      await AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      setCaption("");
      setPostUri(null);
      setCollectibleTags([]); setCollectorTags([]);
      router.replace("/(tabs)");
    } catch (error) {
      setMessage(postFailureMessage(error, copy));
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
            <SeoullyChoiceChip selected={mode === "collectible"} label={copy.addCollectible} onPress={() => setMode("collectible")} />
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
              <View style={styles.row}>
                <SeoullyButton label={copy.tagCollectible} variant="ghost" fill disabled={working} onPress={() => setTagPicker("collectible")} />
                <SeoullyButton label={copy.tagCollectors} variant="ghost" fill disabled={working} onPress={() => setTagPicker("collector")} />
              </View>
              <View style={styles.tabs}>
                {collectibleTags.map(tag => <SeoullyChoiceChip key={tag.id} selected label={tag.name} onPress={() => setCollectibleTags(tags => tags.filter(item => item.id !== tag.id))} />)}
                {collectorTags.map(tag => <SeoullyChoiceChip key={tag.id} selected label={tag.subtitle ?? tag.name} onPress={() => setCollectorTags(tags => tags.filter(item => item.id !== tag.id))} />)}
              </View>
              <SeoullyButton label={copy.publishPost} disabled={working} block onPress={() => { void publishPost(); }} />
            </>
          ) : (
            <>
              <SeoullyText variant="secondary">{copy.catalogEntryLede}</SeoullyText>
              <SeoullyButton label={copy.searchSeoullyCatalog} block onPress={() => router.push("/collect")} />
              <SeoullyText variant="caption">{copy.searchSeoullyCatalogLede}</SeoullyText>
            </>
          )}
          {message ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{message}</SeoullyText> : null}
        </ScrollView>
      </KeyboardScreen>
      {tagPicker ? <PostTagPicker kind={tagPicker} selected={tagPicker === "collectible" ? collectibleTags : collectorTags} onClose={() => setTagPicker(null)} onSelect={tag => {
        const update = (items: PostTag[]) => items.some(item => item.id === tag.id) || items.length >= 10 ? items : [...items, tag];
        if (tagPicker === "collectible") setCollectibleTags(update); else setCollectorTags(update);
      }} /> : null}
    </SeoullyScreen>
  );
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
});
