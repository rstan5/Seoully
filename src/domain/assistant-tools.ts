import {
  searchCollectibles,
  searchPeople,
  searchRooms,
} from "@/domain/explore";
import { repository } from "@/domain/memory-repository";
import type { CollectibleTemplate, TemplateId, UserId } from "@/domain/types";
import type { Locale } from "@/locale/translate";
import type { MessageKey } from "@/locale/en";
import { translate } from "@/locale/translate";
import { compatibilityLines } from "@/locale/copy";

export type AssistantAction =
  | { type: "profile"; userId: string }
  | { type: "room"; userId: string }
  | { type: "search"; query: string; destination: "people" | "rooms" | "collectibles" }
  | { type: "collection" }
  | { type: "wishlist" }
  | { type: "composer" }
  | { type: "inbox" }
  | { type: "add" };

export interface AssistantCard {
  kind: "collector" | "collectible" | "room" | "holding";
  id: string;
  title: string;
  subtitle?: string;
  detail?: string;
  action?: AssistantAction;
}

export type AssistantIntent =
  | "help"
  | "collectors"
  | "collectibles"
  | "rooms"
  | "collection"
  | "wishlist"
  | "wishlistOwners"
  | "wants"
  | "trades"
  | "missing"
  | "similar"
  | "common"
  | "price"
  | "general";

export type AssistantToolName =
  | "get_seoully_help"
  | "search_collectors"
  | "search_collectibles"
  | "search_rooms"
  | "get_my_collection"
  | "get_my_wishlist"
  | "find_wishlist_owners"
  | "find_collectors_wanting_my_items"
  | "find_potential_trade_matches"
  | "find_missing_collectibles"
  | "find_similar_collectors"
  | "find_similar_rooms"
  | "get_collector_details"
  | "get_collectible_details"
  | "estimate_collectible_value";

export function assistantPlanForTool(tool: string): AssistantIntent | undefined {
  const mapping: Record<AssistantToolName, AssistantIntent> = {
    get_seoully_help: "help",
    search_collectors: "collectors",
    search_collectibles: "collectibles",
    search_rooms: "rooms",
    get_my_collection: "collection",
    get_my_wishlist: "wishlist",
    find_wishlist_owners: "wishlistOwners",
    find_collectors_wanting_my_items: "wants",
    find_potential_trade_matches: "trades",
    find_missing_collectibles: "missing",
    find_similar_collectors: "similar",
    find_similar_rooms: "rooms",
    get_collector_details: "common",
    get_collectible_details: "collectibles",
    estimate_collectible_value: "price",
  };
  return Object.hasOwn(mapping, tool) ? mapping[tool as AssistantToolName] : undefined;
}

export interface AssistantToolResult {
  intent: AssistantIntent;
  currentSurface: string;
  cards: AssistantCard[];
  fallbackKey: string;
  fallbackParams?: Record<string, string | number>;
  currentCollectible?: { id: string; label: string; metadata: string };
  priceEstimate?: { range: string; source: "catalog-estimate" | "llm-estimate"; item: string };
}

export interface AssistantContext {
  surface: string;
  profileUserId?: string;
  templateId?: string;
}

const stopWords = new Set([
  "a", "an", "the", "me", "my", "i", "to", "for", "of", "on", "in", "at", "with", "please",
  "find", "show", "search", "look", "help", "who", "has", "have", "does", "do", "where", "what", "might", "could", "be", "this", "ones", "one",
  "how", "can", "could", "would", "is", "are", "want", "wants", "own", "owns", "collectors",
  "collector", "collectibles", "collectible", "cards", "card", "photocards", "photocard", "room", "rooms",
  "similar", "missing", "worth", "price", "estimate", "expensive", "wishlist", "collection", "trade", "trading", "item", "items", "아이템",
  "my", "mine", "내", "나", "위시리스트", "컬렉션", "포토카드", "포카", "누가", "찾아", "찾아줘", "보여", "보여줘", "검색", "룸", "컬렉터", "사람", "카드", "에서", "에", "가", "를", "을", "은", "는", "것", "중", "있어", "있을까", "원해", "원하는", "싶어", "싶어요", "해줘", "얼마", "가격", "가치", "어때",
]);
const koreanQueryNoise = new Set([
  "내", "나의", "위시리스트", "컬렉션", "포토카드", "포카", "아이템", "컬렉터", "컬렉터들", "사람", "카드", "누가", "찾아줘", "찾아",
  "보여줘", "보여", "검색", "룸", "에서", "에", "가", "를", "을", "은", "는", "것", "중", "있어", "있을까", "원해",
  "원하는", "싶어", "싶어요", "해줘", "얼마", "얼마야", "가격", "가치", "어때", "있나요", "있어?",
]);

