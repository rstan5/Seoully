import type {
  CollectibleKind,
  CollectibleSet,
  CollectibleTemplate,
  Era,
  EraId,
  Group,
  GroupId,
  MaterialName,
  Member,
  MemberId,
  Rarity,
  Release,
  ReleaseId,
  ReleaseVersion,
  ReleaseVersionId,
  TemplateId,
} from "../types";

/**
 * Catalog fixtures — the canonical, shared facts about the world.
 *
 * Group, member, and era names are real because collectors navigate by them
 * and fake ones would make the prototype feel like a toy. All *artwork* is
 * generated procedurally from the colorways below, so nothing here depends on
 * licensed imagery.
 */

const id = <T extends string>(value: string): T => value as T;

// ---------------------------------------------------------------------------
// Groups & members
// ---------------------------------------------------------------------------

export const GROUPS: Group[] = [
  {
    id: id<GroupId>("skz"),
    name: "Stray Kids",
    nativeName: "스트레이 키즈",
    debutYear: 2018,
    memberIds: ["skz-chan", "skz-lee", "skz-changbin", "skz-hyunjin", "skz-han", "skz-felix", "skz-seungmin", "skz-in"].map(
      id<MemberId>,
    ),
    palette: { primary: "#c1121f", secondary: "#14121b", accent: "#ff4d5e" },
  },
  {
    id: id<GroupId>("ive"),
    name: "IVE",
    nativeName: "아이브",
    debutYear: 2021,
    memberIds: ["ive-gaeul", "ive-yujin", "ive-rei", "ive-wonyoung", "ive-liz", "ive-leeseo"].map(id<MemberId>),
    palette: { primary: "#e8567f", secondary: "#fbe3ec", accent: "#ff8fb1" },
  },
  {
    id: id<GroupId>("aespa"),
    name: "aespa",
    nativeName: "에스파",
    debutYear: 2020,
    memberIds: ["aespa-karina", "aespa-giselle", "aespa-winter", "aespa-ningning"].map(id<MemberId>),
    palette: { primary: "#0fd6c4", secondary: "#0b0d12", accent: "#6ef0e4" },
  },
  {
    id: id<GroupId>("nwjns"),
    name: "NewJeans",
    nativeName: "뉴진스",
    debutYear: 2022,
    memberIds: ["nj-minji", "nj-hanni", "nj-danielle", "nj-haerin", "nj-hyein"].map(id<MemberId>),
    palette: { primary: "#5b8fd6", secondary: "#f3ecdd", accent: "#9dc2f0" },
  },
];

function member(
  memberId: string,
  groupId: string,
  stageName: string,
  nativeName: string,
  color: string,
  birthYear: number,
): Member {
  return {
    id: id<MemberId>(memberId),
    groupId: id<GroupId>(groupId),
    stageName,
    nativeName,
    color,
    birthYear,
  };
}

export const MEMBERS: Member[] = [
  member("skz-chan", "skz", "Bang Chan", "방찬", "#d9a441", 1997),
  member("skz-lee", "skz", "Lee Know", "리노", "#7fc4a8", 1998),
  member("skz-changbin", "skz", "Changbin", "창빈", "#4a4e8f", 1999),
  member("skz-hyunjin", "skz", "Hyunjin", "현진", "#c1121f", 2000),
  member("skz-han", "skz", "Han", "한", "#e0663f", 2000),
  member("skz-felix", "skz", "Felix", "필릭스", "#e8c46a", 2000),
  member("skz-seungmin", "skz", "Seungmin", "승민", "#6a9fd8", 2000),
  member("skz-in", "skz", "I.N", "아이엔", "#b96ec4", 2001),

  member("ive-gaeul", "ive", "Gaeul", "가을", "#b06a4a", 2002),
  member("ive-yujin", "ive", "Yujin", "유진", "#e8567f", 2003),
  member("ive-rei", "ive", "Rei", "레이", "#e0a3c4", 2004),
  member("ive-wonyoung", "ive", "Wonyoung", "원영", "#ff8fb1", 2004),
  member("ive-liz", "ive", "Liz", "리즈", "#f0c9d8", 2004),
  member("ive-leeseo", "ive", "Leeseo", "이서", "#f4a7bb", 2007),

  member("aespa-karina", "aespa", "Karina", "카리나", "#0fd6c4", 2000),
  member("aespa-giselle", "aespa", "Giselle", "지젤", "#a86ee0", 2000),
  member("aespa-winter", "aespa", "Winter", "윈터", "#6ecff0", 2001),
  member("aespa-ningning", "aespa", "Ningning", "닝닝", "#f06e9c", 2002),

  member("nj-minji", "nwjns", "Minji", "민지", "#5b8fd6", 2004),
  member("nj-hanni", "nwjns", "Hanni", "하니", "#e8b04a", 2004),
  member("nj-danielle", "nwjns", "Danielle", "다니엘", "#7fc9a0", 2005),
  member("nj-haerin", "nwjns", "Haerin", "해린", "#9dc2f0", 2006),
  member("nj-hyein", "nwjns", "Hyein", "혜인", "#f0a0b8", 2008),
];

