import type {
  CommentId,
  IsoDate,
  Message,
  MessageId,
  Notice,
  NoticeId,
  Post,
  PostComment,
  PostId,
  PostLike,
  PostMedia,
  TemplateId,
  Thread,
  ThreadId,
} from "../types";
import { MINJI, SOO } from "./collectors";

const id = <T extends string>(v: string): T => v as T;

function photo(url: string, alt: string): PostMedia {
  return { kind: "photo", url, alt };
}

function video(url: string, poster: string, duration: string, alt: string): PostMedia {
  return { kind: "video", url, poster, duration, alt };
}

/**
 * Authored posts — collection life and real life, mixed.
 */
export const POSTS: Post[] = [
  {
    id: id<PostId>("p-minji-concert"),
    authorId: MINJI,
    kind: "concert",
    createdAt: "2025-03-02" as IsoDate,
    body: "Finally saw IVE live 😭 I am not recovering from this.",
    templateIds: [],
    media: [
      video(
        "/posts/minji-concert.png",
        "/posts/minji-concert.png",
        "0:18",
        "Crowd at an IVE concert, pink lightsticks",
      ),
      photo("/posts/minji-concert.png", "KSPO Dome from the floor"),
    ],
    location: "KSPO Dome, Seoul",
  },
  {
    id: id<PostId>("p-minji-1"),
    authorId: MINJI,
    kind: "completion",
    createdAt: "2025-02-18" as IsoDate,
    body: "Finally completed SWITCH. The blush foil was the last one. I can sleep now.",
    templateIds: ["set-switch-pc-6", "set-switch-pc-5", "set-switch-pc-1"].map(id<TemplateId>),
  },
  {
    id: id<PostId>("p-minji-seoul"),
    authorId: MINJI,
    kind: "travel",
    createdAt: "2025-02-16" as IsoDate,
    body: "Seoul trip was actually unreal. Walking home at 1am like this.",
    templateIds: [],
    media: [photo("/posts/minji-seoul.png", "Seoul street at night")],
    location: "Hongdae, Seoul",
  },
  {
    id: id<PostId>("p-minji-2"),
    authorId: MINJI,
    kind: "haul",
    createdAt: "2025-02-11" as IsoDate,
    body: "Got this album today. The photocard pull was insane.",
    templateIds: ["set-ate-pc-12"].map(id<TemplateId>),
    media: [photo("/posts/minji-unbox.png", "Album unboxing on a pink desk")],
  },
  {
    id: id<PostId>("p-soo-concert"),
    authorId: SOO,
    kind: "concert",
    createdAt: "2025-02-08" as IsoDate,
    body: "Went last night. I still hear the opening.",
    templateIds: [],
    media: [photo("/posts/soo-concert.png", "Concert floor, red lights")],
    location: "Chicago",
  },
  {
    id: id<PostId>("p-soo-1"),
    authorId: SOO,
    kind: "hunt",
    createdAt: "2025-02-04" as IsoDate,
    body: "ATE is 11 of 12. The last card is Hyunjin gold foil. I have looked at the empty sleeve every night this week.",
    templateIds: ["set-ate-pc-12"].map(id<TemplateId>),
  },
  {
    id: id<PostId>("p-minji-3"),
    authorId: MINJI,
    kind: "room",
    createdAt: "2025-01-28" as IsoDate,
    body: "Redesigned my room today. The window light hits the SWITCH spines at four.",
    templateIds: ["t-v-switch-b", "t-poster-wonyoung"].map(id<TemplateId>),
  },
  {
    id: id<PostId>("p-minji-friends"),
    authorId: MINJI,
    kind: "event",
    createdAt: "2025-01-24" as IsoDate,
    body: "Met up with other DIVEs at the convention. My people.",
    templateIds: [],
    media: [photo("/posts/minji-friends.png", "Friends at a K-pop convention")],
    location: "KCON",
    taggedUserIds: [SOO],
  },
  {
    id: id<PostId>("p-soo-2"),
    authorId: SOO,
    kind: "room",
    createdAt: "2025-01-22" as IsoDate,
    body: "Reshelved under the lamp. The vinyl belongs at the end of the row.",
    templateIds: ["t-v-ate-vinyl"].map(id<TemplateId>),
    media: [photo("/posts/soo-unbox.png", "Vinyl on a desk under a lamp")],
  },
  {
    id: id<PostId>("p-minji-5"),
    authorId: MINJI,
    kind: "hunt",
    createdAt: "2025-01-15" as IsoDate,
    body: "Looking for this version. Venus POB. If you have it I will trade almost anything.",
    templateIds: ["set-lovedive-pc-4"].map(id<TemplateId>),
  },
  {
    id: id<PostId>("p-minji-4"),
    authorId: MINJI,
    kind: "note",
    createdAt: "2025-01-08" as IsoDate,
    body: "My favorite IVE era is still Love Dive. Everything after is beautiful. That one is home.",
    templateIds: ["set-lovedive-pc-1", "t-v-dive-a"].map(id<TemplateId>),
  },
  {
    id: id<PostId>("p-soo-3"),
    authorId: SOO,
    kind: "note",
    createdAt: "2025-01-04" as IsoDate,
    body: "This is the card I keep taking out of the sleeve just to look at. Hyunjin, Mirror pose. I know.",
    templateIds: ["set-ate-pc-4"].map(id<TemplateId>),
  },
];

