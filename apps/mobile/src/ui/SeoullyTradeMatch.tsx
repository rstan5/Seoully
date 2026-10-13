import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { SocialCompatibility, SocialTradeItem } from "../data/types";
import type { MobileCopy } from "../i18n";
import { colors } from "../theme";
import { SeoullyButton } from "./SeoullyControls";
import { SeoullyShelfRow } from "./SeoullyProfile";
import { SeoullyText } from "./SeoullyText";

function captionFor(item: SocialTradeItem, copy: MobileCopy) {
  const relation = item.onYourWishlist && item.theyWantThis
    ? copy.compatBothWant
    : item.onYourWishlist
      ? copy.compatOnYourWishlist
      : copy.compatTheyWantThis;
  return item.openToTrade ? `${relation} · ${copy.compatOpenToTrade}` : `${relation} · ${copy.notForTrade}`;
}

function TradeColumn({
  label,
  items,
  copy,
}: {
  label: string;
  items: SocialTradeItem[];
  copy: MobileCopy;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.column}>
      <SeoullyText variant="section">{label}</SeoullyText>
      {items.map((item) => (
        <SeoullyShelfRow
          key={item.templateId}
          template={{ id: item.templateId, kind: item.kind }}
          title={item.name}
          meta={captionFor(item, copy)}
          colorway={item.colorway}
          imageUrl={item.imageUrl}
        />
      ))}
    </View>
  );
}

export function SeoullyTradeMatch({
  compatibility,
  copy,
  onMessage,
}: {
  compatibility: SocialCompatibility;
  copy: MobileCopy;
  canMessage?: boolean;
  onMessage: (templateIds: string[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const want = compatibility.theyOwnYourWants.length;
  const offer = compatibility.youOwnTheirWants.length;
  if (want === 0 && offer === 0) return null;
  const templateIds = [
    ...compatibility.theyOwnYourWants.map((item) => item.templateId),
    ...compatibility.youOwnTheirWants.map((item) => item.templateId),
  ];
  return (
    <View style={styles.trade}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.toggle}
      >
        <SeoullyText variant="section">{copy.compatTradeMatch}</SeoullyText>
        <SeoullyText variant="caption">
          {copy.compatTradeSummary.replace("{want}", String(want)).replace("{offer}", String(offer))}
        </SeoullyText>
      </Pressable>
      {expanded ? (
        <View>
          <TradeColumn label={copy.compatYouWant} items={compatibility.theyOwnYourWants} copy={copy} />
          <TradeColumn label={copy.compatTheyWant} items={compatibility.youOwnTheirWants} copy={copy} />
          <View style={styles.message}>
            <SeoullyButton
              label={copy.compatMessageTrade}
              variant="ghost"
              block
              onPress={() => onMessage(templateIds)}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  trade: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  toggle: {
    gap: 4,
    minHeight: 44,
    justifyContent: "center",
  },
  column: { marginTop: 10 },
  message: { marginTop: 12 },
});