// ---------------------------------------------------------------------------
// Eras — the unit collectors actually think and talk in
// ---------------------------------------------------------------------------

function era(eraId: string, groupId: string, name: string, year: number, mood: string, color: string): Era {
  return { id: id<EraId>(eraId), groupId: id<GroupId>(groupId), name, year, mood, color };
}

export const ERAS: Era[] = [
  era("skz-ate", "skz", "ATE", 2024, "gold, brash, victorious", "#d9a441"),
  era("skz-rockstar", "skz", "樂-STAR", 2023, "crimson, riotous, loud", "#c1121f"),
  era("skz-maxident", "skz", "MAXIDENT", 2022, "pink shock, chaotic romance", "#e0517f"),
  era("skz-oddinary", "skz", "ODDINARY", 2022, "monochrome, unhinged", "#3a3547"),

  era("ive-switch", "ive", "IVE SWITCH", 2024, "sunlit, candy, kinetic", "#ff8fb1"),
  era("ive-mine", "ive", "I'VE MINE", 2023, "burgundy, poised, adult", "#8c2f4a"),
  era("ive-afterlike", "ive", "After LIKE", 2022, "orange disco, brass", "#e8853f"),
  era("ive-lovedive", "ive", "LOVE DIVE", 2022, "cool blue, marble, mythic", "#5b7fd6"),

  era("aespa-armageddon", "aespa", "Armageddon", 2024, "chrome, aggressive, synthetic", "#0fd6c4"),
  era("nwjns-getup", "nwjns", "Get Up", 2023, "washed denim, summer, analog", "#9dc2f0"),
];

// ---------------------------------------------------------------------------
// Releases & versions
// ---------------------------------------------------------------------------

interface ReleaseSeed {
  rid: string;
  groupId: string;
  eraId: string;
  title: string;
  format: Release["format"];
  releasedAt: string;
  trackCount: number;
  versions: Array<{
    vid: string;
    name: string;
    spineColor: string;
    coverColor: string;
    coverAccent: string;
    thicknessMm: number;
  }>;
}

