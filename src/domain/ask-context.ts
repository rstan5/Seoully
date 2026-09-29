export const ASK_SURFACES = [
  "home",
  "discover",
  "following",
  "feed",
  "search",
  "profile",
  "collector",
  "collection",
  "wishlist",
  "collectible",
  "public_collectible",
  "inspect",
  "messages",
  "inbox",
  "conversation",
  "room",
  "collector_room",
  "notices",
  "compose",
  "collect",
  "add",
  "binder",
  "send_to",
  "arrival",
  "zone",
  "edit",
] as const;

export type AskSurface = (typeof ASK_SURFACES)[number];

export const ASK_SEARCH_DESTINATIONS = ["people", "rooms", "posts", "collectibles", "entities"] as const;
export type AskSearchDestination = (typeof ASK_SEARCH_DESTINATIONS)[number];

export const ASK_NAVIGATION_TYPES = [
  "profile",
  "profile_self",
  "room",
  "search",
  "collection",
  "wishlist",
  "composer",
  "inbox",
  "add",
  "conversation",
  "collectible",
  "public_collectible",
] as const;

export type AskNavigationType = (typeof ASK_NAVIGATION_TYPES)[number];

export type AskSurfaceContext = {
  surface: AskSurface;
  collectorUserId?: string;
  collectorHandle?: string;
  profileUserId?: string;
  targetUserId?: string;
  postId?: string;
  templateId?: string;
  holdingId?: string;
  conversationId?: string;
  searchQuery?: string;
  searchDestination?: AskSearchDestination;
  roomOwnerUserId?: string;
};

export type AskNavigationAction =
  | { type: "profile"; userId: string }
  | { type: "profile_self" }
  | { type: "room"; userId: string }
  | { type: "search"; query: string; destination?: AskSearchDestination }
  | { type: "collection" }
  | { type: "wishlist" }
  | { type: "composer" }
  | { type: "inbox" }
  | { type: "add" }
  | { type: "conversation"; conversationId: string; userId?: string }
  | { type: "collectible"; holdingId: string }
  | { type: "public_collectible"; userId: string; templateId?: string; holdingId?: string };

export const CATALOG_COMPLETENESS_DISCLAIMER = {
  en: "Based on the collectibles currently known to Seoully...",
  ko: "현재 서울리가 알고 있는 아이템을 기준으로...",
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HANDLE_RE = /^[a-z][a-z0-9_]{2,15}$/;
const FORBIDDEN_NAV_KEYS = ["pathname", "href", "url", "javascript", "deepLink", "route"] as const;

export function isAskSurface(value: unknown): value is AskSurface {
  return typeof value === "string" && (ASK_SURFACES as readonly string[]).includes(value);
}

export function isAskSearchDestination(value: unknown): value is AskSearchDestination {
  return typeof value === "string" && (ASK_SEARCH_DESTINATIONS as readonly string[]).includes(value);
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isSafeEntityId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && (UUID_RE.test(value) || /^[a-z0-9][a-z0-9_-]{1,63}$/i.test(value));
}

function firstParam(value: unknown): string {
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0].trim() : "";
  return typeof value === "string" ? value.trim() : "";
}

function optionalId(value: unknown): string | undefined {
  const text = firstParam(value);
  if (!text || text.length > 64) return undefined;
  if (isUuid(text)) return text;
  if (/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(text)) return text;
  return undefined;
}

function optionalHandle(value: unknown): string | undefined {
  const text = firstParam(value).replace(/^@/, "").toLowerCase();
  return HANDLE_RE.test(text) ? text : undefined;
}

function optionalQuery(value: unknown): string | undefined {
  const text = firstParam(value).replace(/\s+/g, " ").trim().slice(0, 120);
  return text || undefined;
}

export function parseAskContext(raw: unknown): AskSurfaceContext {
  const input = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const surface = isAskSurface(input.surface) ? input.surface : "home";
  const collectorUserId = optionalId(input.collectorUserId) ?? optionalId(input.profileUserId) ?? optionalId(input.targetUserId);
  const templateId = optionalId(input.templateId);
  const holdingId = optionalId(input.holdingId);
  const conversationId = optionalId(input.conversationId);
  const postId = optionalId(input.postId);
  const roomOwnerUserId = optionalId(input.roomOwnerUserId) ?? (surface === "collector_room" || surface === "room" ? collectorUserId : undefined);
  const searchDestination = isAskSearchDestination(input.searchDestination) ? input.searchDestination : undefined;
  const searchQuery = optionalQuery(input.searchQuery);
  const collectorHandle = optionalHandle(input.collectorHandle);
  const context: AskSurfaceContext = { surface };
  if (collectorUserId) {
    context.collectorUserId = collectorUserId;
    context.profileUserId = collectorUserId;
    context.targetUserId = collectorUserId;
  }
  if (collectorHandle) context.collectorHandle = collectorHandle;
  if (templateId) context.templateId = templateId;
  if (holdingId) context.holdingId = holdingId;
  if (conversationId) context.conversationId = conversationId;
  if (postId) context.postId = postId;
  if (roomOwnerUserId) context.roomOwnerUserId = roomOwnerUserId;
  if (searchQuery) context.searchQuery = searchQuery;
  if (searchDestination) context.searchDestination = searchDestination;
  return context;
}

