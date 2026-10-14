import { CollectibleDetailIdentity } from "../src/ui/CollectibleDetailIdentity";
import { useCallback, useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { loadCatalogOwners, loadCatalogTemplate, loadCollectorRoom, loadWishlistMembership, loadPublicCollectorHolding, type NativeCatalogTemplate } from "../src/api";
import { useSocialRepository } from "../src/data";
import { useReportAskSurface } from "../src/ask-surface";
import { RetryNotice } from "../src/components/RetryNotice";
import { ScreenBack } from "../src/components/ScreenBack";

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
  const { userId = "", holdingId, templateId, placementId, name } = useLocalSearchParams<{ userId?: string; holdingId?: string; templateId?: string; placementId?: string; name?: string }>();
  useReportAskSurface({
    surface: "public_collectible",
    ...(userId ? { collectorUserId: userId } : {}),
    ...(typeof holdingId === "string" ? { holdingId } : {}),
    ...(typeof templateId === "string" ? { templateId } : {}),
  });
  const [template, setTemplate] = useState<NativeCatalogTemplate | null>(null);
  const [tradeStatus, setTradeStatus] = useState<"for-trade" | "not-for-trade" | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | undefined>();
  const [wanted, setWanted] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [owners, setOwners] = useState<{ userId: string; displayName: string; handle: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setWanted(social.kind === "demo" ? false : null);
    try {
      setImageUrl(undefined);
      setTradeStatus(null);
      if (social.kind === "demo") {
        const collector = userId ? await social.loadCollector(userId) : null;
        if (holdingId && collector) {
          const item = collector.holdings.find((entry) => entry.id === holdingId) ?? null;
          if (!item) throw new Error("collectible_unavailable");
          setTemplate(item.template);
          setTradeStatus(item?.tradeStatus ?? null);
        } else if (templateId) {
          const catalog = (await social.searchCatalog(name ?? "")).find(item => item.id === templateId);
          const entry = collector?.wishlist.find((item) => item.templateId === templateId);
          if (!entry?.template && !catalog) throw new Error("collectible_unavailable");
          setTemplate(entry?.template ?? catalog ?? null);
          setTradeStatus(null);
        } else throw new Error("collectible_context_unavailable");
      } else if (placementId && userId) {
        const result = await loadCollectorRoom(userId);
        const placement = result.room?.placements.find(item => item.id === placementId);
        if (!placement) throw new Error("placement_unavailable");
        const catalog = await loadCatalogTemplate(placement.holding.templateId).catch(error => {
          if (!(error instanceof Error) || error.message !== "catalog_not_found") throw error;
          // A public copy may be visible before its catalog draft is published.
          // Reuse only the already-authorized Room projection; never query private Holdings.
          const publicTemplate = placement.holding.template;
          return { ...publicTemplate, id: placement.holding.templateId, kind: String(publicTemplate.kind ?? ""), name: String(publicTemplate.name ?? ""), groupId: String(publicTemplate.groupId ?? ""), groupName: String(publicTemplate.groupName ?? ""), descriptor: String(publicTemplate.descriptor ?? ""), status: String(publicTemplate.status ?? ""), memberId: null, releaseId: null, needsReferenceImage: true } as NativeCatalogTemplate;
        });
        setTemplate(catalog);
        setImageUrl(catalog.imageUrl ?? placement.holding.personalMediaUrl);
        setTradeStatus(placement.holding.tradeStatus === "for-trade" ? "for-trade" : "not-for-trade");
      } else if (holdingId && userId) {
        const item = await loadPublicCollectorHolding(userId, holdingId);
        setTemplate(item.template);
        setTradeStatus(item.tradeStatus);
        const catalog = await loadCatalogTemplate(item.templateId);
        setImageUrl(catalog.imageUrl);
      } else if (templateId) {
        const catalog = await loadCatalogTemplate(templateId);
        setTemplate(catalog);
        setImageUrl(catalog.imageUrl);
        setTradeStatus(null);
      } else throw new Error("collectible_context_unavailable");
      setError(null);
    } catch {
      setTemplate(null);
      setError(copy.publicCollectibleUnavailable);
    } finally {
      setLoading(false);
    }
  }, [copy.publicCollectibleUnavailable, holdingId, name, placementId, social, templateId, userId]);

  useEffect(() => {
    const task = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(task);
  }, [refresh]);

  useEffect(() => {
    let active = true;
    if (template && social.kind !== "demo") void loadWishlistMembership(template.id).then(value => { if (active) setWanted(value); }).catch(() => { if (active) setNotice(copy.wishlistUnavailable); });
    return () => { active = false; };
  }, [copy.wishlistUnavailable, social.kind, template]);

  async function saveWanted() {
    if (!template || wanted === null || busy) return;
    setBusy(true);
    try {
      await social.setWishlist(template.id, !wanted);
      setWanted(!wanted);
      setNotice(wanted ? copy.flashUnwishlisted : copy.savedToWishlist);
    } catch {
      setNotice(social.kind === "demo" ? copy.demoWriteBlocked : copy.wishlistUnavailable);
    } finally {
      setBusy(false);
    }
  }

  async function findOwners() {
    if (!template || busy) return;
    setBusy(true);
    try {
      const found = social.kind === "demo"
        ? (await social.searchDiscoverCollectibles(template.name)).flatMap(item => item.template.id === template.id && item.owner ? [item.owner] : [])
        : await loadCatalogOwners(template.id);
      setOwners(found); setNotice(found.length ? null : copy.noPublicOwners);
    }
    catch { setNotice(copy.publicCollectibleUnavailable); }
    finally { setBusy(false); }
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

  if (loading && !template && !error) return <SeoullyLoadingState fullScreen label={copy.viewCollectible} />;

  return (
    <SeoullyScreen>
      <ScrollView contentContainerStyle={styles.container}>
        <ScreenBack label={copy.back} onPress={() => router.back()} />
        {error ? <RetryNotice message={error} retryLabel={copy.retry} onRetry={refresh} /> : null}
        {template ? (
          <>
            <CollectibleDetailIdentity template={template} imageUrl={imageUrl ?? template.imageUrl} onImageError={() => setError(copy.publicCollectibleUnavailable)} />
            {tradeStatus ? (
              <SeoullyText variant="handle" color={colors.plum} style={styles.status}>
                {tradeStatus === "for-trade" ? copy.forTrade : copy.notForTrade}
              </SeoullyText>
            ) : null}
            <SeoullyText variant="caption" color={colors.muted} style={styles.owner}>
              {userId && tradeStatus ? copy.publicCollectibleOwnedBy : ""}
            </SeoullyText>
            <View style={styles.stack}>
              <SeoullyButton label={wanted ? copy.unsaveWishlist : copy.saveToWishlist} disabled={busy || wanted === null} block onPress={() => { void saveWanted(); }} />
              <SeoullyButton label={copy.findCollectors} variant="ghost" block onPress={() => { void findOwners(); }} />
              <SeoullyButton label={copy.addYourCopy} variant="ghost" block onPress={addCopy} />
              {userId ? <SeoullyButton label={tradeStatus === "for-trade" ? copy.inquireTrade : copy.messageCollector} variant="ghost" block onPress={() => router.push({ pathname: "/thread", params: { userId, templateIds: template.id, ...(tradeStatus === "for-trade" ? { trade: "1" } : {}) } })} /> : null}
            </View>
            {owners.map(owner => <SeoullyButton key={owner.userId} label={`${owner.displayName} · ${owner.handle}`} variant="ghost" onPress={() => router.push({ pathname: "/collector", params: { userId: owner.userId } })} />)}
            {notice === copy.wishlistUnavailable ? <RetryNotice message={notice} retryLabel={copy.retry} onRetry={refresh} /> : null}
            {notice && notice !== copy.wishlistUnavailable ? <SeoullyText variant="secondary" color={colors.plum}>{notice}</SeoullyText> : null}
          </>
        ) : null}
      </ScrollView>
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 80, paddingHorizontal: 16 },
  status: { marginTop: 16 },
  owner: { marginTop: 8 },
  stack: { gap: 10, marginTop: 18 },
});