const RELEASE_SEEDS: ReleaseSeed[] = [
  {
    rid: "r-skz-ate",
    groupId: "skz",
    eraId: "skz-ate",
    title: "ATE",
    format: "album",
    releasedAt: "2024-07-19",
    trackCount: 8,
    versions: [
      { vid: "v-ate-a", name: "Limited Ver.", spineColor: "#1a1720", coverColor: "#0f0d14", coverAccent: "#d9a441", thicknessMm: 22 },
      { vid: "v-ate-b", name: "Standard Ver.", spineColor: "#d9a441", coverColor: "#c9922f", coverAccent: "#1a1720", thicknessMm: 16 },
    ],
  },
  {
    rid: "r-skz-rockstar",
    groupId: "skz",
    eraId: "skz-rockstar",
    title: "樂-STAR",
    format: "album",
    releasedAt: "2023-11-10",
    trackCount: 6,
    versions: [
      { vid: "v-rock-a", name: "ROCK Ver.", spineColor: "#c1121f", coverColor: "#a10e19", coverAccent: "#f4efe4", thicknessMm: 19 },
      { vid: "v-rock-b", name: "STAR Ver.", spineColor: "#2b0508", coverColor: "#160407", coverAccent: "#ff4d5e", thicknessMm: 19 },
    ],
  },
  {
    rid: "r-skz-maxident",
    groupId: "skz",
    eraId: "skz-maxident",
    title: "MAXIDENT",
    format: "album",
    releasedAt: "2022-10-07",
    trackCount: 8,
    versions: [
      { vid: "v-max-a", name: "HEART Ver.", spineColor: "#e0517f", coverColor: "#d0416f", coverAccent: "#fbe3ec", thicknessMm: 20 },
    ],
  },
  {
    rid: "r-skz-oddinary",
    groupId: "skz",
    eraId: "skz-oddinary",
    title: "ODDINARY",
    format: "album",
    releasedAt: "2022-03-18",
    trackCount: 7,
    versions: [
      { vid: "v-odd-a", name: "MASK OFF Ver.", spineColor: "#3a3547", coverColor: "#221f2c", coverAccent: "#8f8a7e", thicknessMm: 18 },
    ],
  },
  {
    rid: "r-skz-ate-vinyl",
    groupId: "skz",
    eraId: "skz-ate",
    title: "ATE",
    format: "vinyl",
    releasedAt: "2024-09-02",
    trackCount: 8,
    versions: [
      { vid: "v-ate-vinyl", name: "Gold Pressing", spineColor: "#d9a441", coverColor: "#141119", coverAccent: "#d9a441", thicknessMm: 6 },
    ],
  },
  {
    rid: "r-ive-switch",
    groupId: "ive",
    eraId: "ive-switch",
    title: "IVE SWITCH",
    format: "ep",
    releasedAt: "2024-04-29",
    trackCount: 6,
    versions: [
      { vid: "v-switch-a", name: "Ivory Ver.", spineColor: "#f4efe4", coverColor: "#efe6d6", coverAccent: "#ff8fb1", thicknessMm: 15 },
      { vid: "v-switch-b", name: "Blush Ver.", spineColor: "#ff8fb1", coverColor: "#f4a7bb", coverAccent: "#8c2f4a", thicknessMm: 15 },
    ],
  },
  {
    rid: "r-ive-mine",
    groupId: "ive",
    eraId: "ive-mine",
    title: "I'VE MINE",
    format: "ep",
    releasedAt: "2023-10-13",
    trackCount: 6,
    versions: [
      { vid: "v-mine-a", name: "Wave Ver.", spineColor: "#8c2f4a", coverColor: "#6f2039", coverAccent: "#e0a3c4", thicknessMm: 17 },
    ],
  },
  {
    rid: "r-ive-lovedive",
    groupId: "ive",
    eraId: "ive-lovedive",
    title: "LOVE DIVE",
    format: "single",
    releasedAt: "2022-04-05",
    trackCount: 3,
    versions: [
      { vid: "v-dive-a", name: "Dive Ver.", spineColor: "#5b7fd6", coverColor: "#4262b0", coverAccent: "#f0f4ff", thicknessMm: 12 },
    ],
  },
  {
    rid: "r-ive-afterlike",
    groupId: "ive",
    eraId: "ive-afterlike",
    title: "After LIKE",
    format: "single",
    releasedAt: "2022-08-22",
    trackCount: 3,
    versions: [
      { vid: "v-after-a", name: "Disco Ver.", spineColor: "#e8853f", coverColor: "#d4702c", coverAccent: "#fbe3ec", thicknessMm: 12 },
    ],
  },
  {
    rid: "r-aespa-armageddon",
    groupId: "aespa",
    eraId: "aespa-armageddon",
    title: "Armageddon",
    format: "album",
    releasedAt: "2024-05-27",
    trackCount: 10,
    versions: [
      { vid: "v-arma-a", name: "Chrome Ver.", spineColor: "#0fd6c4", coverColor: "#0b0d12", coverAccent: "#6ef0e4", thicknessMm: 21 },
    ],
  },
  {
    rid: "r-nwjns-getup",
    groupId: "nwjns",
    eraId: "nwjns-getup",
    title: "Get Up",
    format: "ep",
    releasedAt: "2023-07-21",
    trackCount: 6,
    versions: [
      { vid: "v-getup-a", name: "Bunny Beach Bag", spineColor: "#9dc2f0", coverColor: "#f3ecdd", coverAccent: "#5b8fd6", thicknessMm: 14 },
    ],
  },
];

