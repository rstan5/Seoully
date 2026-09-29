import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { updateNativeProfile, type NativeIdentity } from "../src/api";
import { useSocialRepository } from "../src/data";
import { KeyboardScreen } from "../src/components/KeyboardScreen";
import { RetryNotice } from "../src/components/RetryNotice";
import { useCopy, useLocale } from "../src/locale";
import { supabase } from "../src/supabase";
import { colors, sizes } from "../src/theme";
import { SeoullyAvatar } from "../src/ui/SeoullyAvatar";
import { SeoullyField } from "../src/ui/SeoullyField";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function EditProfileScreen() {
  const router = useRouter();
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const [identity, setIdentity] = useState<NativeIdentity | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const social = useSocialRepository();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await social.loadIdentity();
      if (!next?.user.id) throw new Error("identity_unavailable");
      setIdentity(next);
      setDisplayName(next.user.displayName);
      setTagline(next.profile.tagline ?? "");
      setBio(next.profile.bio ?? "");
      setLocation(next.profile.location ?? "");
      setError(null);
    } catch {
      setError(copy.profileUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.profileUnavailable, social]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  async function save() {
    if (social.kind === "demo") { setMessage(copy.demoWriteBlocked); return; }
    if (busy || !displayName.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateNativeProfile({
        displayName: displayName.trim(),
        tagline: tagline.trim(),
        bio: bio.trim(),
        location: location.trim(),
      });
      router.back();
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

  return (
    <SeoullyScreen>
      <KeyboardScreen>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()} style={styles.topAction}>
            <SeoullyText variant="body">{copy.editCancel}</SeoullyText>
          </Pressable>
          <SeoullyText variant="handle" style={styles.topTitle}>{copy.profileEdit}</SeoullyText>
          <View style={styles.topEnd}>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.switchLanguage} onPress={toggleLocale} style={styles.topAction}>
              <SeoullyText variant="button">{copy.switchLanguage}</SeoullyText>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void save(); }} style={styles.topAction}>
              <SeoullyText variant="handle" color={colors.plum}>{busy ? copy.saving : copy.editSave}</SeoullyText>
            </Pressable>
          </View>
        </View>

        {loading && !identity ? <SeoullyLoadingState label={copy.profileEdit} /> : null}
        {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}

        {identity ? (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <SeoullyText variant="section">{copy.editIdentity}</SeoullyText>
            <View style={styles.photo}>
              <SeoullyAvatar name={displayName || identity.user.displayName} size={88} />
              <SeoullyText variant="caption" style={styles.photoHint}>{copy.editPhotoHint}</SeoullyText>
            </View>
            {message ? <SeoullyText variant="caption" color={colors.plum} style={styles.message}>{message}</SeoullyText> : null}
            <SeoullyField
              appearance="mist"
              label={copy.profileDisplayName}
              value={displayName}
              onChangeText={setDisplayName}
              autoCorrect={false}
            />
            <SeoullyField
              appearance="mist"
              label={copy.profileTagline}
              value={tagline}
              onChangeText={setTagline}
              placeholder={copy.profileTaglinePlaceholder}
            />
            <SeoullyField
              appearance="mist"
              label={copy.profileBio}
              value={bio}
              onChangeText={setBio}
              placeholder={copy.profileBioPlaceholder}
              multiline
            />
            <SeoullyField
              appearance="mist"
              label={copy.profileLocation}
              value={location}
              onChangeText={setLocation}
              placeholder={copy.profileLocationPlaceholder}
            />

            <View style={styles.section}>
              <SeoullyText variant="section">{copy.editCollectorTastes}</SeoullyText>
              <SeoullyText variant="secondary" style={styles.hint}>
                {[identity.profile.collectorType, ...(identity.profile.collectorInterests ?? [])].filter(Boolean).join(" · ") || copy.editCollectorTastes}
              </SeoullyText>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/onboarding", params: { edit: "1" } })}
                style={styles.link}
              >
                <SeoullyText variant="button" color={colors.plum}>{copy.editCollectorTastes}</SeoullyText>
              </Pressable>
            </View>

            <Pressable accessibilityRole="button" disabled={busy} onPress={() => { void signOut(); }} style={styles.signOut}>
              <SeoullyText variant="button" color={colors.plum}>{copy.signOut}</SeoullyText>
            </Pressable>
          </ScrollView>
        ) : null}
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    minHeight: sizes.topBar,
    paddingHorizontal: 8,
  },
  topAction: { justifyContent: "center", minHeight: 44, paddingHorizontal: 8 },
  topTitle: { flex: 1, textAlign: "center" },
  topEnd: { alignItems: "center", flexDirection: "row" },
  body: { paddingBottom: 48, paddingHorizontal: 16, paddingTop: 18 },
  notice: { paddingHorizontal: 16, paddingTop: 12 },
  photo: { alignItems: "center", gap: 8, marginBottom: 18, marginTop: 14 },
  photoHint: { paddingHorizontal: 24, textAlign: "center" },
  message: { marginBottom: 12 },
  section: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 16, paddingTop: 22 },
  hint: { marginBottom: 8, marginTop: 6 },
  link: { justifyContent: "center", minHeight: 44 },
  signOut: { justifyContent: "center", marginTop: 28, minHeight: 44 },
});
