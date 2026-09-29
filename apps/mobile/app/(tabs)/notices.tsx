import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { noticeDestination, type NoticeKind } from "../../src/comms";
import { useSocialRepository, type SocialNotice } from "../../src/data";
import type { MobileCopy } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyButton } from "../../src/ui/SeoullyControls";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyLoadingState } from "../../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullySearchRow } from "../../src/ui/SeoullySearch";
import { SeoullyText } from "../../src/ui/SeoullyText";

function headlineFor(notice: SocialNotice, copy: MobileCopy) {
  const mapped: Record<NoticeKind, string> = {
    like: copy.noticeLiked,
    comment: copy.noticeCommented,
    follow: copy.noticeFollowed,
    trade: copy.noticeTrade,
    activity: copy.noticeActivity,
    repost: copy.noticeReposted,
  };
  return notice.headline && notice.headline !== notice.kind ? notice.headline : mapped[notice.kind];
}

export default function NoticesScreen() {
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const router = useRouter();
  const social = useSocialRepository();
  const [items, setItems] = useState<SocialNotice[]>([]);
  const [persisted, setPersisted] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const page = await social.loadNotices();
      setItems(page.items);
      setPersisted(page.persisted);
      if (page.persisted) await social.markNoticesRead();
    } finally {
      setLoading(false);
    }
  }, [social]);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  function openNotice(item: SocialNotice) {
    const destination = noticeDestination({
      kind: item.kind,
      actorUserId: item.actor.userId,
      ...(item.postId ? { postId: item.postId } : {}),
      ...(item.templateIds ? { templateIds: item.templateIds } : {}),
    });
    router.push({ pathname: destination.pathname, params: destination.params });
  }

  return (
    <SeoullyScreen>
      <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
      <View style={styles.intro}>
        <SeoullyText variant="title">{copy.notices}</SeoullyText>
      </View>
      {loading && items.length === 0 ? <SeoullyLoadingState label={copy.notices} /> : null}
      {!persisted ? (
        <View style={styles.notice}>
          <SeoullyText variant="secondary">{copy.noticesUnavailable}</SeoullyText>
        </View>
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View>
            <SeoullySearchRow
              title={`@${item.actor.handle}`}
              meta={headlineFor(item, copy)}
              leading={<SeoullyAvatar name={item.actor.displayName} size={40} imageUrl={item.actor.avatarUrl} />}
              onPress={() => router.push({ pathname: "/collector", params: { userId: item.actor.userId } })}
            />
            {item.kind === "trade" && social.capabilities.persistMessages ? (
              <View style={styles.trade}>
                <SeoullyButton label={copy.noticeMessageAbout} variant="ghost" onPress={() => openNotice(item)} />
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={!loading ? <SeoullyEmptyState align="start" body={persisted ? copy.noticesEmpty : copy.noticesUnavailable} /> : null}
      />
    </SeoullyScreen>
  );
}

const styles = StyleSheet.create({
  intro: { paddingHorizontal: 16, paddingTop: 12 },
  notice: { paddingHorizontal: 16, paddingTop: 8 },
  list: { paddingBottom: 120, paddingHorizontal: 8, paddingTop: 8 },
  trade: { paddingHorizontal: 16, paddingBottom: 8 },
});
