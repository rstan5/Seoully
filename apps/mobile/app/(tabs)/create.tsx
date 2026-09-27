import { useEffect, useState } from "react";
import { Image, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { contributeCatalogItem, createNativePost } from "../../src/api";
import { useCopy } from "../../src/locale";
import { colors, spacing } from "../../src/theme";

const CREATE_DRAFT_KEY = "seoully.mobile.create-draft.v1";

export default function CreateScreen() {
  const copy = useCopy();
  const router = useRouter();
  const [mode, setMode] = useState<"post" | "collectible">("post");
  const [name, setName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [memberName, setMemberName] = useState("");
  const [releaseName, setReleaseName] = useState("");
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
      void AsyncStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({ mode, name, groupName, memberName, releaseName, caption }));
    }, 250);
    return () => clearTimeout(task);
  }, [caption, draftRestored, groupName, memberName, mode, name, releaseName]);

  async function choosePostPhoto() {
    setMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setMessage(copy.postPhotoRequired);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, exif: false });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) {
      setPostUri(asset.uri);
      setPostMimeType(asset.mimeType ?? "image/jpeg");
    }
  }

  async function publishPost() {
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
    if (!name.trim()) return setMessage(copy.collectibleNameRequired);
    if (!groupName.trim()) return setMessage(copy.groupNameRequired);
    setWorking(true);
    setMessage(null);
    try {
      const result = await contributeCatalogItem({ name, groupName, memberName: memberName || undefined, releaseName: releaseName || undefined, kind: "photocard" });
      await AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      setName(""); setGroupName(""); setMemberName(""); setReleaseName("");
      router.push({ pathname: "/add", params: { templateId: result.contribution.template.id, name: result.contribution.template.name, kind: result.contribution.template.kind, newTemplate: "true" } });
    } catch {
      setMessage(copy.collectibleCreateFailed);
    } finally {
      setWorking(false);
    }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{copy.create}</Text>
    <View style={styles.tabs}>
      <ModeButton selected={mode === "post"} label={copy.sharePost} onPress={() => setMode("post")} />
      <ModeButton selected={mode === "collectible"} label={copy.addManually} onPress={() => setMode("collectible")} />
    </View>
    <Text style={styles.draftNote}>{copy.draftSavedLocally}</Text>
    {mode === "post" ? <>
      <Text style={styles.body}>{copy.createPostLead}</Text>
      {postUri ? <Image source={{ uri: postUri }} style={styles.preview} /> : null}
      <Pressable accessibilityRole="button" onPress={choosePostPhoto} style={styles.secondary}><Text style={styles.secondaryText}>{copy.choosePostPhoto}</Text></Pressable>
      <TextInput maxLength={2000} placeholder={copy.captionPlaceholder} value={caption} onChangeText={setCaption} multiline style={[styles.input, styles.caption]} />
      <Pressable accessibilityRole="button" disabled={working} onPress={publishPost} style={styles.button}><Text style={styles.buttonText}>{copy.publishPost}</Text></Pressable>
    </> : <>
      <Text style={styles.body}>{copy.addManualLead}</Text>
      <TextInput maxLength={200} placeholder={copy.collectibleNamePlaceholder} value={name} onChangeText={setName} style={styles.input} />
      <TextInput maxLength={120} placeholder={copy.groupPlaceholder} value={groupName} onChangeText={setGroupName} style={styles.input} />
      <TextInput maxLength={120} placeholder={copy.memberOptionalPlaceholder} value={memberName} onChangeText={setMemberName} style={styles.input} />
      <TextInput maxLength={160} placeholder={copy.releaseOptionalPlaceholder} value={releaseName} onChangeText={setReleaseName} style={styles.input} />
      <Pressable accessibilityRole="button" disabled={working} onPress={submitCollectible} style={styles.button}><Text style={styles.buttonText}>{copy.continue}</Text></Pressable>
    </>}
    {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
  </ScrollView></SafeAreaView>;
}

function draftText(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function ModeButton({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="tab" accessibilityState={{ selected }} onPress={onPress} style={[styles.tab, selected && styles.tabSelected]}><Text style={[styles.tabText, selected && styles.tabTextSelected]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 100 },
  title: { color: colors.ink, fontSize: 32, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  tab: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  tabSelected: { backgroundColor: colors.plum, borderColor: colors.plum },
  tabText: { color: colors.ink, fontWeight: "700" },
  tabTextSelected: { color: colors.surface },
  draftNote: { color: colors.muted, fontSize: 12 },
  body: { color: colors.muted, fontSize: 16, marginBottom: spacing.md, marginTop: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, minHeight: 50, paddingHorizontal: spacing.md },
  caption: { minHeight: 100, paddingTop: spacing.md, textAlignVertical: "top" },
  preview: { aspectRatio: 4 / 3, borderRadius: 16, width: "100%" },
  secondary: { alignItems: "center", borderColor: colors.plum, borderRadius: 14, borderWidth: 1, justifyContent: "center", minHeight: 50 },
  secondaryText: { color: colors.plum, fontWeight: "700" },
  button: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", marginTop: spacing.sm, minHeight: 52 },
  buttonText: { color: colors.surface, fontWeight: "700" },
  message: { color: colors.plum, marginTop: spacing.sm },
});
