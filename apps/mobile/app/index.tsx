import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { mobileConfig } from "../src/config";
import { loadNativeOnboarding } from "../src/api";
import { useCopy, useLocale } from "../src/locale";
import { supabase } from "../src/supabase";
import { colors, spacing } from "../src/theme";

export default function Index() {
  const router = useRouter();
  const t = useCopy();
  const { toggleLocale } = useLocale();
  const [ready, setReady] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const routeAfterAuth = useCallback(async () => {
    try {
      const onboarding = await loadNativeOnboarding();
      router.replace(onboarding.step === "done" ? "/(tabs)" : "/onboarding");
    } catch {
      setMessage(t.onboardingUnavailable);
    }
  }, [router, t.onboardingUnavailable]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) void routeAfterAuth().finally(() => mounted && setReady(true));
      else setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && event === "SIGNED_IN") void routeAfterAuth();
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [routeAfterAuth]);

  if (!ready) {
    return <View style={styles.loading}><ActivityIndicator color={colors.plum} /></View>;
  }

  async function submit() {
    const normalizedHandle = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (
      !email.trim()
      || password.length < (createMode ? 8 : 1)
      || (createMode && (!/^[a-z][a-z0-9_]{2,15}$/.test(normalizedHandle) || !displayName.trim()))
    ) {
      setMessage(createMode ? t.authInvalid : t.signInInvalid);
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const result = createMode
      ? await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { handle: normalizedHandle, display_name: displayName.trim() } },
        })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (createMode && !result.data.session) setMessage(t.emailConfirmation);
    else await routeAfterAuth();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.topline}>
          <Text style={styles.brand}>{t.brand} ♡</Text>
          <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
            <Text style={styles.secondaryText}>{t.switchLanguage}</Text>
          </Pressable>
        </View>
        <Text style={styles.tagline}>{t.tagline}</Text>
        {!mobileConfig.isConfigured && <Text style={styles.warning}>{t.notConfigured}</Text>}
        <View style={styles.form}>
          {createMode && (
            <>
              <TextInput autoCapitalize="none" autoCorrect={false} placeholder={t.username} value={handle} onChangeText={setHandle} style={styles.input} />
              <TextInput autoCorrect={false} placeholder={t.displayName} value={displayName} onChangeText={setDisplayName} style={styles.input} />
            </>
          )}
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder={t.email} value={email} onChangeText={setEmail} style={styles.input} />
          <TextInput secureTextEntry placeholder={t.password} value={password} onChangeText={setPassword} style={styles.input} />
          <Pressable accessibilityRole="button" onPress={submit} disabled={submitting || !mobileConfig.isConfigured} style={styles.primary}>
            {submitting ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.primaryText}>{createMode ? t.createAccount : t.signIn}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setCreateMode((value) => !value); setMessage(null); }} style={styles.secondary}>
            <Text style={styles.secondaryText}>{createMode ? t.signIn : t.createAccount}</Text>
          </Pressable>
          {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.canvas },
  safe: { flex: 1, backgroundColor: colors.canvas },
  container: { flex: 1, justifyContent: "center", padding: spacing.lg },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  brand: { color: colors.ink, fontSize: 38, fontWeight: "700", letterSpacing: -1 },
  language: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  tagline: { color: colors.muted, fontSize: 17, marginTop: spacing.xs },
  warning: { color: colors.plum, backgroundColor: colors.blush, borderRadius: 14, marginTop: spacing.lg, padding: spacing.md, lineHeight: 20 },
  form: { gap: spacing.sm, marginTop: spacing.xl },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 52, paddingHorizontal: spacing.md },
  primary: { alignItems: "center", backgroundColor: colors.plum, borderRadius: 16, justifyContent: "center", minHeight: 54, marginTop: spacing.xs },
  primaryText: { color: colors.surface, fontSize: 16, fontWeight: "700" },
  secondary: { alignItems: "center", minHeight: 44, justifyContent: "center" },
  secondaryText: { color: colors.plum, fontSize: 15, fontWeight: "600" },
  message: { color: colors.plum, fontSize: 14, lineHeight: 20 },
});
