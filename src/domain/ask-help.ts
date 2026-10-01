import type { MessageKey } from "../locale/en";
import type { AskNavigationAction } from "./ask-context";
import { searchDestinationFromQuestion } from "./ask-context";
import { navigationIntentFromAsk } from "./ask-intent";

export function helpForQuestion(question: string, viewerId: string): { key: MessageKey; action: AskNavigationAction } {
  const q = question.toLowerCase();
  if (/how does (seoully|this) work|what is seoully|서울리는 어떤|서울리 사용/.test(q)) {
    return { key: "assistant.answer.howSeoullyWorks", action: { type: "profile_self" } };
  }
  if (/binder|바인더/.test(q)) {
    return { key: "assistant.answer.helpBinder", action: { type: "collection" } };
  }
  if (/add|collectible|holding|photocard|추가|등록|포카/.test(q) && /how|어디|어떻게|where|add/.test(q)) {
    return { key: "assistant.answer.helpAdd", action: { type: "add" } };
  }
  const asksHow = /how do i|how can i|how to|어떻게|어디/.test(q);
  if (/remove|delete|unwish|삭제|제거/.test(q) || (!asksHow && /change status|mark .*trade|변경/.test(q))) {
    return { key: "assistant.answer.noMutations", action: { type: "collection" } };
  }
  if (/wishlist|위시/.test(q)) return { key: "assistant.answer.helpWishlist", action: { type: "wishlist" } };
  if (/message|inbox|메시지|채팅/.test(q)) return { key: "assistant.answer.helpMessages", action: { type: "inbox" } };
  if (/search rooms|find rooms|룸 검색|룸 찾/.test(q)) {
    return { key: "assistant.answer.helpSearch", action: { type: "search", query: "", destination: "rooms" } };
  }
  if (/room|decorate|룸/.test(q)) return { key: "assistant.answer.helpRoom", action: { type: "room", userId: viewerId } };
  if (/trade|open to trade|교환/.test(q)) return { key: "assistant.answer.helpTrade", action: { type: "collection" } };
  if (/tag|post|게시/.test(q)) return { key: "assistant.answer.helpPost", action: { type: "composer" } };
  if (/color|profile|프로필|색/.test(q)) return { key: "assistant.answer.helpProfile", action: { type: "profile_self" } };
  const destination = searchDestinationFromQuestion(question, "people") ?? "people";
  return { key: "assistant.answer.helpSearch", action: { type: "search", query: "", destination } };
}

export function navigationIntentFromQuestion(question: string): AskNavigationAction | null {
  return navigationIntentFromAsk(question);
}
