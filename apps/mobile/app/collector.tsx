import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { ensureConversation, loadCollectorProfile, setCollectorFollowing, type NativeCollectorProfile } from "../src/api";
import { useCopy } from "../src/locale";
import { colors, spacing } from "../src/theme";

export default function CollectorScreen() {
  const copy = useCopy();
  const router = useRouter();
  const { userId = "" } = useLocalSearchParams<{ userId?: string }>();
  const [profile, setProfile] = useState<NativeCollectorProfile | null>(null);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadCollectorProfile(userId)
      .then((result) => {
        if (!active) return;
        setProfile(result.profile);
        setFollowing(result.follow.following);
        setFollowers(result.follow.followers);
      })
      .catch(() => { if (active) setError(copy.collectorUnavailable); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [copy.collectorUnavailable, userId]);

  async function toggleFollow() {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setFollowers((count) => Math.max(0, count + (next ? 1 : -1)));
    setBusy(true);
    try { await setCollectorFollowing(userId, next); }
    catch {
      setFollowing(!next);
      setFollowers((count) => Math.max(0, count + (next ? -1 : 1)));
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const conversationId = await ensureConversation(userId);
      router.push({ pathname: "/thread", params: { conversationId, displayName: profile.user.displayName, handle: profile.user.handle } });
    } catch {
      setError(copy.messagesUnavailable);
    } finally {
      setBusy(false);
    }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    {loading ? <ActivityIndicator color={colors.plum} /> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {profile ? <>
      <Text style={styles.title}>{profile.user.displayName}</Text>
      <Text style={styles.handle}>@{profile.user.handle}</Text>
      {profile.profile.tagline ? <Text style={styles.tagline}>{profile.profile.tagline}</Text> : null}
      {profile.profile.bio ? <Text style={styles.bio}>{profile.profile.bio}</Text> : null}
      <View style={styles.stats}>
        <Text style={styles.stat}>{followers} {copy.followers}</Text>
        <Text style={styles.stat}>{profile.followingCount} {copy.following.toLowerCase()}</Text>
        {profile.collectionSummary ? <Text style={styles.stat}>{profile.collectionSummary.holdingCount} {copy.holdings}</Text> : null}
        {profile.collectionSummary ? <Text style={styles.stat}>{profile.collectionSummary.groupCount} {copy.groups}</Text> : null}
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: following }} disabled={busy} onPress={toggleFollow} style={[styles.button, following && styles.secondary]}><Text style={[styles.buttonText, following && styles.secondaryText]}>{following ? copy.following : copy.follow}</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={message} style={styles.button}><Text style={styles.buttonText}>{copy.messageCollector}</Text></Pressable>
      </View>
    </> : null}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.canvas, flex: 1 },
  container: { padding: spacing.lg },
  error: { color: colors.plum, marginTop: spacing.md },
  title: { color: colors.ink, fontSize: 32, fontWeight: "700" },
  handle: { color: colors.plum, fontSize: 16, marginTop: spacing.xs },
  tagline: { color: colors.ink, fontSize: 18, fontWeight: "600", marginTop: spacing.lg },
  bio: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: spacing.sm },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  stat: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999, borderWidth: 1, color: colors.ink, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  button: { alignItems: "center", backgroundColor: colors.plum, borderColor: colors.plum, borderRadius: 14, borderWidth: 1, flex: 1, justifyContent: "center", minHeight: 50 },
  buttonText: { color: colors.surface, fontWeight: "700" },
  secondary: { backgroundColor: colors.surface },
  secondaryText: { color: colors.plum },
});
