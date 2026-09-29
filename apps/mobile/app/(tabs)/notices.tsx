import { useCallback, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSocialRepository, type SocialNotice } from "../../src/data";
import { useCopy, useLocale } from "../../src/locale";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyLoadingState } from "../../src/ui/SeoullyLoadingState";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import { SeoullySearchRow } from "../../src/ui/SeoullySearch";
import { SeoullyText } from "../../src/ui/SeoullyText";

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
          <SeoullySearchRow
            title={`@${item.actor.handle}`}
            meta={item.headline}
            leading={<SeoullyAvatar name={item.actor.displayName} size={40} imageUrl={item.actor.avatarUrl} />}
            onPress={() => router.push({ pathname: "/collector", params: { userId: item.actor.userId } })}
          />
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
});
