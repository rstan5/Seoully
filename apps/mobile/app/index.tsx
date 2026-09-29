import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { mobileConfig } from "../src/config";
import { loadNativeOnboarding } from "../src/api";
import { KeyboardScreen } from "../src/components/KeyboardScreen";
import { useCopy, useLocale } from "../src/locale";
import { supabase } from "../src/supabase";
import { colors } from "../src/theme";
import { BrandMark } from "../src/ui/BrandMark";
import { SeoullyButton } from "../src/ui/SeoullyControls";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function Index() {
  const router = useRouter();
  const t = useCopy();
  const { toggleLocale } = useLocale();
  const [ready, setReady] = useState(false);
  const [gate, setGate] = useState<"welcome" | "create" | "signin">("welcome");
  const [createMode, setCreateMode] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const routeAfterAuth = useCallback(async () => {
    if (!mobileConfig.productApiConfigured) {
      setMessage(t.productApiUnconfigured);
      return;
    }
    try {
      const onboarding = await loadNativeOnboarding();
      router.replace(onboarding.step === "done" ? "/(tabs)" : "/onboarding");
    } catch {
      setMessage(t.onboardingUnavailable);
    }
  }, [router, t.onboardingUnavailable, t.productApiUnconfigured]);

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
    return <SeoullyScreen><SeoullyLoadingState label={t.brand} /></SeoullyScreen>;
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
    <SeoullyScreen>
      <KeyboardScreen>
        <View style={styles.container}>
          <View style={styles.topline}>
            <BrandMark />
            <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
              <SeoullyText variant="button">{t.switchLanguage}</SeoullyText>
            </Pressable>
          </View>
          {gate === "welcome" ? (
            <View style={styles.welcome}>
              <SeoullyText variant="title" style={styles.welcomeTitle}>
                {t.welcomeLine1}{"\n"}{t.welcomeLine2}
              </SeoullyText>
              <SeoullyText variant="secondary" style={styles.tagline}>{t.welcomeLede}</SeoullyText>
              <SeoullyButton label={t.welcomeCreate} block onPress={() => { setGate("create"); setCreateMode(true); }} />
              <Pressable accessibilityRole="button" onPress={() => { setGate("signin"); setCreateMode(false); }} style={styles.secondary}>
                <SeoullyText variant="button" color={colors.plum}>{t.welcomeSignin}</SeoullyText>
              </Pressable>
            </View>
          ) : null}
          {gate !== "welcome" ? (
            <>
              <SeoullyText variant="secondary" style={styles.tagline}>{t.tagline}</SeoullyText>
              {!mobileConfig.authConfigured ? (
                <SeoullyText variant="secondary" color={colors.plum} style={styles.warning}>{t.notConfigured}</SeoullyText>
              ) : !mobileConfig.productApiConfigured ? (
                <SeoullyText variant="secondary" color={colors.plum} style={styles.warning}>{t.productApiUnconfigured}</SeoullyText>
              ) : null}
              <View style={styles.form}>
                {createMode ? (
                  <>
                    <TextInput autoCapitalize="none" autoCorrect={false} placeholder={t.username} placeholderTextColor={colors.muted} value={handle} onChangeText={setHandle} style={styles.input} />
                    <TextInput autoCorrect={false} placeholder={t.displayName} placeholderTextColor={colors.muted} value={displayName} onChangeText={setDisplayName} style={styles.input} />
                  </>
                ) : null}
                <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder={t.email} placeholderTextColor={colors.muted} value={email} onChangeText={setEmail} style={styles.input} />
                <TextInput secureTextEntry placeholder={t.password} placeholderTextColor={colors.muted} value={password} onChangeText={setPassword} style={styles.input} />
                <SeoullyButton
                  label={createMode ? t.createAccount : t.signIn}
                  disabled={submitting || !mobileConfig.authConfigured}
                  block
                  onPress={() => { void submit(); }}
                />
                {submitting ? <ActivityIndicator color={colors.plum} /> : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCreateMode((value) => !value);
                    setGate((current) => (current === "create" ? "signin" : "create"));
                    setMessage(null);
                  }}
                  style={styles.secondary}
                >
                  <SeoullyText variant="button" color={colors.plum}>{createMode ? t.signIn : t.createAccount}</SeoullyText>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => { setGate("welcome"); setMessage(null); }} style={styles.secondary}>
                  <SeoullyText variant="button">{t.back}</SeoullyText>
                </Pressable>
                {message ? <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum}>{message}</SeoullyText> : null}
              </View>
            </>
          ) : message ? (
            <SeoullyText accessibilityRole="alert" variant="secondary" color={colors.plum} style={styles.tagline}>{message}</SeoullyText>
          ) : null}
        </View>
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", paddingHorizontal: 16 },
  topline: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  language: { justifyContent: "center", minHeight: 44, paddingHorizontal: 4 },
  welcome: { gap: 16, marginTop: 28 },
  welcomeTitle: { letterSpacing: -0.8, lineHeight: 36 },
  tagline: { marginTop: 8, lineHeight: 22 },
  warning: { backgroundColor: colors.lilacSoft, borderRadius: 14, marginTop: 16, padding: 14 },
  form: { gap: 10, marginTop: 24 },
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
  secondary: { alignItems: "center", justifyContent: "center", minHeight: 44 },
});
