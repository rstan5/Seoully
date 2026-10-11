import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { ACCENT_PICKER, BACKGROUND_PRESETS, accentSwatch } from "seoully-domain/profile-theme";
import type { ProfileThemeChoice } from "seoully-domain/types";
import { translate, type Translate } from "../../../../src/locale/translate";
import { themePresetLabel } from "../../../../src/locale/copy";
import { useLocale } from "../locale";
import { resolveRoomLook } from "../room/roomStyle";
import { nativeProfileTheme, type ProfileRoomPreview } from "../room/profileRoom";
import { identityPalette } from "./profileContrast";
import { ProfileIdentityProvider } from "./ProfileIdentity";
import { SeoullyText } from "./SeoullyText";

export function ProfileAppearanceEditor({ value, onChange, roomStyle, disabled }: {
  value: ProfileThemeChoice; onChange: (value: ProfileThemeChoice) => void;
  roomStyle?: ProfileRoomPreview["style"]; disabled?: boolean;
}) {
  const { locale } = useLocale();
  const t: Translate = (key, params) => translate(locale, key, params);
  const palette = useMemo(() => identityPalette(nativeProfileTheme(value, roomStyle), roomStyle ? resolveRoomLook(roomStyle).void : undefined), [value, roomStyle]);
  function choice(label: string, selected: boolean, choose: () => void, color?: string) {
    return <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label} disabled={disabled} onPress={choose}
      style={[styles.choice, { borderColor: selected ? palette.primaryDeep : palette.line, backgroundColor: palette.paper }]}>
      {color ? <View style={[styles.swatch, { backgroundColor: color, borderColor: palette.line }]} /> : null}
      <SeoullyText variant="caption" color={palette.ink}>{label}</SeoullyText>
    </Pressable>;
  }
  return <ProfileIdentityProvider palette={palette}><View style={[styles.preview, { backgroundColor: palette.mist, borderColor: palette.line }]}>
    <SeoullyText variant="section">{t("edit.appearance")}</SeoullyText>
    <SeoullyText variant="secondary">{t("edit.appearanceLede")}</SeoullyText>
    <View accessibilityRole="radiogroup" accessibilityLabel={t("edit.profileAppearance")} style={styles.row}>
      {choice(t("edit.modeDefault"), value.mode === "default", () => onChange({ mode: "default" }))}
      {choice(t("edit.modeCustom"), value.mode === "custom", () => onChange({ mode: "custom", background: value.background ?? "paper", primary: value.primary ?? "lavender", secondary: value.secondary ?? "powder-pink" }))}
      {choice(t("edit.modeRoom"), value.mode === "room-sync", () => onChange({ mode: "room-sync" }))}
    </View>
    {value.mode === "custom" ? <>
      <SeoullyText variant="handle">{t("edit.background")}</SeoullyText>
      <View accessibilityRole="radiogroup" accessibilityLabel={t("edit.background")} style={styles.row}>
        {BACKGROUND_PRESETS.map(p => choice(themePresetLabel(p.id, p.label, t), (value.background ?? "paper") === p.id, () => onChange({ ...value, background: p.id }), p.paper))}
      </View>
      {(["primary", "secondary"] as const).map(field => <View key={field} style={styles.group}>
        <SeoullyText variant="handle">{t(field === "primary" ? "edit.primary" : "edit.secondary")}</SeoullyText>
        <View accessibilityRole="radiogroup" accessibilityLabel={t(field === "primary" ? "edit.primary" : "edit.secondary")} style={styles.row}>
          {ACCENT_PICKER.map(p => choice(themePresetLabel(p.id, p.label, t), (value[field] ?? (field === "primary" ? "lavender" : "powder-pink")) === p.id, () => onChange({ ...value, [field]: p.id }), accentSwatch(p.id)))}
        </View>
      </View>)}
    </> : <SeoullyText variant="caption">{t(value.mode === "room-sync" ? "edit.modeRoomHint" : "edit.modeDefaultHint")}</SeoullyText>}
  </View></ProfileIdentityProvider>;
}
const styles = StyleSheet.create({
  preview: { marginTop: 24, padding: 16, gap: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 20 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  group: { gap: 12 },
  choice: { flexDirection: "row", gap: 8, alignItems: "center", minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, borderWidth: 1, maxWidth: "100%" },
  swatch: { width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
});