export const RELEASES: Release[] = RELEASE_SEEDS.map((seed) => ({
  id: id<ReleaseId>(seed.rid),
  groupId: id<GroupId>(seed.groupId),
  eraId: id<EraId>(seed.eraId),
  title: seed.title,
  format: seed.format,
  releasedAt: seed.releasedAt,
  trackCount: seed.trackCount,
  versionIds: seed.versions.map((v) => id<ReleaseVersionId>(v.vid)),
}));

export const RELEASE_VERSIONS: ReleaseVersion[] = RELEASE_SEEDS.flatMap((seed) =>
  seed.versions.map((v) => ({
    id: id<ReleaseVersionId>(v.vid),
    releaseId: id<ReleaseId>(seed.rid),
    name: v.name,
    spineColor: v.spineColor,
    coverColor: v.coverColor,
    coverAccent: v.coverAccent,
    thicknessMm: v.thicknessMm,
  })),
);

// ---------------------------------------------------------------------------
// Collectible templates
// ---------------------------------------------------------------------------

const TEMPLATES: CollectibleTemplate[] = [];

function template(input: {
  tid: string;
  kind: CollectibleKind;
  name: string;
  groupId: string;
  memberId?: string;
  eraId?: string;
  releaseId?: string;
  releaseVersionId?: string;
  rarity?: Rarity;
  setIndex?: number;
  setSize?: number;
  material: MaterialName;
  base: string;
  accent: string;
  ink: string;
}): CollectibleTemplate {
  const created: CollectibleTemplate = {
    id: id<TemplateId>(input.tid),
    kind: input.kind,
    name: input.name,
    groupId: id<GroupId>(input.groupId),
    rarity: input.rarity ?? "common",
    material: input.material,
    colorway: { base: input.base, accent: input.accent, ink: input.ink },
  };
  if (input.memberId) created.memberId = id<MemberId>(input.memberId);
  if (input.eraId) created.eraId = id<EraId>(input.eraId);
  if (input.releaseId) created.releaseId = id<ReleaseId>(input.releaseId);
  if (input.releaseVersionId) created.releaseVersionId = id<ReleaseVersionId>(input.releaseVersionId);
  if (input.setIndex !== undefined) created.setIndex = input.setIndex;
  if (input.setSize !== undefined) created.setSize = input.setSize;
  TEMPLATES.push(created);
  return created;
}

/** Album templates derive directly from release versions. */
for (const seed of RELEASE_SEEDS) {
  const group = GROUPS.find((g) => g.id === seed.groupId)!;
  for (const v of seed.versions) {
    template({
      tid: `t-${v.vid}`,
      kind: seed.format === "vinyl" ? "vinyl" : "album",
      name: `${seed.title} — ${v.name}`,
      groupId: seed.groupId,
      eraId: seed.eraId,
      releaseId: seed.rid,
      releaseVersionId: v.vid,
      rarity: seed.format === "vinyl" ? "rare" : "common",
      material: seed.format === "vinyl" ? "vinyl" : "paper",
      base: v.coverColor,
      accent: v.coverAccent,
      ink: group.palette.secondary,
    });
  }
}

/**
 * A numbered photocard set. These are the objects the completion loop is built
 * around, so they get real per-card variation: the member, the pose name, and
 * an escalating rarity toward the chase card.
 */
