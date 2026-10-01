import { searchDestinationFromQuestion, type AskNavigationAction, type AskSearchDestination } from "./ask-context";

export const ASK_HISTORY_LIMIT = 8;
export const ASK_QUESTION_MAX = 800;

export type AskNeed = "general" | "seoully" | "navigate" | "help" | "current_info" | "price";

const NAV_VERB = /take me|go to|open|show me|show my|help me find|\bfind\b|\bsearch\b|보여줘|열어|가자|가줘|찾아줘|찾아|검색/;
const HOW_INFO = /how do i|how can i|how to|how does|방법|어떻게/;
const PRICE = /\b(worth|price|resale|market value|how much|valuation|estimate)\b|시세|얼마|가격|가치/;
const CURRENT = /\b(billboard|chart|ranking|rankings|trending now|this week|this month|right now|currently|latest comeback|most popular now)\b|차트|순위|지금 인기|이번 주/;
const SEOULLY_OWN = /\b(my collection|what do i own|stuff do i own|do i (already )?own|already own|holdings?|내 컬렉션|내가 가진|갖고 있|소유)\b/;
const SEOULLY_WISH = /\b(my wishlist|on my wishlist|what('s| is) on my wish|위시리스트|내 위시)\b/;
const SEOULLY_GRAPH = /\b(similar to me|like me|collectors? like|compatibility|in common|who has things i want|who owns|closest to complete|am i missing|what am i missing|known collections)\b|비슷|같은 취향|궁합|빠진|없는/;
const SEOULLY_PEOPLE = /\b(collectors? who|find collectors|bts collectors|people who collect)\b|컬렉터/;
const SEOULLY_CATALOG = /\bin seoully('s)? catalog\b|서울리 카탈로그/;
const GENERAL_KNOWLEDGE = /\b(when did|who are the members|what does .+ mean|what is a |what is the difference|what's the difference|what are|meaning of)\b|언제 결성|멤버가 누구|무슨 뜻|차이가 뭐/;

export function extractAskSearchQuery(question: string): string {
  return question
    .replace(/\b(take me to|go to|open|show me|show my|help me find|find|search for|search|please|the|a|an)\b/gi, " ")
    .replace(/\b(who like|who likes|that like|that likes)\b/gi, " ")
    .replace(/\b(collectors?|people|rooms?|posts?|collectibles?|photocards?|cards?|profile|wishlist|collection|messages?|inbox)\b/gi, " ")
    .replace(/[?.,!]/g, " ")
    .replace(/컬렉터|사람|찾아줘|찾아|보여줘|열어|검색|위시리스트|컬렉션|프로필/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function isNavigationalAsk(question: string): boolean {
  const q = question.toLowerCase();
  if (HOW_INFO.test(q) && !/take me|go to|open|show me|보여줘|열어|가자/.test(q)) return false;
  return NAV_VERB.test(q) || /where is my|where do i|내 .+ 어디/.test(q);
}

export function classifyAskNeed(question: string): AskNeed {
  const q = question.toLowerCase().trim();
  if (!q) return "general";
  if (PRICE.test(q) && !/difference|차이/.test(q)) return "price";
  if (CURRENT.test(q)) return "current_info";
  if (GENERAL_KNOWLEDGE.test(q) && !SEOULLY_OWN.test(q) && !SEOULLY_WISH.test(q) && !SEOULLY_CATALOG.test(q)) {
    return "general";
  }
  if (isNavigationalAsk(question) && navigationIntentFromAsk(question)) return "navigate";
  if (HOW_INFO.test(q) || /where is|where do i|what is the binder|서울리 사용|서울리는 어떤/.test(q)) return "help";
  if (SEOULLY_OWN.test(q) || SEOULLY_WISH.test(q) || SEOULLY_GRAPH.test(q) || SEOULLY_PEOPLE.test(q) || SEOULLY_CATALOG.test(q)) {
    return "seoully";
  }
  if (/\b(wishlist|collection|own this|trade|교환)\b/.test(q)) return "seoully";
  return "general";
}

export function navigationIntentFromAsk(question: string): AskNavigationAction | null {
  const q = question.toLowerCase();
  if (!isNavigationalAsk(question) && !/where is my|where do i|내 .+ 어디/.test(q)) return null;
  if (/edit (my )?profile|프로필 수정|프로필 편집/.test(q)) return { type: "edit_profile" };
  if (/wishlist|위시/.test(q)) return { type: "wishlist" };
  if (/\b(add|collectible|photocard|holding|추가|등록|포카)\b/.test(q) && /add|collect|take me|open|go to|how|어디|어떻게|추가/.test(q)) {
    if (HOW_INFO.test(q) && !/take me|go to|open|show me|보여줘|열어/.test(q)) return null;
    if (/add|추가|collect/.test(q)) return { type: "add" };
  }
  if (/collection|컬렉션/.test(q) && !/collectible|add|추가/.test(q)) return { type: "collection" };
  if (/message|inbox|메시지/.test(q)) return { type: "inbox" };
  if (/profile|프로필/.test(q)) return { type: "profile_self" };
  if (/\b(discover|feed|home)\b|피드|홈/.test(q) && !/collector|컬렉터/.test(q)) return { type: "discover" };
  if (/post|compose|게시/.test(q)) return { type: "composer" };
  if (/room|룸/.test(q) && !/search|찾/.test(q)) return { type: "profile_self" };
  if (/collector|people|컬렉터|사람/.test(q)) {
    if (/like me|similar|비슷|같은 취향/.test(q)) return null;
    const query = extractAskSearchQuery(question);
    return { type: "search", query, destination: "people" };
  }
  if (/search|검색/.test(q)) {
    const destination: AskSearchDestination = searchDestinationFromQuestion(question, "people") ?? "people";
    return { type: "search", query: extractAskSearchQuery(question), destination };
  }
  if (/add|collect|추가/.test(q)) return { type: "add" };
  return null;
}
