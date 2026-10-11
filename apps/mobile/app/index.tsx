import { HeartGreeting } from "../src/ui/HeartGreeting";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { mobileConfig } from "../src/config";
import { KeyboardScreen } from "../src/components/KeyboardScreen";
import { useCopy, useLocale } from "../src/locale";
import { supabase } from "../src/supabase";
import { useBootstrap } from "../src/startup/BootstrapProvider";
import { colors } from "../src/theme";
import { BrandMark } from "../src/ui/BrandMark";
import { SeoullyButton } from "../src/ui/SeoullyControls";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function Index() {
  const t = useCopy();
  const { toggleLocale } = useLocale();
  const boot = useBootstrap();
  const [gate, setGate] = useState<"welcome" | "create" | "signin">("welcome");
  const [createMode, setCreateMode] = useState(false);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    else boot.refresh();
  }

  return (
    <SeoullyScreen edges={["top", "bottom"]}>
      <KeyboardScreen>
        <View style={styles.container}>
          {gate !== "welcome" ? <View style={styles.topline}>
            <BrandMark />
            <Pressable accessibilityRole="button" onPress={toggleLocale} style={styles.language}>
              <SeoullyText variant="button">{t.switchLanguage}</SeoullyText>
            </Pressable>
          </View> : null}
          {gate === "welcome" ? (
            <View style={styles.welcome}>
              <View style={styles.hero}><HeartGreeting large text={`${t.welcomeLine1}\n${t.welcomeLine2}`} /></View>
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
                  label={submitting ? t.saving : createMode ? t.createAccount : t.signIn}
                  disabled={submitting || !mobileConfig.authConfigured}
                  block
                  onPress={() => { void submit(); }}
                />
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
  centered: { flex: 1, gap: 16, justifyContent: "center", paddingHorizontal: 16 },
  welcome: { flex: 1, gap: 12, paddingBottom: 12 },
  hero: { flex: 1, justifyContent: "center", paddingBottom: 32 },
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
