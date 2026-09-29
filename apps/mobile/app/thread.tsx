import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { ScreenBack } from "../src/components/ScreenBack";
import { useCopy } from "../src/locale";
import { colors } from "../src/theme";
import { SeoullyAvatar } from "../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../src/ui/SeoullyEmptyState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function ThreadScreen() {
  const copy = useCopy();
  const router = useRouter();
  const params = useLocalSearchParams<{ conversationId?: string; displayName?: string; handle?: string }>();
  const [ready, setReady] = useState(false);

  useFocusEffect(useCallback(() => {
    setReady(true);
  }, []));

  return (
    <SeoullyScreen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.header}>
          <ScreenBack label={copy.back} onPress={() => router.back()} />
          <View style={styles.who}>
            <SeoullyAvatar name={params.displayName ?? copy.collectorFallback} size={36} />
            <View>
              <SeoullyText variant="title">{params.displayName}</SeoullyText>
              {params.handle ? <SeoullyText variant="handle" color={colors.muted}>@{params.handle}</SeoullyText> : null}
            </View>
          </View>
        </View>
        {ready ? <SeoullyEmptyState body={copy.messagesUnavailable} /> : null}
      </KeyboardAvoidingView>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  who: { alignItems: "center", flexDirection: "row", gap: 10, marginTop: 4 },
});
