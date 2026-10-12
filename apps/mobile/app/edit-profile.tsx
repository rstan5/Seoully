import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { randomUUID } from "expo-crypto";
import { readSelectedCatalogIdentity } from "../src/data/collectorIdentity";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ProfileIdentityProvider } from "../src/ui/ProfileIdentity";
import { identityPalette } from "../src/ui/profileContrast";
import { nativeProfileTheme } from "../src/room/profileRoom";
import { SeoullyButton } from "../src/ui/SeoullyControls";
import { ProfileTastePicker, type TasteOption } from "../src/ui/ProfileTastePicker";
import { COLLECTOR_ARCHETYPES, archetypeLabel } from "../src/ui/collectorArchetypes";
import type { ProfileThemeChoice } from "seoully-domain/types";
import { ProfileAppearanceEditor } from "../src/ui/ProfileAppearanceEditor";
import { readOwnerProfileRoom } from "../src/room/useProfileRoom";
import { parseRoomStyle, type NativeRoomStyle } from "../src/room/roomStyle";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { loadNativeOnboarding, updateNativeProfile, readProfileCapabilities, uploadProfileAvatar, type NativeIdentity, type ProfileCapabilities } from "../src/api";
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
  const insets = useSafeAreaInsets();
  const latestCopy = useRef(copy);
  const refreshGeneration = useRef(0);
  useEffect(() => { latestCopy.current = copy; }, [copy]);
  const [collectorType, setCollectorType] = useState("Collector");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [biasIds, setBiasIds] = useState<string[]>([]);
  const [groupOptions, setGroupOptions] = useState<TasteOption[]>([]);
  const [biasOptions, setBiasOptions] = useState<TasteOption[]>([]);
  const [avatarDraft, setAvatarDraft] = useState<{ uri: string; submissionId: string } | null>(null);
  const [avatarChoices, setAvatarChoices] = useState(false);
  const [capabilities, setCapabilities] = useState<ProfileCapabilities>({ profileAvatar: false, catalogIdentityContributions: false });
  const [identity, setIdentity] = useState<NativeIdentity | null>(null);
  const [appearance, setAppearance] = useState<ProfileThemeChoice>({ mode: "room-sync" });
  const [roomStyle, setRoomStyle] = useState<NativeRoomStyle>();
  const [displayName, setDisplayName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tastePending, setTastePending] = useState(0);
  const tasteBusyChanged = useCallback((active: boolean) => setTastePending(n => Math.max(0, n + (active ? 1 : -1))), []);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const social = useSocialRepository();

  const refresh = useCallback(async () => {
    const generation = ++refreshGeneration.current;
    setLoading(true);
    try {
      const next = await social.loadIdentity();
      if (!next?.user.id) throw new Error("identity_unavailable");
      const caps = social.kind === "production" ? await readProfileCapabilities() : { profileAvatar: false, catalogIdentityContributions: false };
      const room = social.kind === "production" ? await readOwnerProfileRoom(next.user.id).catch(() => { setMessage(latestCopy.current.roomUnavailable); return null; }) : null;
      const [tastes, selectedCatalog] = social.kind === "production" ? await Promise.all([loadNativeOnboarding().catch(() => null), readSelectedCatalogIdentity(next.profile.favoriteGroupIds, next.profile.biasMemberIds).catch(() => ({ groups: [], members: [] }))]) : [null, { groups: [], members: [] }];
      if (generation !== refreshGeneration.current) return;
      setCapabilities(caps);
      setRoomStyle(room ? parseRoomStyle(room.style) : undefined);
      setGroupOptions([...(tastes?.groups ?? []).map(g => ({ id: g.id, name: g.name })), ...selectedCatalog.groups]);
      setBiasOptions([...(tastes?.members ?? []).map(m => ({ id: m.id, name: m.stageName, groupId: m.groupId })), ...selectedCatalog.members.map(m => ({ id: m.id, name: m.stageName, groupId: m.groupId, groupName: m.groupName }))]);
      setCollectorType(next.profile.collectorType ?? "Collector");
      setGroupIds(next.profile.favoriteGroupIds);
      setBiasIds(next.profile.biasMemberIds);
      setIdentity(next);
      setAppearance(next.profile.appearance ?? { mode: "room-sync" });
      setDisplayName(next.user.displayName);
      setTagline(next.profile.tagline ?? "");
      setBio(next.profile.bio ?? "");
      setLocation(next.profile.location ?? "");
      setError(null);
    } catch {
      if (generation !== refreshGeneration.current) return;
      setError(latestCopy.current.profileUnavailable);
    } finally {
      if (generation === refreshGeneration.current) setLoading(false);
    }
  }, [social]);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { refreshGeneration.current++; };
  }, [refresh]));

  async function save() {
    if (social.kind === "demo") { setMessage(copy.demoWriteBlocked); return; }
    if (busy || tastePending > 0 || !displayName.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const avatarSubmissionId = avatarDraft ? await uploadProfileAvatar(avatarDraft.uri, avatarDraft.submissionId) : undefined;
      const saved = await updateNativeProfile({
        ...(avatarSubmissionId ? { avatarSubmissionId } : {}),
        displayName: displayName.trim(),
        tagline: tagline.trim(),
        bio: bio.trim(),
        location: location.trim(),
        appearance,
        collectorType,
        favoriteGroupIds: [...new Set(groupIds)],
        biasMemberIds: [...new Set(biasIds)],
      });
      if (!saved.identity?.profile.appearance || (avatarSubmissionId && !saved.identity.profile.avatarUrl)) throw new Error("profile_save_unconfirmed");
      setIdentity(saved.identity);
      setAppearance(saved.identity.profile.appearance);
      router.back();
    } catch {
      setMessage(copy.profileSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function pickAvatar(camera: boolean) {
    if (busy || !capabilities.profileAvatar) return;
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) { setMessage(copy.profilePhotoPermission); return; }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 1 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      const image = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 768 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      setAvatarDraft({ uri: image.uri, submissionId: randomUUID() });
      setAvatarChoices(false); setMessage(null);
    } catch { setMessage(copy.profilePhotoFailed); }
  }

  async function signOut() {
    if (busy || tastePending > 0) return;
    setBusy(true);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setMessage(copy.signOutFailed);
      setBusy(false);
    }
  }

  const palette = useMemo(() => identityPalette(nativeProfileTheme(appearance, roomStyle)), [appearance, roomStyle]);

  if (loading && !identity && !error) return <SeoullyLoadingState fullScreen label={copy.profileEdit} />;

  return (
    <SeoullyScreen backgroundColor={palette.mist}>
      <ProfileIdentityProvider palette={palette}>
      <KeyboardScreen>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" disabled={busy || tastePending > 0} onPress={() => router.back()} style={styles.topAction}>
            <SeoullyText variant="body">{copy.editCancel}</SeoullyText>
          </Pressable>
          <View pointerEvents="none" style={styles.titleCenter}><SeoullyText variant="handle">{copy.profileEdit}</SeoullyText></View>
          <View style={styles.topEnd}>
            <Pressable accessibilityRole="button" accessibilityLabel={copy.switchLanguage} onPress={toggleLocale} style={styles.topAction}>
              <SeoullyText variant="button">{copy.switchLanguage}</SeoullyText>
            </Pressable>

          </View>
        </View>

        {error ? <View style={styles.notice}><RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /></View> : null}

        {identity ? (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <SeoullyText variant="section">{copy.editIdentity}</SeoullyText>
            <View style={styles.photo}>
              <Pressable accessibilityRole="button" accessibilityLabel={copy.profileChangePhoto} disabled={busy || !capabilities.profileAvatar} onPress={() => setAvatarChoices(v => !v)}>
                <SeoullyAvatar name={displayName || identity.user.displayName} imageUrl={avatarDraft?.uri ?? identity.profile.avatarUrl} size={88} />
              </Pressable>
              <SeoullyText variant="caption" style={styles.photoHint}>{capabilities.profileAvatar ? copy.profileChangePhoto : copy.profileAvatarBlocked}</SeoullyText>
              {avatarChoices ? <View style={styles.archetypes}>
                <SeoullyButton label={copy.profileTakePhoto} onPress={() => { void pickAvatar(true); }} />
                <SeoullyButton label={copy.profileChoosePhoto} onPress={() => { void pickAvatar(false); }} />
              </View> : null}
            </View>
            <SeoullyField
              editable={!busy}
              appearance="mist"
              label={copy.profileDisplayName}
              value={displayName}
              onChangeText={setDisplayName}
              autoCorrect={false}
            />
            <SeoullyField
              editable={!busy}
              appearance="mist"
              label={copy.profileTagline}
              value={tagline}
              onChangeText={setTagline}
              placeholder={copy.profileTaglinePlaceholder}
            />
            <SeoullyField
              editable={!busy}
              appearance="mist"
              label={copy.profileBio}
              value={bio}
              onChangeText={setBio}
              placeholder={copy.profileBioPlaceholder}
              multiline
            />
            <SeoullyField
              editable={!busy}
              appearance="mist"
              label={copy.profileLocation}
              value={location}
              onChangeText={setLocation}
              placeholder={copy.profileLocationPlaceholder}
            />

            <View style={styles.section}>
              <SeoullyText variant="section">{copy.profileArchetype}</SeoullyText>
              <View accessibilityRole="radiogroup" accessibilityLabel={copy.profileArchetype} style={styles.archetypes}>
                {!COLLECTOR_ARCHETYPES.includes(collectorType as typeof COLLECTOR_ARCHETYPES[number]) ? <SeoullyText>{collectorType}</SeoullyText> : null}
                {COLLECTOR_ARCHETYPES.map((value, index) => <Pressable key={value} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: collectorType === value, disabled: busy }} onPress={() => setCollectorType(value)}
                  style={[styles.archetype, { backgroundColor: collectorType === value ? palette.primarySoft : palette.paper, borderColor: collectorType === value ? palette.primary : palette.line }]}>
                  <SeoullyText variant="handle">{archetypeLabel(value, copy)}{collectorType === value ? "  ✓" : ""}</SeoullyText>
                  <SeoullyText variant="caption">{copy[`archetypeHint${index}` as "archetypeHint0"]}</SeoullyText>
                </Pressable>)}
              </View>
            </View>
            <ProfileTastePicker kind="groups" selected={groupIds} onChange={setGroupIds} initialOptions={groupOptions} live={social.kind === "production"} canContribute={capabilities.catalogIdentityContributions} userId={identity.user.id} onBusyChange={tasteBusyChanged} disabled={busy || social.kind === "demo"} />
            <ProfileTastePicker kind="biases" selected={biasIds} onChange={setBiasIds} initialOptions={biasOptions} live={social.kind === "production"} canContribute={capabilities.catalogIdentityContributions} userId={identity.user.id} onBusyChange={tasteBusyChanged} preferredGroups={groupIds} disabled={busy || social.kind === "demo"} />

            <ProfileAppearanceEditor value={appearance} onChange={setAppearance} roomStyle={roomStyle} disabled={busy || social.kind === "demo"} />

            <Pressable accessibilityRole="button" disabled={busy || tastePending > 0} onPress={() => { void signOut(); }} style={styles.signOut}>
              <SeoullyText variant="button" color={palette.primaryDeep}>{copy.signOut}</SeoullyText>
            </Pressable>
          </ScrollView>
        ) : null}
        {identity ? <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: palette.paper, borderTopColor: palette.line }]}>
          {message ? <SeoullyText variant="caption" accessibilityRole="alert">{message}</SeoullyText> : null}
          <SeoullyButton label={busy ? copy.saving : copy.profileSaveChanges} disabled={busy || tastePending > 0 || !displayName.trim() || Boolean(error) || social.kind === "demo"} block onPress={() => { void save(); }} />
        </View> : null}
      </KeyboardScreen>
      </ProfileIdentityProvider>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  titleCenter: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  saveBar: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: StyleSheet.hairlineWidth },
  archetypes: { gap: 8, marginTop: 12 },
  archetype: { minHeight: 56, gap: 5, padding: 14, borderWidth: 1, borderRadius: 16 },
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
  topEnd: { alignItems: "center", flexDirection: "row", marginLeft: "auto" },
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
