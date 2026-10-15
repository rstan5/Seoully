import { useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import { File, Paths } from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { postFailureMessage } from "../../src/postPublish";
import { supabase } from "../../src/supabase";
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

const CREATE_DRAFT_PREFIX = "seoully.mobile.create-draft.v2";

export default function CreateScreen() {
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [submissionId, setSubmissionId] = useState(() => randomUUID());
  const [mode, setMode] = useState<"post" | "collectible">("post");
  const [caption, setCaption] = useState("");
  const [postUri, setPostUri] = useState<string | null>(null);
  const [postMimeType, setPostMimeType] = useState("image/jpeg");
  const [tagPicker, setTagPicker] = useState<"collectible" | "collector" | null>(null);
  const [collectibleTags, setCollectibleTags] = useState<PostTag[]>([]);
  const [collectorTags, setCollectorTags] = useState<PostTag[]>([]);
  const [working, setWorking] = useState(false);
  const [alreadyShared, setAlreadyShared] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [restoredDraftKey, setRestoredDraftKey] = useState<string | null>(null);
  const draftRestored = restoredDraftKey === draftKey;

  useEffect(() => {
    let active = true, observed = false;
    let account: string | undefined;
    const selectAccount = (id: string | undefined) => {
      if (!active) return;
      if (account !== id) {
        account = id;
        setCaption(""); setPostUri(null); setCollectibleTags([]); setCollectorTags([]);
        setSubmissionId(randomUUID()); setAlreadyShared(false); setMessage(null); setRestoreFailed(false);
      }
      setDraftKey(id ? `${CREATE_DRAFT_PREFIX}:${id}` : null);
    };
    if (social.kind === "demo") {
      void Promise.resolve().then(() => selectAccount("demo"));
      return () => { active = false; };
    }
    void supabase.auth.getSession().then(({ data }) => { if (!observed) selectAccount(data.session?.user.id); }).catch(() => { if (!observed) selectAccount(undefined); });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => { observed = true; selectAccount(session?.user.id); });
    return () => { active = false; data.subscription.unsubscribe(); };
  }, [social.kind]);

  useEffect(() => {
    if (!draftKey) return;
    let active = true, readable = false;
    void AsyncStorage.getItem(draftKey).then((stored) => {
      readable = true;
      if (active) setRestoreFailed(false);
      if (!active || !stored) return;
      try {
        const draft = JSON.parse(stored) as Record<string, unknown>;
        if (typeof draft.submissionId === "string" && /^[a-f0-9-]{36}$/i.test(draft.submissionId)) setSubmissionId(draft.submissionId);
        if (draft.mode === "post" || draft.mode === "collectible") setMode(draft.mode);
        for (const [key, setter] of [["collectibleTags", setCollectibleTags], ["collectorTags", setCollectorTags]] as const) {
          if (Array.isArray(draft[key])) setter((draft[key] as PostTag[]).filter(item => typeof item?.id === "string" && typeof item?.name === "string").slice(0, 10));
        }
        setPostUri(typeof draft.postUri === "string" ? draft.postUri : null);
        setPostMimeType(typeof draft.postMimeType === "string" ? draft.postMimeType : "image/jpeg");
        setCaption(typeof draft.caption === "string" ? draft.caption.slice(0, 2_000) : "");
      } catch {
        void AsyncStorage.removeItem(draftKey);
      }
    }).catch(() => { if (active) setRestoreFailed(true); }).finally(() => { if (active && readable) setRestoredDraftKey(draftKey); });
    return () => { active = false; };
  }, [draftKey, restoreNonce]);

  useEffect(() => {
    if (!draftKey || !draftRestored || working) return;
    const task = setTimeout(() => {
      void AsyncStorage.setItem(draftKey, JSON.stringify({ submissionId, mode, caption, collectibleTags, collectorTags, postUri, postMimeType }));
    }, 250);
    return () => clearTimeout(task);
  }, [caption, collectibleTags, collectorTags, draftRestored, draftKey, mode, postMimeType, postUri, submissionId, working]);

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
        const preparedType = prepared === asset ? asset.mimeType ?? "image/jpeg" : "image/jpeg";
        const durable = new File(Paths.document, `post-draft-${randomUUID()}.${preparedType.split("/")[1]}`);
        new File(prepared.uri).copy(durable);
        setPostUri(durable.uri);
        setPostMimeType(preparedType);
      } catch { setMessage(copy.postMediaFailed); }
    }
  }

  async function publishPost() {
    if (social.kind === "demo") return setMessage(copy.demoWriteBlocked);
    if (!draftKey || !draftRestored) return setMessage(copy.postAuthFailed);
    if (!postUri && !caption.trim() && !collectibleTags.length && !collectorTags.length) return setMessage(copy.postContentRequired);
    setAlreadyShared(false);
    setWorking(true);
    setMessage(null);
    try {
      await AsyncStorage.setItem(draftKey, JSON.stringify({ submissionId, mode, caption, collectibleTags, collectorTags, postUri, postMimeType }));
      await createNativePost(postUri, caption, postMimeType, { taggedUserIds: collectorTags.map(tag => tag.id), taggedTemplateIds: collectibleTags.map(tag => tag.id) }, submissionId);
      await AsyncStorage.removeItem(draftKey);
      setSubmissionId(randomUUID());
      setCaption("");
      setPostUri(null);
      setCollectibleTags([]); setCollectorTags([]);
      router.replace("/(tabs)");
    } catch (error) {
      setAlreadyShared(error instanceof Error && error.message.endsWith(":post_already_shared"));
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
            <SeoullyChoiceChip disabled={working || !draftRestored} selected={mode === "post"} label={copy.sharePost} onPress={() => setMode("post")} />
            <SeoullyChoiceChip disabled={working || !draftRestored} selected={mode === "collectible"} label={copy.addCollectible} onPress={() => setMode("collectible")} />
          </View>
          <SeoullyText variant="caption">{copy.draftSavedLocally}</SeoullyText>
          {mode === "post" ? (
            <>
              <SeoullyText variant="secondary">{copy.createPostLead}</SeoullyText>
              {postUri ? <Image source={{ uri: postUri }} style={styles.preview} /> : null}
              <View style={styles.row}>
                <SeoullyButton label={copy.takePostPhoto} disabled={working || !draftRestored} variant="ghost" fill onPress={() => { void choosePostPhoto("camera"); }} />
                <SeoullyButton label={copy.choosePostPhoto} disabled={working || !draftRestored} variant="ghost" fill onPress={() => { void choosePostPhoto("library"); }} />
              </View>
              <TextInput
                editable={!working && draftRestored}
                maxLength={2000}
                placeholder={copy.captionPlaceholder}
                placeholderTextColor={colors.muted}
                value={caption}
                onChangeText={setCaption}
                multiline
                style={[styles.input, styles.caption]}
              />
              <View style={styles.row}>
                <SeoullyButton label={copy.tagCollectible} variant="ghost" fill disabled={working || !draftRestored} onPress={() => setTagPicker("collectible")} />
                <SeoullyButton label={copy.tagCollectors} variant="ghost" fill disabled={working || !draftRestored} onPress={() => setTagPicker("collector")} />
              </View>
              <View style={styles.tabs}>
                {collectibleTags.map(tag => <SeoullyChoiceChip key={tag.id} disabled={working || !draftRestored} selected label={tag.name} onPress={() => setCollectibleTags(tags => tags.filter(item => item.id !== tag.id))} />)}
                {collectorTags.map(tag => <SeoullyChoiceChip key={tag.id} disabled={working || !draftRestored} selected label={tag.subtitle ?? tag.name} onPress={() => setCollectorTags(tags => tags.filter(item => item.id !== tag.id))} />)}
              </View>
              <SeoullyButton label={copy.publishPost} disabled={working || !draftRestored} block onPress={() => { void publishPost(); }} />
            </>
          ) : (
            <>
              <SeoullyText variant="secondary">{copy.catalogEntryLede}</SeoullyText>
              <SeoullyButton label={copy.searchSeoullyCatalog} block onPress={() => router.push("/collect")} />
              <SeoullyText variant="caption">{copy.searchSeoullyCatalogLede}</SeoullyText>
            </>
          )}
          {restoreFailed ? <><SeoullyText accessibilityRole="alert">{copy.postDraftLoadFailed}</SeoullyText><SeoullyButton label={copy.retry} variant="ghost" onPress={() => { setRestoreFailed(false); setRestoreNonce(value => value + 1); }} /></> : null}
          {alreadyShared ? <SeoullyButton label={copy.postNewDraft} variant="ghost" onPress={() => { setSubmissionId(randomUUID()); setAlreadyShared(false); setMessage(null); }} /> : null}
          {message ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{message}</SeoullyText> : null}
        </ScrollView>
      </KeyboardScreen>
      {tagPicker ? <PostTagPicker kind={tagPicker} selected={tagPicker === "collectible" ? collectibleTags : collectorTags} onClose={() => setTagPicker(null)} onSelect={tag => {
        if (working) return;
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
