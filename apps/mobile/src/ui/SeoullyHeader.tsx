import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { isDemoWorldAllowed, useDataMode, useSocialRepository } from "../data";
import { useCopy } from "../locale";
import { colors } from "../theme";
import { BrandMark } from "./BrandMark";
import { chrome } from "./shellLayout";
import { IconBell } from "./icons";
import { pressShift, useReduceMotion } from "./motion";
import { useProfileIdentity, useProfileInk, useProfileMute } from "./ProfileIdentity";
import { SeoullyText } from "./SeoullyText";

export function SeoullyHeader({
  languageLabel,
  onToggleLanguage,
  trailing,
}: {
  languageLabel: string;
  onToggleLanguage: () => void;
  trailing?: ReactNode;
}) {
  const copy = useCopy();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const { demo, setDemo } = useDataMode();
  const social = useSocialRepository();
  const allowed = isDemoWorldAllowed();
  const [unread, setUnread] = useState(0);
  const ink = useProfileInk();
  const mute = useProfileMute();
  const identity = useProfileIdentity();

  useFocusEffect(useCallback(() => {
    let mounted = true;
    void social.unreadNoticeCount().then((count) => {
      if (mounted) setUnread(social.capabilities.persistNotices ? count : 0);
    }).catch(() => {
      if (mounted) setUnread(0);
    });
    return () => {
      mounted = false;
    };
  }, [social]));

  return (
    <View style={[styles.top, identity ? { borderBottomColor: identity.line } : null]}>
      <BrandMark />
      <View style={styles.end}>
        {allowed ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: demo }}
            accessibilityLabel={demo ? copy.demoWorld : copy.productionData}
            onPress={() => setDemo(!demo)}
            style={({ pressed }) => [styles.demo, demo && styles.demoOn, pressShift(pressed, reduceMotion)]}
          >
            <SeoullyText variant="caption" color={demo ? colors.plum : mute}>
              {demo ? copy.demoWorld : copy.productionData}
            </SeoullyText>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={languageLabel}
          hitSlop={10}
          onPress={onToggleLanguage}
          style={({ pressed }) => [styles.lang, pressShift(pressed, reduceMotion)]}
        >
          <SeoullyText variant="button" color={ink}>{languageLabel}</SeoullyText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `${copy.notices}, ${unread}` : copy.notices}
          hitSlop={8}
          onPress={() => router.push("/notices")}
          style={({ pressed }) => [styles.bell, pressShift(pressed, reduceMotion)]}
        >
          <IconBell color={ink} />
          {unread > 0 ? (
            <View style={styles.badge}>
              <SeoullyText variant="caption" color={colors.onPrimary} style={styles.badgeText}>
                {unread > 9 ? "9+" : String(unread)}
              </SeoullyText>
            </View>
          ) : null}
        </Pressable>
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    columnGap: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    minHeight: chrome.headerHeight,
    overflow: "visible",
    paddingHorizontal: chrome.gutter,
    paddingVertical: 0,
    rowGap: 4,
    zIndex: 2,
  },
  end: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    marginLeft: "auto",
  },
  demo: {
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    marginRight: 6,
    minHeight: 28,
    paddingHorizontal: 8,
  },
  demoOn: {
    backgroundColor: colors.lilacSoft,
    borderColor: colors.lilac,
  },
  lang: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 4,
  },
  bell: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    marginLeft: 2,
    width: 36,
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.plum,
    borderRadius: 8,
    height: 16,
    justifyContent: "center",
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: 2,
    top: 6,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});