function photocardSet(input: {
  setId: string;
  setName: string;
  groupId: string;
  eraId: string;
  releaseId: string;
  members: Array<{ memberId: string; pose: string }>;
  base: string;
  ink: string;
  /** Index (1-based) of the hard-to-find chase card in the set. */
  chaseIndex?: number;
}): CollectibleSet {
  const templateIds: TemplateId[] = [];
  const setSize = input.members.length;

  input.members.forEach((entry, i) => {
    const index = i + 1;
    const memberRecord = MEMBERS.find((m) => m.id === entry.memberId)!;
    const isChase = index === input.chaseIndex;
    const rarity: Rarity = isChase ? "grail" : index % 4 === 0 ? "rare" : "common";
    const created = template({
      tid: `${input.setId}-pc-${index}`,
      kind: "photocard",
      name: `${memberRecord.stageName} — ${entry.pose}`,
      groupId: input.groupId,
      memberId: entry.memberId,
      eraId: input.eraId,
      releaseId: input.releaseId,
      rarity,
      setIndex: index,
      setSize,
      material: isChase || rarity === "rare" ? "holo-foil" : "glossy-card",
      base: input.base,
      accent: memberRecord.color,
      ink: input.ink,
    });
    templateIds.push(created.id);
  });

  return {
    id: input.setId,
    name: input.setName,
    groupId: id<GroupId>(input.groupId),
    eraId: id<EraId>(input.eraId),
    templateIds,
  };
}

export const SETS: CollectibleSet[] = [
  /**
   * The hero set. The primary collector sits at 11/12 on this one, and card 12
   * is the object that drives the flagship flight-and-completion sequence.
   */
  photocardSet({
    setId: "set-ate",
    setName: "ATE — Photocard Set",
    groupId: "skz",
    eraId: "skz-ate",
    releaseId: "r-skz-ate",
    base: "#17141d",
    ink: "#d9a441",
    chaseIndex: 12,
    members: [
      { memberId: "skz-chan", pose: "Gold Suit" },
      { memberId: "skz-lee", pose: "Backstage" },
      { memberId: "skz-changbin", pose: "Chain" },
      { memberId: "skz-hyunjin", pose: "Mirror" },
      { memberId: "skz-han", pose: "Neon" },
      { memberId: "skz-felix", pose: "Velvet" },
      { memberId: "skz-seungmin", pose: "Window Light" },
      { memberId: "skz-in", pose: "Static" },
      { memberId: "skz-chan", pose: "Rooftop" },
      { memberId: "skz-felix", pose: "Close Crop" },
      { memberId: "skz-han", pose: "Motion Blur" },
      { memberId: "skz-hyunjin", pose: "Gold Foil" },
    ],
  }),

  photocardSet({
    setId: "set-rockstar",
    setName: "樂-STAR — Photocard Set",
    groupId: "skz",
    eraId: "skz-rockstar",
    releaseId: "r-skz-rockstar",
    base: "#2b0508",
    ink: "#ff4d5e",
    chaseIndex: 8,
    members: [
      { memberId: "skz-hyunjin", pose: "Red Room" },
      { memberId: "skz-felix", pose: "Amp" },
      { memberId: "skz-chan", pose: "Stage Left" },
      { memberId: "skz-han", pose: "Feedback" },
      { memberId: "skz-lee", pose: "Silhouette" },
      { memberId: "skz-changbin", pose: "Blackout" },
      { memberId: "skz-seungmin", pose: "Encore" },
      { memberId: "skz-in", pose: "Crimson Foil" },
    ],
  }),

  photocardSet({
    setId: "set-switch",
    setName: "IVE SWITCH — Photocard Set",
    groupId: "ive",
    eraId: "ive-switch",
    releaseId: "r-ive-switch",
    base: "#f7ecec",
    ink: "#8c2f4a",
    chaseIndex: 6,
    members: [
      { memberId: "ive-gaeul", pose: "Sunroom" },
      { memberId: "ive-yujin", pose: "Citrus" },
      { memberId: "ive-rei", pose: "Polaroid" },
      { memberId: "ive-liz", pose: "Ribbon" },
      { memberId: "ive-leeseo", pose: "Bicycle" },
      { memberId: "ive-wonyoung", pose: "Blush Foil" },
    ],
  }),

  photocardSet({
    setId: "set-lovedive",
    setName: "LOVE DIVE — Photocard Set",
    groupId: "ive",
    eraId: "ive-lovedive",
    releaseId: "r-ive-lovedive",
    base: "#e9edf7",
    ink: "#2a3a63",
    chaseIndex: 4,
    members: [
      { memberId: "ive-yujin", pose: "Marble" },
      { memberId: "ive-rei", pose: "Statue" },
      { memberId: "ive-liz", pose: "Water" },
      { memberId: "ive-wonyoung", pose: "Venus POB" },
    ],
  }),
];

