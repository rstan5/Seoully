import { useCallback, useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { createCollectorCountStore, formatCollectorCount, isCanonicalPhotocard } from "seoully-domain/photocard-collector-count";
import { readPhotocardCollectorCounts, onCollectorOwnershipChanged } from "../api";
import { useCopy } from "../locale";
import { colors } from "../theme";
import { useProfileIdentity } from "./ProfileIdentity";
import { IconGroup } from "./icons";
import { SeoullyText } from "./SeoullyText";

const store = createCollectorCountStore(readPhotocardCollectorCounts);
let subscribers = 0;
let stopOwnership: (() => void) | undefined;
let stopForeground: (() => void) | undefined;
function subscribeLifecycle() {
  if (subscribers++ === 0) {
    stopOwnership = onCollectorOwnershipChanged(() => store.invalidate());
    const listener = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    stopForeground = () => listener.remove();
  }
  return () => { if (--subscribers === 0) { stopOwnership?.(); stopForeground?.(); } };
}
let refreshQueued = false;
function refresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => { refreshQueued = false; store.refresh(); });
}

export function PhotocardCollectorCount({ templateId, kind, color: colorOverride }: { templateId: string; kind: string; color?: string }) {
  const eligible = isCanonicalPhotocard(templateId, kind);
  const copy = useCopy();
  const identity = useProfileIdentity();
  const [, rerender] = useState(0);
  const state = store.get(templateId);
  useEffect(() => {
    if (!eligible) return;
    const stop = store.subscribe(templateId, () => rerender(value => value + 1));
    const stopLifecycle = subscribeLifecycle();
    return () => { stop(); stopLifecycle(); };
  }, [eligible, templateId]);
  useFocusEffect(useCallback(() => { if (eligible) refresh(); }, [eligible]));
  if (!eligible) return null;
  const color = colorOverride ?? identity?.mute ?? colors.muted;
  const label = state.count === null ? copy.photocardCollectorsUnknown : copy.photocardCollectorsLabel.replace("{count}", String(state.count));
  return <View accessible accessibilityLabel={label} accessibilityHint={copy.photocardCollectorsExplanation} style={styles.row}>
    <IconGroup size={13} color={color} />
    <SeoullyText variant="metadata" color={color} style={styles.number}>{state.count === null ? "—" : formatCollectorCount(state.count)}</SeoullyText>
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }, number: { fontVariant: ["tabular-nums"], fontSize: 11, lineHeight: 16 } });
