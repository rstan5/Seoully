import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import {
  type NativeCatalogTemplate,
  type NativeCollectibleSearchHit,
  type NativeFeedPost,
  type NativeRoomDiscovery,
  type NativeSearchUser,
} from "../../src/api";
import { useSocialRepository, type SocialEntity } from "../../src/data";
import { EXPLORE_DESTINATIONS, isExploreDestination, type ExploreDestination } from "../../src/explore";
import { useReportAskSurface } from "../../src/ask-surface";
import { KeyboardScreen } from "../../src/components/KeyboardScreen";
import { RetryNotice } from "../../src/components/RetryNotice";
import { collectibleKindLabel, type MobileCopy } from "../../src/i18n";
import { useCopy, useLocale } from "../../src/locale";
import { colors, spacing } from "../../src/theme";
import { IconCard, IconDoor, IconGroup, IconPhoto, IconUser } from "../../src/ui/icons";
import { SeoullyAvatar } from "../../src/ui/SeoullyAvatar";
import { SeoullyEmptyState } from "../../src/ui/SeoullyEmptyState";
import { SeoullyFeedPost } from "../../src/ui/SeoullyFeedPost";
import { SeoullyHeader } from "../../src/ui/SeoullyHeader";
import { SeoullyScreen } from "../../src/ui/SeoullyScreen";
import {
  SeoullyCollectibleMark,
  SeoullyExploreDest,
  SeoullyExploreRoom,
  SeoullySearchField,
  SeoullySearchRow,
} from "../../src/ui/SeoullySearch";
import { SeoullyText } from "../../src/ui/SeoullyText";

const SEARCH_STATE_KEY = "seoully.mobile.search-state.v2";
const SEARCH_QUERY_KEY = "seoully.mobile.search-query.v1";
const DEBOUNCE_MS = 280;

type SearchEntity = SocialEntity;

function looksLikeHandle(query: string) {
  return /^@?[a-z0-9._]{2,}$/i.test(query.trim());
}