// ---------------------------------------------------------------------------
// One-off objects: posters, lightsticks, plushies, figures, memorabilia
// ---------------------------------------------------------------------------

template({ tid: "t-poster-ate", kind: "poster", name: "ATE Tour Poster", groupId: "skz", eraId: "skz-ate", rarity: "uncommon", material: "photo-print", base: "#171320", accent: "#d9a441", ink: "#f4efe4" });
template({ tid: "t-poster-rockstar", kind: "poster", name: "樂-STAR Promo Print", groupId: "skz", eraId: "skz-rockstar", material: "photo-print", base: "#2b0508", accent: "#c1121f", ink: "#f4efe4" });
template({ tid: "t-poster-hyunjin", kind: "poster", name: "Hyunjin — Signed Print", groupId: "skz", memberId: "skz-hyunjin", eraId: "skz-rockstar", rarity: "grail", material: "photo-print", base: "#1d1a24", accent: "#c1121f", ink: "#f4efe4" });
template({ tid: "t-poster-switch", kind: "poster", name: "IVE SWITCH Billboard Cut", groupId: "ive", eraId: "ive-switch", material: "photo-print", base: "#fbe3ec", accent: "#ff8fb1", ink: "#8c2f4a" });
template({ tid: "t-poster-wonyoung", kind: "poster", name: "Wonyoung — Magazine Spread", groupId: "ive", memberId: "ive-wonyoung", eraId: "ive-mine", rarity: "uncommon", material: "photo-print", base: "#f7dfe8", accent: "#e8567f", ink: "#8c2f4a" });
template({ tid: "t-poster-armageddon", kind: "poster", name: "Armageddon Chrome Print", groupId: "aespa", eraId: "aespa-armageddon", material: "photo-print", base: "#0b0d12", accent: "#0fd6c4", ink: "#e8f8f6" });

template({ tid: "t-ls-skz", kind: "lightstick", name: "Nachimbong ver. 2", groupId: "skz", rarity: "uncommon", material: "acrylic", base: "#1a1720", accent: "#c1121f", ink: "#f4efe4" });
template({ tid: "t-ls-ive", kind: "lightstick", name: "IVE Official Light Ring", groupId: "ive", rarity: "uncommon", material: "acrylic", base: "#fbe3ec", accent: "#ff8fb1", ink: "#8c2f4a" });

template({ tid: "t-plush-skzoo-jiniret", kind: "plushie", name: "SKZOO — Jiniret", groupId: "skz", memberId: "skz-hyunjin", material: "plush", base: "#e8dfd2", accent: "#c1121f", ink: "#1a1720" });
template({ tid: "t-plush-skzoo-bbokari", kind: "plushie", name: "SKZOO — BbokAri", groupId: "skz", memberId: "skz-felix", material: "plush", base: "#e8c46a", accent: "#d9a441", ink: "#1a1720" });
template({ tid: "t-plush-ive-minive", kind: "plushie", name: "MINIVE — Wonyoung", groupId: "ive", memberId: "ive-wonyoung", material: "plush", base: "#f7c9d8", accent: "#ff8fb1", ink: "#8c2f4a" });
template({ tid: "t-plush-ive-rei", kind: "plushie", name: "MINIVE — Rei", groupId: "ive", memberId: "ive-rei", material: "plush", base: "#e0a3c4", accent: "#e8567f", ink: "#8c2f4a" });