export function mergeAskContext(route: AskSurfaceContext, overlay?: Partial<AskSurfaceContext> | null): AskSurfaceContext {
  if (!overlay) return parseAskContext(route);
  return parseAskContext({ ...route, ...overlay });
}

export function nativeRouteLeaf(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "(tabs)") return parts[1] ?? "index";
  return parts[0] ?? "";
}

export function contextFromNativeRoute(
  pathname: string,
  params: Record<string, string | string[] | undefined> = {},
): AskSurfaceContext {
  const leaf = nativeRouteLeaf(pathname);
  const userId = optionalId(params.userId);
  const holdingId = optionalId(params.holdingId);
  const templateId = optionalId(params.templateId);
  const conversationId = optionalId(params.conversationId);
  const postId = optionalId(params.postId);
  const handle = optionalHandle(params.handle);
  const searchQuery = optionalQuery(params.q);
  const searchDestination = isAskSearchDestination(firstParam(params.dest)) ? firstParam(params.dest) as AskSearchDestination : undefined;

  if (leaf === "search") {
    return parseAskContext({
      surface: "search",
      ...(searchQuery ? { searchQuery } : {}),
      ...(searchDestination ? { searchDestination } : {}),
    });
  }
  if (leaf === "profile") return parseAskContext({ surface: "profile" });
  if (leaf === "collector") {
    return parseAskContext({
      surface: "collector",
      ...(userId ? { collectorUserId: userId } : {}),
      ...(handle ? { collectorHandle: handle } : {}),
    });
  }
  if (leaf === "collection") return parseAskContext({ surface: "collection" });
  if (leaf === "collectible") {
    return parseAskContext({
      surface: "collectible",
      ...(holdingId ? { holdingId } : {}),
      ...(templateId ? { templateId } : {}),
    });
  }
  if (leaf === "public-collectible") {
    return parseAskContext({
      surface: "public_collectible",
      ...(userId ? { collectorUserId: userId } : {}),
      ...(holdingId ? { holdingId } : {}),
      ...(templateId ? { templateId } : {}),
    });
  }
  if (leaf === "messages") return parseAskContext({ surface: "messages" });
  if (leaf === "thread") {
    return parseAskContext({
      surface: "conversation",
      ...(conversationId ? { conversationId } : {}),
      ...(userId ? { collectorUserId: userId } : {}),
      ...(handle ? { collectorHandle: handle } : {}),
    });
  }
  if (leaf === "room") return parseAskContext({ surface: "room" });
  if (leaf === "collector-room") {
    return parseAskContext({
      surface: "collector_room",
      ...(userId ? { collectorUserId: userId, roomOwnerUserId: userId } : {}),
    });
  }
  if (leaf === "notices") return parseAskContext({ surface: "notices" });
  if (leaf === "create") return parseAskContext({ surface: "compose" });
  if (leaf === "collect") return parseAskContext({ surface: "collect" });
  if (leaf === "add") {
    return parseAskContext({
      surface: "add",
      ...(templateId ? { templateId } : {}),
    });
  }
  if (leaf === "binder") {
    return parseAskContext({
      surface: "binder",
      ...(holdingId ? { holdingId } : {}),
    });
  }
  if (leaf === "send-to") {
    return parseAskContext({
      surface: "send_to",
      ...(postId ? { postId } : {}),
    });
  }
  if (leaf === "index" || leaf === "" || leaf === "feed") return parseAskContext({ surface: "discover" });
  return parseAskContext({ surface: "home" });
}

function hasForbiddenNavKey(value: Record<string, unknown>) {
  return FORBIDDEN_NAV_KEYS.some((key) => key in value && value[key] != null && value[key] !== "");
}

export function isAskNavigationAction(value: unknown): value is AskNavigationAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Record<string, unknown>;
  if (hasForbiddenNavKey(action)) return false;
  const type = action.type;
  if (typeof type !== "string" || !(ASK_NAVIGATION_TYPES as readonly string[]).includes(type)) return false;
  if (type === "profile") return isSafeEntityId(action.userId);
  if (type === "room") return isSafeEntityId(action.userId);
  if (type === "search") {
    if (typeof action.query !== "string") return false;
    if (action.destination != null && !isAskSearchDestination(action.destination)) return false;
    return !("pathname" in action);
  }
  if (type === "conversation") return isSafeEntityId(action.conversationId) && (action.userId == null || isSafeEntityId(action.userId));
  if (type === "collectible") return isSafeEntityId(action.holdingId);
  if (type === "public_collectible") {
    return isSafeEntityId(action.userId)
      && (action.templateId == null || isSafeEntityId(action.templateId))
      && (action.holdingId == null || isSafeEntityId(action.holdingId));
  }
  return type === "profile_self" || type === "collection" || type === "wishlist" || type === "composer" || type === "inbox" || type === "add";
}

export function searchDestinationFromQuestion(question: string, fallback?: AskSearchDestination): AskSearchDestination | undefined {
  const q = question.toLocaleLowerCase();
  if (/room|룸/.test(q)) return "rooms";
  if (/post|게시/.test(q)) return "posts";
  if (/group|member|그룹|멤버/.test(q)) return "entities";
  if (/collector|people|컬렉터|사람/.test(q)) return "people";
  if (/photocard|collectible|album|카드|포카|아이템|앨범/.test(q)) return "collectibles";
  return fallback;
}
