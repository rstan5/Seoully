import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import type { Session } from "@supabase/supabase-js";
import { mobileConfig } from "../src/config";
import { copy } from "../src/i18n";
import { supabase } from "../src/supabase";
import { colors, spacing } from "../src/theme";

export default function Index() {
  const router = useRouter();
  const t = copy();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [createMode, setCreateMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  if (!ready) {
    return <View style={styles.loading}><ActivityIndicator color={colors.plum} /></View>;
  }
  if (session) return <Redirect href="/(tabs)" />;

  async function submit() {
    if (!email.trim() || password.length < 6) {
      setMessage("Enter a valid email and a password with at least 6 characters.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const result = createMode
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSubmitting(false);
    if (result.error) { setMessage(result.error.message); return; }
    if (createMode && !result.data.session) setMessage("Check your email to confirm your account.");
    else router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.brand}>{t.brand} ♡</Text>
        <Text style={styles.tagline}>{t.tagline}</Text>
        {!mobileConfig.isConfigured && <Text style={styles.warning}>{t.notConfigured}</Text>}
        <View style={styles.form}>
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
  brand: { color: colors.ink, fontSize: 38, fontWeight: "700", letterSpacing: -1 },
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
