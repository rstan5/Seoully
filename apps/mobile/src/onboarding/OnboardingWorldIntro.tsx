import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MobileCopy } from "../i18n";
import { useSocialRepository } from "../data";
import { RoomWorldScreen } from "../room/RoomWorldScreen";
import { colors } from "../theme";
import { SeoullyButton } from "../ui/SeoullyControls";
import { SeoullyText } from "../ui/SeoullyText";

export default function OnboardingWorldIntro({
  holdingId,
  photocard,
  copy,
  onContinue,
}: {
  holdingId?: string;
  photocard: boolean;
  copy: MobileCopy;
  onContinue: () => void;
}) {
  const social = useSocialRepository();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.wrap}>
      <RoomWorldScreen
        mode="own"
        demo={false}
        persistLive={social.capabilities.persistRoom}
        copy={copy}
        initialHoldingId={photocard ? holdingId : undefined}
        onLeave={onContinue}
      />
      <View pointerEvents="box-none" style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.card}>
          <SeoullyText variant="title">{copy.onboardRoomTitle}</SeoullyText>
          <SeoullyText variant="secondary" style={styles.lede}>{copy.onboardRoomLede}</SeoullyText>
          {photocard ? <SeoullyText variant="caption" color={colors.plum}>{copy.onboardRoomBinder}</SeoullyText> : null}
          <SeoullyButton label={copy.continue} block onPress={onContinue} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  overlay: { bottom: 0, left: 0, position: "absolute", right: 0 },
  card: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  lede: { lineHeight: 21 },
});
