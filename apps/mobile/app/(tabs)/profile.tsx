import { useCallback, useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { resolveNativeIdentity, updateNativeProfile } from "../../src/api";
import { RetryNotice } from "../../src/components/RetryNotice";
import { useCopy } from "../../src/locale";
import { supabase } from "../../src/supabase";
import { colors, spacing } from "../../src/theme";

type Identity = { user?: { handle?: string; displayName?: string }; profile?: { bio?: string; tagline?: string } };

export default function ProfileScreen() {
  const router = useRouter();
  const copy = useCopy();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const value = await resolveNativeIdentity<Identity>();
      setIdentity(value);
      setDisplayName(value?.user?.displayName ?? "");
      setTagline(value?.profile?.tagline ?? "");
      setBio(value?.profile?.bio ?? "");
      setError(null);
    } catch {
      setError(copy.profileUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.profileUnavailable]);
  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  async function save() {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateNativeProfile({ displayName, tagline, bio });
      setIdentity((current) => current ? { ...current, user: { ...current.user, displayName } } : current);
      setMessage(copy.profileSaved);
    } catch {
      setMessage(copy.profileSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (busy) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setMessage(copy.signOutFailed);
      setBusy(false);
      return;
    }
    router.replace("/");
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{copy.profile}</Text>
    {loading ? <ActivityIndicator color={colors.plum} style={styles.loading} /> : null}
    {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
    {!loading && !error ? <>
      <Text style={styles.handle}>{identity?.user?.displayName ?? identity?.user?.handle ?? copy.collectorFallback}</Text>
      <View style={styles.destinationRow}><Pressable accessibilityRole="button" onPress={() => router.push("/room")} style={styles.destinationLink}><Text style={styles.collectionLinkText}>{copy.room}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/binder")} style={styles.destinationLink}><Text style={styles.collectionLinkText}>{copy.binder}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/collection")} style={styles.destinationLink}><Text style={styles.collectionLinkText}>{copy.collection}</Text></Pressable></View>
      <TextInput accessibilityLabel={copy.profileDisplayName} placeholder={copy.profileDisplayName} value={displayName} onChangeText={setDisplayName} style={styles.shortInput} />
      <TextInput accessibilityLabel={copy.profileTagline} placeholder={copy.profileTaglinePlaceholder} value={tagline} onChangeText={setTagline} style={styles.shortInput} />
      <TextInput accessibilityLabel={copy.profileBio} placeholder={copy.profileBioPlaceholder} value={bio} onChangeText={setBio} multiline style={styles.input} />
      <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={styles.button}><Text style={styles.buttonText}>{copy.saveProfile}</Text></Pressable>
      {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={signOut} style={styles.secondary}><Text style={styles.secondaryText}>{copy.signOut}</Text></Pressable>
    </> : null}
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, container: { padding: spacing.lg, paddingBottom: 100 }, title: { color: colors.ink, fontSize: 32, fontWeight: "700" }, loading: { marginTop: spacing.lg }, handle: { color: colors.plum, fontSize: 17, fontWeight: "700", marginTop: spacing.sm }, destinationRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }, destinationLink: { alignItems: "center", borderColor: colors.plum, borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 48 }, collectionLinkText: { color: colors.plum, fontWeight: "700" }, shortInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, minHeight: 50, marginTop: spacing.md, paddingHorizontal: spacing.md }, input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, minHeight: 110, marginTop: spacing.md, padding: spacing.md, textAlignVertical: "top" }, button: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 14, justifyContent: "center", marginTop: spacing.md, minHeight: 52 }, buttonText: { color: colors.surface, fontWeight: "700" }, message: { color: colors.plum, marginTop: spacing.md }, secondary: { alignItems: "center", justifyContent: "center", marginTop: spacing.lg, minHeight: 44 }, secondaryText: { color: colors.plum, fontWeight: "700" } });