template({ tid: "t-figure-hyunjin", kind: "figure", name: "Hyunjin — Artist Figure", groupId: "skz", memberId: "skz-hyunjin", rarity: "rare", material: "acrylic", base: "#221f2c", accent: "#c1121f", ink: "#f4efe4" });
template({ tid: "t-figure-wonyoung", kind: "figure", name: "Wonyoung — Resin Figure", groupId: "ive", memberId: "ive-wonyoung", rarity: "rare", material: "acrylic", base: "#fbe3ec", accent: "#e8567f", ink: "#8c2f4a" });

template({ tid: "t-book-skz-photobook", kind: "book", name: "SKZ 5-STAR Photobook", groupId: "skz", eraId: "skz-rockstar", material: "paper", base: "#3a1218", accent: "#c1121f", ink: "#f4efe4" });
template({ tid: "t-book-ive-photobook", kind: "book", name: "IVE — I'VE MINE Photobook", groupId: "ive", eraId: "ive-mine", material: "paper", base: "#8c2f4a", accent: "#e0a3c4", ink: "#fbe3ec" });

template({ tid: "t-mem-ate-ticket", kind: "memorabilia", name: "dominATE Seoul — Ticket Stub", groupId: "skz", eraId: "skz-ate", rarity: "uncommon", material: "paper", base: "#efe6d6", accent: "#d9a441", ink: "#1a1720" });
template({ tid: "t-mem-ate-band", kind: "memorabilia", name: "dominATE — Entry Wristband", groupId: "skz", eraId: "skz-ate", material: "velvet", base: "#4a1e33", accent: "#c1121f", ink: "#f4efe4" });
template({ tid: "t-mem-fanclub", kind: "memorabilia", name: "STAY Membership Kit", groupId: "skz", rarity: "rare", material: "brushed-metal", base: "#8d8f96", accent: "#c1121f", ink: "#1a1720" });
template({ tid: "t-mem-ive-ticket", kind: "memorabilia", name: "SHOW WHAT I HAVE — Ticket", groupId: "ive", eraId: "ive-mine", material: "paper", base: "#f7dfe8", accent: "#e8567f", ink: "#8c2f4a" });
template({ tid: "t-mem-ive-fanclub", kind: "memorabilia", name: "DIVE Membership Kit", groupId: "ive", rarity: "rare", material: "brushed-metal", base: "#e8c9d4", accent: "#e8567f", ink: "#8c2f4a" });

template({ tid: "t-apparel-skz-tour", kind: "apparel", name: "dominATE Tour Tee", groupId: "skz", eraId: "skz-ate", material: "velvet", base: "#1a1720", accent: "#d9a441", ink: "#f4efe4" });
template({ tid: "t-apparel-ive-hoodie", kind: "apparel", name: "IVE SWITCH Hoodie", groupId: "ive", eraId: "ive-switch", material: "velvet", base: "#f4a7bb", accent: "#8c2f4a", ink: "#fbe3ec" });

export const COLLECTIBLE_TEMPLATES: CollectibleTemplate[] = TEMPLATES;

// ---------------------------------------------------------------------------
// Lookup indices
// ---------------------------------------------------------------------------

export const GROUP_BY_ID = new Map(GROUPS.map((g) => [g.id as string, g]));
export const MEMBER_BY_ID = new Map(MEMBERS.map((m) => [m.id as string, m]));
export const ERA_BY_ID = new Map(ERAS.map((e) => [e.id as string, e]));
export const RELEASE_BY_ID = new Map(RELEASES.map((r) => [r.id as string, r]));
export const VERSION_BY_ID = new Map(RELEASE_VERSIONS.map((v) => [v.id as string, v]));
export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((t) => [t.id as string, t]));
export const SET_BY_ID = new Map(SETS.map((s) => [s.id, s]));