function cleanQuery(question: string): string {
  const stripped = question
    .replace(/\b(who has|who have|find me|find|show me|show|search for|search|looking for|what|which|where|how do i|how can i|how does|tell me|my|on my|in my|on|my wishlist|my collection|collectors|collector|collectibles|collectible|photocards|photocard|cards|card|rooms|room|similar to me|similar|missing|am i missing|worth|estimate|price|expensive|trade for|might want|want|wants)\b/gi, " ")
    .replace(/[?.,!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cleanedKorean = stripped.split(/\s+/).filter((token) => !koreanQueryNoise.has(token)).join(" ").trim();
  return cleanedKorean || stripped || question.trim();
}

function words(question: string): string[] {
  return question.toLocaleLowerCase().replace(/[^\p{L}\p{N}@]+/gu, " ").split(/\s+/).filter((word) => word && !stopWords.has(word));
}

function metadata(template: CollectibleTemplate): { title: string; subtitle: string; metadata: string } {
  const memberRecord = template.memberId ? repository.getMember(template.memberId) : undefined;
  const member = memberRecord?.stageName;
  const groupRecord = repository.getGroup(template.groupId);
  const group = groupRecord?.name;
  const release = template.releaseId ? repository.getRelease(template.releaseId)?.title : undefined;
  const era = template.eraId ? repository.getEra(template.eraId)?.name : undefined;
  const version = template.releaseVersionId ? repository.getReleaseVersion(template.releaseVersionId)?.name : undefined;
  const title = member ?? template.name;
  const subtitle = [group, release ?? era, version, template.name !== title ? template.name : undefined].filter(Boolean).join(" · ");
  return { title, subtitle, metadata: [group, groupRecord?.nativeName, member, memberRecord?.nativeName, release ?? era, version, template.name].filter(Boolean).join(" · ") };
}

function catalogByTerms(query: string): CollectibleTemplate[] {
  const terms = words(query);
  if (terms.length === 0) return repository.searchCatalog(query);
  const hitsById = new Map<string, CollectibleTemplate>();
  for (const term of terms) {
    for (const template of repository.searchCatalog(term)) hitsById.set(template.id, template);
  }
  return [...hitsById.values()].filter((template) => {
    const meta = metadata(template).metadata.toLocaleLowerCase();
    return terms.every((term) => meta.includes(term));
  });
}

function matchingOwnedTemplate(query: string, viewerId: UserId, currentTemplateId?: string): CollectibleTemplate | undefined {
  if (currentTemplateId) {
    const current = repository.getTemplate(currentTemplateId as TemplateId);
    if (current) return current;
  }
  const viewer = repository.listHoldingViews(viewerId);
  const terms = words(query);
  return viewer.find(({ template }) => terms.every((term) => metadata(template).metadata.toLowerCase().includes(term)))?.template;
}

function identifiedPriceTemplate(query: string, viewerId: UserId, currentTemplateId?: string, requiresOwned = false): CollectibleTemplate | undefined {
  if (currentTemplateId) {
    const contextual = repository.getTemplate(currentTemplateId as TemplateId);
    if (contextual && (!requiresOwned || repository.listHoldings(viewerId).some((holding) => holding.templateId === contextual.id))) return contextual;
    if (requiresOwned) return undefined;
  }
  const terms = words(query);
  if (terms.length === 0) return undefined;
  const candidates = catalogByTerms(query).filter((template) =>
    terms.every((term) => metadata(template).metadata.toLowerCase().includes(term)),
  );
  if (candidates.length !== 1) return undefined;
  const template = candidates[0]!;
  const release = template.releaseId ? repository.getRelease(template.releaseId)?.title.toLowerCase() : "";
  const era = template.eraId ? repository.getEra(template.eraId)?.name.toLowerCase() : "";
  const version = template.releaseVersionId ? repository.getReleaseVersion(template.releaseVersionId)?.name.toLowerCase() : "";
  const specificTerms = [template.name.toLowerCase(), release, era, version].filter((value): value is string => !!value);
  const identified = terms.some((term) => specificTerms.some((value) => value.includes(term)));
  if (!identified) return undefined;
  // If the person says "my ...", make sure that identified catalog entry is actually theirs.
  if ((requiresOwned || /\b(my|mine|내)\b/i.test(query)) && !repository.listHoldings(viewerId).some((holding) => holding.templateId === template.id)) {
    return undefined;
  }
  return template;
}

function userCard(userId: UserId, detail?: string): AssistantCard | undefined {
  const user = repository.getUser(userId);
  const profile = repository.getProfile(userId);
  if (!user || !profile) return undefined;
  const groups = profile.favoriteGroupIds.map((id) => repository.getGroup(id)?.name).filter(Boolean).slice(0, 2);
  const biases = profile.biasMemberIds.map((id) => repository.getMember(id)?.stageName).filter(Boolean).slice(0, 2);
  return {
    kind: "collector",
    id: user.id,
    title: user.displayName,
    subtitle: `@${user.handle}${groups.length || biases.length ? ` · ${[...groups, ...biases].join(" · ")}` : ""}`,
    ...(detail ? { detail } : {}),
    action: { type: "profile", userId: user.id },
  };
}

function localizedCompatibility(locale: Locale, score: number, otherId: UserId, viewerId: UserId): string {
  const compatibility = repository.getCollectionCompatibility(viewerId, otherId);
  const reasons = compatibilityLines(compatibility, {
    group: (id) => repository.getGroup(id)?.name,
    member: (id) => repository.getMember(id)?.stageName,
    era: (id) => repository.getEra(id)?.name,
  }, (key, params) => translate(locale, key, params));
  return [translate(locale, "assistant.detail.compatibility", { score }), ...reasons].join(" · ");
}

function collectibleCard(template: CollectibleTemplate): AssistantCard {
  const info = metadata(template);
  return {
    kind: "collectible",
    id: template.id,
    title: info.title,
    subtitle: info.subtitle,
    action: { type: "search", query: info.title, destination: "collectibles" },
  };
}

function intentFor(question: string, context: AssistantContext): AssistantIntent {
  const q = question.toLowerCase();
  if (/worth|price|expensive|estimate|가치|얼마/.test(q)) return "price";
  if (/remove|delete|unwish|change status|mark .*trade|삭제|제거|변경/.test(q)) return "help";
  if (/how do i|how can i|how does|where is|where do|how to|방법|어떻게|어디/.test(q)) return "help";
  if (/trade|trade for|교환/.test(q)) return "trades";
  if (/wishlist|위시/.test(q) && /who|has|own|have|누가|가지|갖고/.test(q)) return "wishlistOwners";
  if (/who|anyone|collector|collectors|누가|컬렉터/.test(q) && /want|wants|looking for|찾|원하/.test(q)) return "wants";
  if (/missing|am i missing|빠진|없는/.test(q)) return "missing";
  if (/wishlist|위시/.test(q) && /my|mine|내/.test(q)) return "wishlist";
  if (/collection|what do i own|my cards|내 컬렉션/.test(q) && /my|mine|own|내|what/.test(q)) return "collection";
  if (/room|rooms|룸/.test(q)) return "rooms";
  if (/collectible|photocard|card|item|카드|포카|아이템/.test(q)) return "collectibles";
  if (/similar|like me|같은 취향|비슷/.test(q)) return "similar";
  if (context.profileUserId && /we|both|common|in common|같이|공통/.test(q)) return "common";
  if (/collector|collectors|who collects|find .* people|누구/.test(q)) return "collectors";
  return "general";
}

function helpAnswer(question: string, viewerId: UserId): { key: MessageKey; action: AssistantAction } {
  const q = question.toLowerCase();
  if (/how does (seoully|this) work|what is seoully|서울리는 어떤|서울리 사용/.test(q)) {
    return { key: "assistant.answer.howSeoullyWorks", action: { type: "profile", userId: viewerId } };
  }
  if (/add|collectible|holding|추가|등록/.test(q)) return { key: "assistant.answer.helpAdd", action: { type: "add" } };
  const asksHow = /how do i|how can i|how to|어떻게/.test(q);
  if (/remove|delete|unwish|삭제|제거/.test(q) || (!asksHow && /change status|mark .*trade|변경/.test(q))) {
    return { key: "assistant.answer.noMutations", action: { type: "collection" } };
  }
  if (/wishlist|위시/.test(q)) return { key: "assistant.answer.helpWishlist", action: { type: "wishlist" } };
  if (/search rooms|find rooms|룸 검색|룸 찾/.test(q)) return { key: "assistant.answer.helpSearch", action: { type: "search", query: "", destination: "rooms" } };
  if (/room|change my room|decorate|룸/.test(q)) return { key: "assistant.answer.helpRoom", action: { type: "room", userId: viewerId } };
  if (/trade|open to trade|교환/.test(q)) return { key: "assistant.answer.helpTrade", action: { type: "collection" } };
  if (/tag|post|게시/.test(q)) return { key: "assistant.answer.helpPost", action: { type: "composer" } };
  if (/color|profile|프로필|색/.test(q)) return { key: "assistant.answer.helpProfile", action: { type: "profile", userId: viewerId } };
  if (/room|룸/.test(q)) return { key: "assistant.answer.helpRoom", action: { type: "room", userId: viewerId } };
  const destination = /room|룸/.test(q) ? "rooms" : /collectible|photocard|collectible|포토카드|포카/.test(q) ? "collectibles" : "people";
  return { key: "assistant.answer.helpSearch", action: { type: "search", query: "", destination } };
}

/** Read-only allowlisted tools over Seoully's actual in-browser repository. */
export function runAssistantTools(input: {
  viewerId: UserId;
  question: string;
  locale: Locale;
  context: AssistantContext;
  previousUserIds?: string[];
  intentOverride?: AssistantIntent;
  queryOverride?: string;
}): AssistantToolResult {
  const { viewerId, question, context } = input;
  const intent = input.intentOverride ?? intentFor(question, context);
  const query = input.queryOverride?.trim() || cleanQuery(question);
  const result: AssistantToolResult = { intent, currentSurface: context.surface, cards: [], fallbackKey: "assistant.answer.general" };
  const user = repository.getUser(viewerId);
  if (!user) return { ...result, fallbackKey: "assistant.answer.unavailable" };

  if (context.templateId) {
    const current = repository.getTemplate(context.templateId as TemplateId);
    if (current) {
      const info = metadata(current);
      result.currentCollectible = { id: current.id, label: `${info.title} — ${info.subtitle}`, metadata: info.metadata };
    }
  }

  if (input.previousUserIds?.length && /which of them|which ones|those|them|what about|specifically|그중|그 사람들|그리고|그럼/.test(question.toLowerCase())) {
    const terms = words(query);
    const refine = /what about|specifically|그리고|그럼/.test(question.toLowerCase());
    result.intent = "wants";
    result.cards = input.previousUserIds.slice(0, 8).flatMap((id) => {
      const otherId = id as UserId;
      if (!repository.getUser(otherId)) return [];
      const compat = repository.getCollectionCompatibility(viewerId, otherId);
      const matches = compat.theyOwnYourWants.filter((templateId) => {
        const template = repository.getTemplate(templateId);
        return !!template && (!refine || terms.length === 0 || terms.some((term) => metadata(template).metadata.toLowerCase().includes(term)));
      });
      if (!matches.length) return [];
      const names = matches.map((templateId) => metadata(repository.getTemplate(templateId)!).title);
      const card = userCard(otherId, translate(input.locale, "assistant.detail.wishlistCount", { count: names.length, names: names.join(" · ") }));
      return card ? [card] : [];
    });
    result.fallbackKey = result.cards.length ? "assistant.answer.followupWants" : "assistant.answer.followupWantsEmpty";
    return result;
  }

  if (intent === "help") {
    const help = helpAnswer(question, viewerId);
    result.fallbackKey = help.key;
    result.cards = [{ kind: "holding", id: "help-action", title: translate(input.locale, "assistant.takeMeThere"), action: help.action }];
    return result;
  }

  if (intent === "collection") {
    const holdings = repository.listHoldingViews(viewerId);
    result.cards = holdings.slice(0, 8).map((view) => ({
      kind: "holding", id: view.holding.id, title: metadata(view.template).title, subtitle: metadata(view.template).subtitle,
    }));
    result.fallbackParams = { count: holdings.length };
    result.fallbackKey = holdings.length ? "assistant.answer.collection" : "assistant.answer.collectionEmpty";
    result.cards.push({ kind: "holding", id: "open-collection", title: translate(input.locale, "assistant.viewCollection"), action: { type: "collection" } });
    return result;
  }

  if (intent === "wishlist") {
    const wishlist = repository.listWishlist(viewerId);
    result.cards = wishlist.slice(0, 8).flatMap((wish) => {
      const template = repository.getTemplate(wish.templateId);
      return template ? [collectibleCard(template)] : [];
    });
    result.cards.push({ kind: "holding", id: "open-wishlist", title: translate(input.locale, "assistant.viewWishlist"), action: { type: "wishlist" } });
    result.fallbackParams = { count: wishlist.length };
    result.fallbackKey = wishlist.length ? "assistant.answer.wishlist" : "assistant.answer.wishlistEmpty";
    return result;
  }

  if (intent === "wishlistOwners") {
    const wants = new Set(repository.listWishlist(viewerId).map((item) => item.templateId));
    result.cards = repository.listUsers().filter((other) => other.id !== viewerId).flatMap((other) => {
      const overlaps = repository.listHoldings(other.id).filter((holding) => wants.has(holding.templateId));
      return overlaps.length ? [userCard(other.id, overlaps.slice(0, 4).map((h) => metadata(repository.getTemplate(h.templateId)!).title).join(" · "))!] : [];
    }).filter(Boolean).slice(0, 8);
    result.fallbackParams = { count: result.cards.length };
    result.fallbackKey = result.cards.length ? "assistant.answer.wishlistOwners" : "assistant.answer.wishlistOwnersEmpty";
    return result;
  }

  if (intent === "wants" || intent === "trades") {
    const matching = matchingOwnedTemplate(query, viewerId, context.templateId);
    if (!matching) {
      result.fallbackKey = "assistant.answer.identifyOwned";
      result.cards = repository.listHoldingViews(viewerId).slice(0, 8).map((v) => collectibleCard(v.template));
      return result;
    }
    result.currentCollectible = { id: matching.id, label: metadata(matching).metadata, metadata: metadata(matching).metadata };
    for (const other of repository.listUsers()) {
      if (other.id === viewerId || !repository.isWanted(other.id, matching.id)) continue;
      const compat = repository.getCollectionCompatibility(viewerId, other.id);
      const reciprocal = compat.youOwnTheirWants.length > 0 && compat.theyOwnYourWants.length > 0;
      if (intent === "trades" && !reciprocal) continue;
      const held = repository.listHoldings(viewerId).find((h) => h.templateId === matching.id);
      const info = [
        translate(input.locale, "assistant.detail.youOwn", { name: `${metadata(matching).title}${held?.tradeStatus === "for-trade" || held?.tradeStatus === "open-to-offers" ? ` (${translate(input.locale, "assistant.detail.openToTrade")})` : ""}` }),
        ...(reciprocal ? [translate(input.locale, "assistant.detail.theyOwnWishlist", { names: compat.theyOwnYourWants.map((id) => metadata(repository.getTemplate(id)!).title).join(" · ") })] : []),
      ].join(" — ");
      const card = userCard(other.id, info);
      if (card) result.cards.push(card);
    }
    result.fallbackKey = intent === "trades" ? (result.cards.length ? "assistant.answer.trades" : "assistant.answer.tradesEmpty") : (result.cards.length ? "assistant.answer.wants" : "assistant.answer.wantsEmpty");
    return result;
  }

  if (intent === "missing") {
    const terms = words(query);
    const members = repository.listMembers().filter((m) => terms.some((term) => m.stageName.toLowerCase().includes(term) || m.nativeName?.toLowerCase().includes(term)));
    const releases = repository.listReleases().filter((r) => terms.some((term) => r.title.toLowerCase().includes(term)));
    const groups = repository.listGroups().filter((g) => terms.some((term) => g.name.toLowerCase().includes(term) || g.nativeName?.toLowerCase().includes(term)));
    const filtered = repository.listTemplates().filter((template) => {
      if (members.length && !members.some((m) => m.id === template.memberId)) return false;
      if (releases.length && !releases.some((r) => r.id === template.releaseId)) return false;
      if (groups.length && !groups.some((g) => g.id === template.groupId)) return false;
      return template.kind === "photocard";
    });
    const owned = new Set(repository.listHoldings(viewerId).map((holding) => holding.templateId));
    result.cards = filtered.filter((template) => !owned.has(template.id)).slice(0, 12).map(collectibleCard);
    result.fallbackKey = result.cards.length ? "assistant.answer.missing" : "assistant.answer.missingEmpty";
    result.fallbackParams = { count: result.cards.length };
    return result;
  }

  if (intent === "common" && context.profileUserId) {
    const other = repository.getUser(context.profileUserId as UserId);
    if (other && other.id !== viewerId) {
      const compat = repository.getCollectionCompatibility(viewerId, other.id);
      const shared = compat.sharedTemplateIds.slice(0, 6).map((id) => repository.getTemplate(id)).filter((t): t is CollectibleTemplate => !!t);
      const detail = localizedCompatibility(input.locale, compat.score, other.id, viewerId);
      const card = userCard(other.id, detail);
      if (card) result.cards = [card, ...shared.map(collectibleCard)];
      result.fallbackKey = compat.score > 0 ? "assistant.answer.common" : "assistant.answer.commonEmpty";
      result.fallbackParams = { score: compat.score };
      return result;
    }
  }

  if (intent === "similar") {
    const profile = repository.getProfile(viewerId);
    const seed = profile?.biasMemberIds.map((id) => repository.getMember(id)?.stageName).find(Boolean)
      ?? profile?.favoriteGroupIds.map((id) => repository.getGroup(id)?.name).find(Boolean);
    const hits = seed ? searchPeople(seed, viewerId) : repository.listUsers().filter((u) => u.id !== viewerId).map((u) => ({ userId: u.id }));
    result.cards = hits.map(({ userId }) => {
      const comp = repository.getCollectionCompatibility(viewerId, userId);
      return userCard(userId, localizedCompatibility(input.locale, comp.score, userId, viewerId));
    }).filter((card): card is AssistantCard => !!card).sort((a, b) => Number.parseInt(b.detail ?? "0", 10) - Number.parseInt(a.detail ?? "0", 10)).slice(0, 6);
    result.fallbackKey = result.cards.length ? "assistant.answer.similar" : "assistant.answer.noResults";
    return result;
  }

  if (intent === "rooms") {
    const profile = repository.getProfile(viewerId);
    const similarRoom = /similar|like mine|like my room|비슷|내 룸/.test(question.toLowerCase());
    const seed = similarRoom
      ? profile?.biasMemberIds.map((id) => repository.getMember(id)?.stageName).find(Boolean)
        ?? profile?.favoriteGroupIds.map((id) => repository.getGroup(id)?.name).find(Boolean)
      : undefined;
    const q = seed ?? query;
    const hits = searchRooms(q, viewerId).filter((hit) => !similarRoom || hit.userId !== viewerId);
    result.cards = hits.map((hit) => {
      const owner = repository.getUser(hit.userId);
      const profile = repository.getProfile(hit.userId);
      const identity = [profile?.favoriteGroupIds.map((id) => repository.getGroup(id)?.name).filter(Boolean).join(" · "), profile?.biasMemberIds.map((id) => repository.getMember(id)?.stageName).filter(Boolean).join(" · ")].filter(Boolean).join(" · ");
      return { kind: "room" as const, id: hit.roomId, title: owner ? translate(input.locale, "assistant.roomTitle", { name: owner.displayName }) : "", subtitle: identity || hit.identity, ...(hit.matchScore !== undefined ? { detail: translate(input.locale, "assistant.detail.compatibility", { score: hit.matchScore }) } : {}), action: { type: "room" as const, userId: hit.userId } };
    });
    result.fallbackKey = result.cards.length ? "assistant.answer.rooms" : "assistant.answer.noResults";
    return result;
  }

  if (intent === "collectibles" || intent === "price") {
    const directContext = context.templateId && /\b(this|it|this card|this collectible)\b|이거|이것|이 카드|이 아이템/i.test(question)
      ? repository.getTemplate(context.templateId as TemplateId)
      : undefined;
    const item = intent === "price"
      ? identifiedPriceTemplate(query, viewerId, context.templateId, /\b(my|mine)\b|내/.test(question.toLowerCase()))
      : directContext;
    const hits = item
      ? [item]
      : [...new Map([
          ...catalogByTerms(query).map((template) => [template.id, template] as const),
          ...searchCollectibles(query, viewerId).map((hit) => [hit.template.id, hit.template] as const),
        ]).values()];
    result.cards = hits.slice(0, 8).map(collectibleCard);
    if (intent === "price") {
      if (!item) {
        result.fallbackKey = "assistant.answer.priceNeedIdentity";
        return result;
      }
      const selected = item;
      const info = metadata(selected);
      result.currentCollectible = { id: selected.id, label: info.metadata, metadata: info.metadata };
      if (selected.estimatedValue) {
        const amount = selected.estimatedValue.amount;
        const low = Math.floor(amount * 0.8);
        const high = Math.ceil(amount * 1.2);
        result.priceEstimate = { range: `$${low}–${high}`, source: "catalog-estimate", item: info.metadata };
        result.fallbackKey = "assistant.answer.priceEstimate";
        result.fallbackParams = { range: result.priceEstimate.range, item: info.metadata };
      } else {
        result.fallbackKey = "assistant.answer.priceProviderUnavailable";
        result.fallbackParams = { item: info.metadata };
      }
      return result;
    }
    result.fallbackKey = result.cards.length ? "assistant.answer.collectibles" : "assistant.answer.noResults";
    return result;
  }

  if (intent === "collectors") {
    const hits = searchPeople(query, viewerId);
    result.cards = hits.filter(({ userId }) => userId !== viewerId).slice(0, 8).map(({ userId }) => {
      const compatibility = repository.getCollectionCompatibility(viewerId, userId);
      return userCard(userId, localizedCompatibility(input.locale, compatibility.score, userId, viewerId));
    }).filter((card): card is AssistantCard => !!card);
    result.fallbackKey = result.cards.length ? "assistant.answer.collectors" : "assistant.answer.noResults";
    result.fallbackParams = { count: result.cards.length };
    return result;
  }

  if (context.profileUserId) {
    const other = repository.getUser(context.profileUserId as UserId);
    if (other && other.id !== viewerId) {
      const compat = repository.getCollectionCompatibility(viewerId, other.id);
      const card = userCard(other.id, localizedCompatibility(input.locale, compat.score, other.id, viewerId));
      result.cards = card ? [card] : [];
      result.fallbackKey = "assistant.answer.common";
      return result;
    }
  }

  result.fallbackKey = "assistant.answer.starters";
  result.cards = [
    { kind: "holding", id: "starter-search", title: translate(input.locale, "assistant.findSomething"), action: { type: "search", query: "", destination: "people" } },
    { kind: "holding", id: "starter-collection", title: translate(input.locale, "assistant.viewCollection"), action: { type: "collection" } },
    { kind: "holding", id: "starter-wishlist", title: translate(input.locale, "assistant.viewWishlist"), action: { type: "wishlist" } },
  ];
  return result;
}

export function assistantFallback(result: AssistantToolResult, t: (key: MessageKey, params?: Record<string, string | number>) => string): string {
  return t(result.fallbackKey as MessageKey, result.fallbackParams);
}
