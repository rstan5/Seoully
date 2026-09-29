/** Native communications helpers mirrored from the server comms contract. */

export const NOTICE_KINDS = ["like", "comment", "follow", "trade", "activity", "repost"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export function conversationPairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

export function conversationIsUnread(input: {
  lastMessageCreatedAt: string | null;
  lastMessageFromPeer: boolean;
  lastReadAt: string | null;
}): boolean {
  if (!input.lastMessageCreatedAt || !input.lastMessageFromPeer) return false;
  if (!input.lastReadAt) return true;
  return input.lastMessageCreatedAt > input.lastReadAt;
}

export function messageHasSendableContext(input: {
  body: string;
  postId?: string | null;
  templateIds?: string[];
}): boolean {
  return Boolean(input.body.trim() || input.postId || (input.templateIds && input.templateIds.length > 0));
}

export function shouldNotifyRecipient(actorId: string, recipientId: string): boolean {
  return Boolean(actorId && recipientId && actorId !== recipientId);
}

export function sanitizeMessageBody(body: string): string {
  return body.trim().slice(0, 2000);
}

export function conversationPreview(
  input: { body: string; hasPost?: boolean; hasCollectibles?: boolean },
  labels: { empty: string; sharedPost: string; sharedCollectible: string },
): string {
  const body = input.body.trim();
  if (body) return body;
  if (input.hasPost) return labels.sharedPost;
  if (input.hasCollectibles) return labels.sharedCollectible;
  return labels.empty;
}

export function noticeDestination(input: {
  kind: NoticeKind;
  actorUserId: string;
  postId?: string;
  templateIds?: string[];
}): { pathname: "/collector" | "/thread"; params: Record<string, string> } {
  if (input.kind === "trade") {
    return {
      pathname: "/thread",
      params: {
        userId: input.actorUserId,
        ...(input.templateIds && input.templateIds.length ? { templateIds: input.templateIds.join(",") } : {}),
      },
    };
  }
  return { pathname: "/collector", params: { userId: input.actorUserId } };
}