function paramValue(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string | string[]; dest?: string | string[] }>();
  const copy = useCopy();
  const { toggleLocale } = useLocale();
  const social = useSocialRepository();
  const [query, setQuery] = useState("");
  const [destination, setDestination] = useState<ExploreDestination | null>(null);
  const [people, setPeople] = useState<NativeSearchUser[]>([]);
  const [rooms, setRooms] = useState<NativeRoomDiscovery[]>([]);
  const [catalog, setCatalog] = useState<NativeCollectibleSearchHit[]>([]);
  const [posts, setPosts] = useState<NativeFeedPost[]>([]);
  const [entities, setEntities] = useState<SearchEntity[]>([]);
  const [wantedIds, setWantedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQuery = query.trim();
  const handleQuery = looksLikeHandle(query);
  const showingResults = destination !== null;
  useReportAskSurface({
    surface: "search",
    ...(activeQuery ? { searchQuery: activeQuery } : {}),
    ...(destination ? { searchDestination: destination } : {}),
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchGeneration = useRef(0);
  const appliedParams = useRef("");

  useEffect(() => {
    void AsyncStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ query, destination }));
  }, [query, destination]);

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);

  const hydrateWishlist = useCallback(async () => {
    try {
      const entries = await social.loadMyWishlist();
      setWantedIds(new Set(entries.map((entry) => entry.templateId)));
    } catch {
      setError(copy.wishlistUnavailable);
    }
  }, [copy.wishlistUnavailable, social]);

  useFocusEffect(useCallback(() => {
    void hydrateWishlist();
  }, [hydrateWishlist]));

  const runSearch = useCallback(async (nextQuery: string, nextDestination: ExploreDestination) => {
    const text = nextQuery.trim().slice(0, 120);
    const generation = ++searchGeneration.current;
    if (!text) {
      setPeople([]);
      setRooms([]);
      setCatalog([]);
      setPosts([]);
      setEntities([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (nextDestination === "people") {
        const hits = await social.searchCollectors(text);
        if (generation !== searchGeneration.current) return;
        setPeople(hits);
        setRooms([]); setCatalog([]); setPosts([]); setEntities([]);
      } else if (nextDestination === "rooms") {
        const hits = await social.searchRooms(text);
        if (generation !== searchGeneration.current) return;
        setRooms(hits);
        setPeople([]); setCatalog([]); setPosts([]); setEntities([]);
      } else if (nextDestination === "posts") {
        if (!social.capabilities.searchPosts) {
          if (generation !== searchGeneration.current) return;
          setPosts([]);
          setPeople([]); setRooms([]); setCatalog([]); setEntities([]);
          setError(copy.searchPostsUnavailable);
          setLoading(false);
          return;
        }
        const hits = await social.searchPosts(text);
        if (generation !== searchGeneration.current) return;
        setPosts(hits);
        setPeople([]); setRooms([]); setCatalog([]); setEntities([]);
      } else if (nextDestination === "entities") {
        const hits = await social.searchEntities(text);
        if (generation !== searchGeneration.current) return;
        setEntities(hits);
        setPeople([]); setRooms([]); setCatalog([]); setPosts([]);
      } else {
        const hits = await social.searchDiscoverCollectibles(text);
        if (generation !== searchGeneration.current) return;
        setCatalog(hits);
        setPeople([]); setRooms([]); setPosts([]); setEntities([]);
      }
    } catch {
      if (generation !== searchGeneration.current) return;
      setError(nextDestination === "people" || nextDestination === "rooms" ? copy.exploreUnavailable : copy.catalogUnavailable);
    } finally {
      if (generation === searchGeneration.current) setLoading(false);
    }
  }, [copy.catalogUnavailable, copy.exploreUnavailable, copy.searchPostsUnavailable, social]);

  useEffect(() => {
    const nextQuery = paramValue(params.q);
    const destParam = paramValue(params.dest);
    const nextDest = isExploreDestination(destParam) ? destParam : null;
    const key = `${nextQuery}|${nextDest ?? ""}`;
    if (!nextQuery || key === appliedParams.current) return;
    appliedParams.current = key;
    const task = setTimeout(() => {
      setQuery(nextQuery);
      setDestination(nextDest);
      if (nextDest) void runSearch(nextQuery, nextDest);
    }, 0);
    return () => clearTimeout(task);
  }, [params.dest, params.q, runSearch]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (paramValue(params.q)) return;
      const stored = await AsyncStorage.getItem(SEARCH_STATE_KEY);
      const legacy = await AsyncStorage.getItem(SEARCH_QUERY_KEY);
      if (!active) return;
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { query?: string; destination?: ExploreDestination | null };
          if (parsed.query) setQuery(parsed.query);
          if (parsed.destination && EXPLORE_DESTINATIONS.includes(parsed.destination)) {
            setDestination(parsed.destination);
            if (parsed.query?.trim()) void runSearch(parsed.query, parsed.destination);
          }
          return;
        } catch {
          // Fall through to the previous query key.
        }
      }
      if (legacy?.trim()) setQuery(legacy);
    })();
    return () => { active = false; };
  }, [params.q, runSearch]);

  function changeQuery(next: string) {
    setQuery(next);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (destination) void runSearch(next, destination);
    }, DEBOUNCE_MS);
  }

  function chooseDestination(id: ExploreDestination) {
    setDestination(id);
    void runSearch(query, id);
  }

  function clearSearch() {
    setQuery("");
    setPeople([]);
    setRooms([]);
    setCatalog([]);
    setPosts([]);
    setEntities([]);
    setError(null);
    void AsyncStorage.removeItem(SEARCH_QUERY_KEY);
  }

  async function saveWanted(templateId: string) {
    if (wantedIds.has(templateId)) return;
    try {
      await social.setWishlist(templateId, true);
      setWantedIds((current) => new Set(current).add(templateId));
    } catch {
      setError(copy.wishlistUnavailable);
    }
  }

  return (
    <SeoullyScreen>
      <KeyboardScreen>
        <SeoullyHeader languageLabel={copy.switchLanguage} onToggleLanguage={toggleLocale} />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <SeoullyText variant="title">{copy.searchTitle}</SeoullyText>
          {!showingResults ? <SeoullyText variant="secondary" style={styles.lede}>{copy.searchLede}</SeoullyText> : null}

          <SeoullySearchField
            value={query}
            placeholder={copy.searchPlaceholder}
            label={copy.search}
            clearLabel={copy.searchClear}
            onChange={changeQuery}
            onSubmit={() => { if (destination) void runSearch(query, destination); }}
            onClear={clearSearch}
          />

          {!showingResults ? (
            <>
              <SeoullyText variant="caption" style={styles.prompt}>{copy.searchPrompt}</SeoullyText>
              <View style={styles.dests}>
                {EXPLORE_DESTINATIONS.map((id) => (
                  <SeoullyExploreDest
                    key={id}
                    title={destinationTitle(id, copy)}
                    hint={handleQuery && id === "people" ? copy.searchHandleHint : destinationHint(id, copy)}
                    icon={destinationIcon(id)}
                    iconBackground={destinationColor(id)}
                    suggested={handleQuery && id === "people"}
                    onPress={() => chooseDestination(id)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {showingResults && destination ? (
            <View style={styles.results}>
              <View style={styles.toolbar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.searchBack}
                  onPress={() => setDestination(null)}
                  style={styles.back}
                >
                  <SeoullyText variant="button" color={colors.plum}>{copy.back}</SeoullyText>
                </Pressable>
                <View style={styles.heading}>
                  {activeQuery ? <SeoullyText variant="title" numberOfLines={1}>{activeQuery.replace(/^@+/, "")}</SeoullyText> : null}
                  <SeoullyText variant="secondary" color={colors.plum}>{destinationTitle(destination, copy)}</SeoullyText>
                </View>
              </View>

              {!activeQuery ? <SeoullyEmptyState align="start" body={copy.searchNeedQuery} /> : null}
              {activeQuery && loading ? <SeoullyText variant="caption" accessibilityRole="progressbar">{copy.profileCatalogSearching}</SeoullyText> : null}
              {error ? (
                <RetryNotice
                  message={error}
                  retryLabel={copy.retry}
                  onRetry={() => { if (destination) void runSearch(query, destination); }}
                />
              ) : null}

              {activeQuery && !loading && destination === "people" ? (
                <PeopleResults
                  hits={people}
                  heading={copy.resultsPeople}
                  empty={copy.searchNone}
                  onOpen={(userId) => router.push({ pathname: "/collector", params: { userId } })}
                />
              ) : null}

              {activeQuery && !loading && destination === "rooms" ? (
                <RoomResults
                  hits={rooms}
                  heading={copy.resultsRooms}
                  empty={copy.searchNone}
                  matchLabel={(score) => copy.searchMatch.replace("{score}", String(score))}
                  enterLabel={copy.viewCollectorRoom}
                  reasonText={(codes) => reasonLabel(codes[0], copy)}
                  onEnter={(userId) => router.push({ pathname: "/collector-room", params: { userId } })}
                />
              ) : null}

              {activeQuery && !loading && destination === "posts" ? (
                <PostResults
                  hits={posts}
                  heading={copy.resultsPosts}
                  empty={copy.searchNone}
                  onChange={(next) => setPosts((current) => current.map((post) => post.id === next.id ? next : post))}
                />
              ) : null}

              {activeQuery && !loading && destination === "collectibles" ? (
                <CollectibleResults
                  hits={catalog}
                  heading={copy.resultsCollectibles}
                  empty={copy.searchNone}
                  kindText={(kind) => collectibleKindLabel(kind, copy)}
                  addLabel={copy.addYourCopy}
                  saveLabel={copy.saveToWishlist}
                  savedLabel={copy.savedToWishlist}
                  ownedBy={(handle) => copy.searchOwnedBy.replace("{handle}", handle)}
                  noOwner={copy.searchCollectibleNoOwner}
                  wantedIds={wantedIds}
                  onOpenOwner={(userId) => router.push({ pathname: "/collector", params: { userId } })}
                  onAdd={(item) => router.push({
                    pathname: "/add",
                    params: {
                      templateId: item.id,
                      name: item.name,
                      kind: item.kind,
                      groupName: item.groupName,
                      memberName: item.memberName ?? "",
                      releaseName: item.releaseName ?? "",
                    },
                  })}
                  onSave={saveWanted}
                />
              ) : null}

              {activeQuery && !loading && destination === "entities" ? (
                <EntityResults
                  hits={entities}
                  heading={copy.resultsEntities}
                  empty={copy.searchNone}
                  seeCollectors={copy.searchSeeCollectors}
                  onExplore={(next) => {
                    setQuery(next);
                    setDestination("people");
                    void runSearch(next, "people");
                  }}
                />
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardScreen>
    </SeoullyScreen>
  );
}

function PeopleResults({
  hits,
  heading,
  empty,
  onOpen,
}: {
  hits: NativeSearchUser[];
  heading: string;
  empty: string;
  onOpen: (userId: string) => void;
}) {
  if (hits.length === 0) return <SeoullyEmptyState align="start" body={empty} />;
  return (
    <View>
      <SeoullyText variant="section" style={styles.section}>{heading}</SeoullyText>
      {hits.map((person) => (
        <SeoullySearchRow
          key={person.userId}
          title={person.displayName}
          meta={`@${person.handle}`}
          leading={<SeoullyAvatar name={person.displayName} size={40} imageUrl={person.avatarUrl} />}
          onPress={() => onOpen(person.userId)}
        />
      ))}
    </View>
  );
}

function PostResults({
  hits,
  heading,
  empty,
  onChange,
}: {
  hits: NativeFeedPost[];
  heading: string;
  empty: string;
  onChange: (post: NativeFeedPost) => void;
}) {
  const copy = useCopy();
  const { locale } = useLocale();
  if (hits.length === 0) return <SeoullyEmptyState align="start" body={empty} />;
  return (
    <View>
      <SeoullyText variant="section" style={styles.section}>{heading}</SeoullyText>
      {hits.map((item) => (
        <SeoullyFeedPost
          key={item.id}
          item={item}
          copy={copy}
          locale={locale}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

function RoomResults({
  hits,
  heading,
  empty,
  matchLabel,
  enterLabel,
  reasonText,
  onEnter,
}: {
  hits: NativeRoomDiscovery[];
  heading: string;
  empty: string;
  matchLabel: (score: number) => string;
  enterLabel: string;
  reasonText: (codes: string[]) => string;
  onEnter: (userId: string) => void;
}) {
  if (hits.length === 0) return <SeoullyEmptyState align="start" body={empty} />;
  return (
    <View style={styles.roomList}>
      <SeoullyText variant="section" style={styles.section}>{heading}</SeoullyText>
      {hits.map((hit) => (
        <SeoullyExploreRoom
          key={`${hit.roomId}-${hit.collector.userId}`}
          name={hit.collector.displayName}
          identity={`@${hit.collector.handle}`}
          match={hit.rankScore > 0 ? matchLabel(hit.rankScore) : undefined}
          reason={hit.reasons[0] ? reasonText(hit.reasons.map((reason) => reason.code)) : undefined}
          enterLabel={enterLabel}
          onEnter={() => onEnter(hit.collector.userId)}
        />
      ))}
    </View>
  );
}

function CollectibleResults({
  hits,
  heading,
  empty,
  kindText,
  addLabel,
  saveLabel,
  savedLabel,
  ownedBy,
  noOwner,
  wantedIds,
  onOpenOwner,
  onAdd,
  onSave,
}: {
  hits: NativeCollectibleSearchHit[];
  heading: string;
  empty: string;
  kindText: (kind: string) => string;
  addLabel: string;
  saveLabel: string;
  savedLabel: string;
  ownedBy: (handle: string) => string;
  noOwner: string;
  wantedIds: Set<string>;
  onOpenOwner: (userId: string) => void;
  onAdd: (item: NativeCatalogTemplate) => void;
  onSave: (templateId: string) => void;
}) {
  if (hits.length === 0) return <SeoullyEmptyState align="start" body={empty} />;
  return (
    <View>
      <SeoullyText variant="section" style={styles.section}>{heading}</SeoullyText>
      {hits.map((hit) => {
        const item = hit.template;
        const line = [item.groupName, item.memberName, kindText(item.kind)].filter(Boolean).join(" · ");
        const ownerLine = hit.owner ? ownedBy(hit.owner.handle) : noOwner;
        return (
          <View key={item.id}>
            <SeoullySearchRow
              title={item.name}
              meta={line}
              reason={ownerLine}
              leading={<SeoullyCollectibleMark />}
              onPress={hit.owner ? () => onOpenOwner(hit.owner!.userId) : undefined}
              staticRow={!hit.owner}
            />
            <View style={styles.actions}>
              <Pressable accessibilityRole="button" onPress={() => onAdd(item)}>
                <SeoullyText variant="button" color={colors.plum}>{addLabel}</SeoullyText>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={wantedIds.has(item.id)} onPress={() => onSave(item.id)}>
                <SeoullyText variant="button" color={wantedIds.has(item.id) ? colors.muted : colors.plum}>
                  {wantedIds.has(item.id) ? savedLabel : saveLabel}
                </SeoullyText>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EntityResults({
  hits,
  heading,
  empty,
  seeCollectors,
  onExplore,
}: {
  hits: SearchEntity[];
  heading: string;
  empty: string;
  seeCollectors: string;
  onExplore: (query: string) => void;
}) {
  if (hits.length === 0) return <SeoullyEmptyState align="start" body={empty} />;
  return (
    <View>
      <SeoullyText variant="section" style={styles.section}>{heading}</SeoullyText>
      {hits.map((hit) => (
        <SeoullySearchRow
          key={`${hit.kind}-${hit.id}`}
          title={hit.title}
          meta={hit.subtitle}
          leading={<View style={styles.dot} />}
          trailing={<SeoullyText variant="caption" color={colors.plum}>{seeCollectors}</SeoullyText>}
          onPress={() => onExplore(hit.query)}
        />
      ))}
    </View>
  );
}

function destinationTitle(id: ExploreDestination, copy: MobileCopy) {
  switch (id) {
    case "people":
      return copy.destPeople;
    case "rooms":
      return copy.destRooms;
    case "posts":
      return copy.destPosts;
    case "collectibles":
      return copy.destCollectibles;
    case "entities":
      return copy.destEntities;
  }
}

function destinationHint(id: ExploreDestination, copy: MobileCopy) {
  switch (id) {
    case "people":
      return copy.destPeopleHint;
    case "rooms":
      return copy.destRoomsHint;
    case "posts":
      return copy.destPostsHint;
    case "collectibles":
      return copy.destCollectiblesHint;
    case "entities":
      return copy.destEntitiesHint;
  }
}

function destinationColor(id: ExploreDestination) {
  switch (id) {
    case "people":
      return colors.lilacSoft;
    case "rooms":
      return colors.peach;
    case "posts":
      return colors.pinkSoft;
    case "collectibles":
      return colors.blueSoft;
    case "entities":
      return colors.mintSoft;
  }
}

function destinationIcon(id: ExploreDestination) {
  const color = colors.plum;
  switch (id) {
    case "people":
      return <IconUser color={color} />;
    case "rooms":
      return <IconDoor color={color} />;
    case "posts":
      return <IconPhoto color={color} />;
    case "collectibles":
      return <IconCard color={color} />;
    case "entities":
      return <IconGroup color={color} />;
  }
}

function reasonLabel(code: string | undefined, copy: MobileCopy) {
  const normalized = code?.toLowerCase();
  if (normalized?.includes("wishlist")) return copy.searchReasonWishlist;
  if (normalized?.includes("bias")) return copy.basedOnBias;
  if (normalized?.includes("group")) return copy.basedOnGroups;
  return copy.recommendedForYou;
}

const styles = StyleSheet.create({
  container: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 12 },
  lede: { marginTop: 6, maxWidth: 280 },
  prompt: { marginBottom: 10, marginTop: 18, maxWidth: 320 },
  dests: { gap: 8 },
  results: { marginTop: 8 },
  toolbar: { alignItems: "flex-start", flexDirection: "row", gap: 10, marginBottom: 10, marginTop: 16 },
  back: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: 12,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  heading: { flex: 1, gap: 2, minWidth: 0, paddingTop: 6 },
  section: { marginBottom: 8, marginTop: 18 },
  roomList: { gap: 12 },
  actions: { flexDirection: "row", gap: spacing.md, paddingBottom: 8, paddingHorizontal: 8 },
  dot: { backgroundColor: colors.lilacSoft, borderRadius: 20, height: 40, width: 40 },
});
