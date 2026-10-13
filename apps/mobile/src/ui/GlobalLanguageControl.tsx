import { createContext, useCallback, useContext, useLayoutEffect, useState, type ComponentProps, type PropsWithChildren } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCopy, useLocale } from "../locale";
import { useBootstrap } from "../startup/BootstrapProvider";
import { colors } from "../theme";
import { chrome } from "./shellLayout";
import { usePublishedProfileIdentity } from "./ProfileIdentity";
import { useBlockingLoadingActive } from "./SeoullyLoadingState";
import { pressShift, useReduceMotion } from "./motion";
import { SeoullyText } from "./SeoullyText";

const LanguageControlContext = createContext({ width: 64, measure: (_width: number) => {}, dialogues: 0, dialogue: (_delta: number) => {}, ink: null as string | null, setInk: (_ink: string | null) => {}, modals: 0, modal: (_delta: number) => {} });

export function LanguageControlProvider({ children }: PropsWithChildren) {
  const [width, setWidth] = useState(64);
  const [dialogues, setDialogues] = useState(0);
  const [dialogue] = useState(() => (delta: number) => setDialogues(previous => previous + delta));
  const [ink, setInk] = useState<string | null>(null);
  const [modals, setModals] = useState(0);
  // Reserve the rendered label width, including Dynamic Type; the right anchor never moves.
  const [measure] = useState(() => (next: number) => setWidth(Math.ceil(next)));
  const [modal] = useState(() => (delta: number) => setModals(previous => previous + delta));
  return <LanguageControlContext.Provider value={{ width, measure, dialogues, dialogue, ink, setInk, modals, modal }}>{children}</LanguageControlContext.Provider>;
}
export function useLanguageControlWidth() { return useContext(LanguageControlContext).width; }

export function useDialogueLanguageControl() {
  const { dialogue } = useContext(LanguageControlContext);
  useLayoutEffect(() => {
    dialogue(1);
    return () => dialogue(-1);
  }, [dialogue]);
}

export function useLanguageControlTone(ink: string) {
  const { setInk } = useContext(LanguageControlContext);
  useFocusEffect(useCallback(() => {
    setInk(ink);
    return () => setInk(null);
  }, [ink, setInk]));
}

/** The original header control, unchanged. One safe-area anchor across every route. */
export function GlobalLanguageControl({ inModal = false, inkOverride }: { inModal?: boolean; inkOverride?: string }) {
  const { switchLanguage: languageLabel } = useCopy();
  const { toggleLocale: onToggleLanguage } = useLocale();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const boot = useBootstrap();
  const blocked = useBlockingLoadingActive();
  const control = useContext(LanguageControlContext);
  const identity = usePublishedProfileIdentity();
  const ink = inkOverride ?? (control.dialogues > 0 ? colors.ink : control.ink ?? identity?.ink ?? colors.ink);
  if (blocked || boot.destination === "loading" || (!inModal && control.modals > 0)) return null;
  return <View pointerEvents="box-none" style={styles.anchor}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={languageLabel}
      hitSlop={10}
      onPress={onToggleLanguage}
      onLayout={event => control.measure(event.nativeEvent.layout.width)}
      style={({ pressed }) => [styles.lang, { position: "absolute", top: insets.top + (chrome.headerHeight - 44) / 2, right: insets.right + chrome.gutter }, pressShift(pressed, reduceMotion)]}
    >
      <SeoullyText variant="button" color={ink}>{languageLabel}</SeoullyText>
    </Pressable>
  </View>;
}

/** Native Modals own a separate window: transfer the same control to that window. */
export function LanguageModal({ children, visible = true, languageInk, ...props }: ComponentProps<typeof Modal> & { languageInk?: string }) {
  const { modal } = useContext(LanguageControlContext);
  useLayoutEffect(() => {
    if (!visible) return;
    modal(1);
    return () => modal(-1);
  }, [modal, visible]);
  return <Modal {...props} visible={visible}>{children}{visible ? <GlobalLanguageControl inModal inkOverride={languageInk} /> : null}</Modal>;
}
const styles = StyleSheet.create({
  anchor: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 80, elevation: 80 },
  lang: { justifyContent: "center", minHeight: 44, paddingHorizontal: 4 },
});
