import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { loadCollectorCollection, loadPublicCollectorHolding, type NativeCatalogTemplate } from "../src/api";
import { useSocialRepository } from "../src/data";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";
import { collectibleKindLabel } from "../src/i18n";
import { useCopy } from "../src/locale";
import { colors } from "../src/theme";
import { SeoullyButton } from "../src/ui/SeoullyControls";
import { SeoullyLoadingState } from "../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../src/ui/SeoullyScreen";
import { SeoullyText } from "../src/ui/SeoullyText";

export default function PublicCollectibleScreen() {
  const copy = useCopy();
  const router = useRouter();
  const social = useSocialRepository();
  const { userId = "", holdingId, templateId } = useLocalSearchParams<{ userId?: string; holdingId?: string; templateId?: string }>();
  const [template, setTemplate] = useState<NativeCatalogTemplate | null>(null);
  const [tradeStatus, setTradeStatus] = useState<"for-trade" | "not-for-trade" | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!userId) throw new Error("missing_collector");
      if (social.kind === "demo") {
        const collector = await social.loadCollector(userId);
        if (holdingId) {
          const item = collector.holdings.find((entry) => entry.id === holdingId) ?? null;
          setTemplate(item?.template ?? null);
          setTradeStatus(item?.tradeStatus ?? null);
        } else if (templateId) {
          const entry = collector.wishlist.find((item) => item.templateId === templateId);
          setTemplate(entry?.template ?? null);
          setTradeStatus(null);
        }
      } else if (holdingId) {
        const item = await loadPublicCollectorHolding(userId, holdingId);
        setTemplate(item.template);
        setTradeStatus(item.tradeStatus);
      } else if (templateId) {
        const collection = await loadCollectorCollection(userId);
        const entry = collection.wishlist.find((item) => item.templateId === templateId) ?? null;
        setTemplate(entry?.template ?? null);
        setTradeStatus(null);
      }
      setError(null);
    } catch {
      setTemplate(null);
      setError(copy.publicCollectibleUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.publicCollectibleUnavailable, holdingId, social, templateId, userId]);

  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  async function saveWanted() {
    if (!template || busy) return;
    setBusy(true);
    try {
      await social.setWishlist(template.id, true);
      setNotice(copy.savedToWishlist);
    } catch {
      setNotice(social.kind === "demo" ? copy.demoWriteBlocked : copy.wishlistUnavailable);
    } finally {
      setBusy(false);
    }
  }

  function addCopy() {
    if (!template) return;
    router.push({
      pathname: "/add",
      params: {
        templateId: template.id,
        name: template.name,
        kind: template.kind,
        groupName: template.groupName,
        memberName: template.memberName ?? "",
        releaseName: template.releaseName ?? "",
      },
    });
  }

  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        {loading ? <SeoullyLoadingState label={copy.viewCollectible} /> : null}
        {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
        {template ? (
          <>
            <View style={styles.fallback}>
              <SeoullyText variant="title" style={styles.fallbackText}>{template.name}</SeoullyText>
            </View>
            <SeoullyText variant="caption" color={colors.plum} style={styles.kind}>
              {collectibleKindLabel(template.kind, copy)}
            </SeoullyText>
            <SeoullyText variant="title">{template.name}</SeoullyText>
            <SeoullyText variant="secondary" style={styles.meta}>
              {[template.groupName, template.memberName, template.releaseName].filter(Boolean).join(" · ")}
            </SeoullyText>
            {template.descriptor ? <SeoullyText variant="body" style={styles.descriptor}>{template.descriptor}</SeoullyText> : null}
            {tradeStatus ? (
              <SeoullyText variant="handle" color={colors.plum} style={styles.status}>
                {tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}
              </SeoullyText>
            ) : null}
            <SeoullyText variant="caption" color={colors.muted} style={styles.owner}>
              {copy.publicCollectibleOwnedBy}
            </SeoullyText>
            <View style={styles.stack}>
              <SeoullyButton label={copy.saveToWishlist} disabled={busy} block onPress={() => { void saveWanted(); }} />
              <SeoullyButton label={copy.addYourCopy} variant="ghost" block onPress={addCopy} />
              <SeoullyButton
                label={copy.profile}
                variant="ghost"
                block
                onPress={() => router.push({ pathname: "/collector", params: { userId } })}
              />
            </View>
            {notice ? <SeoullyText variant="secondary" color={colors.plum}>{notice}</SeoullyText> : null}
          </>
        ) : null}
      </ScrollView>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, paddingHorizontal: 16 },
  fallback: {
    alignItems: "center",
    alignSelf: "center",
    aspectRatio: 55 / 85,
    backgroundColor: colors.lilacSoft,
    borderRadius: 18,
    justifyContent: "center",
    marginTop: 16,
    padding: 18,
    width: "72%",
  },
  fallbackText: { textAlign: "center" },
  kind: { letterSpacing: 0.4, marginTop: 18, textTransform: "uppercase" },
  meta: { marginTop: 4 },
  descriptor: { lineHeight: 20, marginTop: 12 },
  status: { marginTop: 16 },
  owner: { marginTop: 8 },
  stack: { gap: 10, marginTop: 18 },
});