/** Photos the viewer can pick when creating a post. */
export const CAMERA_ROLL: PostMedia[] = [
  photo("/posts/soo-concert.png", "Concert"),
  photo("/posts/soo-unbox.png", "Desk"),
  photo("/posts/minji-seoul.png", "Night"),
  photo("/posts/minji-friends.png", "Friends"),
];

export const POST_LIKES: PostLike[] = [
  { postId: id<PostId>("p-minji-concert"), userId: SOO },
  { postId: id<PostId>("p-minji-1"), userId: SOO },
  { postId: id<PostId>("p-minji-seoul"), userId: SOO },
  { postId: id<PostId>("p-minji-2"), userId: SOO },
  { postId: id<PostId>("p-soo-concert"), userId: MINJI },
  { postId: id<PostId>("p-soo-1"), userId: MINJI },
];

export const POST_COMMENTS: PostComment[] = [
  {
    id: id<CommentId>("c-concert"),
    postId: id<PostId>("p-minji-concert"),
    authorId: SOO,
    body: "I felt that from here.",
    createdAt: "2025-03-02" as IsoDate,
  },
  {
    id: id<CommentId>("c-1"),
    postId: id<PostId>("p-minji-1"),
    authorId: SOO,
    body: "The blush foil was the one. Congratulations. I'm still at 11.",
    createdAt: "2025-02-18" as IsoDate,
  },
  {
    id: id<CommentId>("c-2"),
    postId: id<PostId>("p-soo-1"),
    authorId: MINJI,
    body: "I might have something for you.",
    createdAt: "2025-02-05" as IsoDate,
  },
];

export const NOTICES: Notice[] = [
  {
    id: id<NoticeId>("n-1"),
    recipientId: SOO,
    kind: "like",
    actorId: MINJI,
    createdAt: "2025-02-05" as IsoDate,
    headline: "liked your concert post",
    postId: id<PostId>("p-soo-concert"),
  },
  {
    id: id<NoticeId>("n-2"),
    recipientId: SOO,
    kind: "comment",
    actorId: MINJI,
    createdAt: "2025-02-05" as IsoDate,
    headline: "commented on your post",
    postId: id<PostId>("p-soo-1"),
  },
  {
    id: id<NoticeId>("n-3"),
    recipientId: SOO,
    kind: "follow",
    actorId: MINJI,
    createdAt: "2024-11-02" as IsoDate,
    headline: "started following you",
  },
  {
    id: id<NoticeId>("n-4"),
    recipientId: SOO,
    kind: "trade",
    actorId: MINJI,
    createdAt: "2025-02-11" as IsoDate,
    headline: "owns something on your wishlist",
    templateIds: ["set-ate-pc-12"].map(id<TemplateId>),
  },
  {
    id: id<NoticeId>("n-5"),
    recipientId: SOO,
    kind: "activity",
    actorId: MINJI,
    createdAt: "2025-02-18" as IsoDate,
    headline: "completed the IVE SWITCH photocard set",
    templateIds: ["set-switch-pc-6"].map(id<TemplateId>),
  },
];

export const THREAD_SOO_MINJI = id<ThreadId>("th-soo-minji");

export const THREADS: Thread[] = [
  {
    id: THREAD_SOO_MINJI,
    participantIds: [SOO, MINJI],
  },
];

export const MESSAGES: Message[] = [
  {
    id: id<MessageId>("m-1"),
    threadId: THREAD_SOO_MINJI,
    senderId: SOO,
    createdAt: "2025-02-12T21:04:00" as IsoDate,
    body: "Wait. You have the Hyunjin gold foil?",
    templateIds: ["set-ate-pc-12"].map(id<TemplateId>),
  },
  {
    id: id<MessageId>("m-2"),
    threadId: THREAD_SOO_MINJI,
    senderId: MINJI,
    createdAt: "2025-02-12T21:18:00" as IsoDate,
    body: "Open to offers if you still have Venus. I've been looking for a year.",
    templateIds: ["set-lovedive-pc-4"].map(id<TemplateId>),
  },
  {
    id: id<MessageId>("m-3"),
    threadId: THREAD_SOO_MINJI,
    senderId: SOO,
    createdAt: "2025-02-13T11:42:00" as IsoDate,
    body: "I have it. For trade. This app already knew before I did.",
    templateIds: ["set-lovedive-pc-4", "set-ate-pc-12"].map(id<TemplateId>),
  },
];
