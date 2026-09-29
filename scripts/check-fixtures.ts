/**
 * Fixture sanity check. Verifies that every placement resolves, every set
 * progress reads the way the demo narrative assumes, and that compatibility
 * lands somewhere meaningful. Run with `npm run check:fixtures`.
 */
import { computeCompatibility, describeMatch, type CompatibilityInput } from "../src/domain/compatibility";
import { GROUP_BY_ID, MEMBER_BY_ID, ERA_BY_ID, TEMPLATE_BY_ID } from "../src/domain/fixtures/catalog";
import { HOLDINGS_FIXTURE, MINJI, PROFILES, ROOMS, SOO, USERS, WISHLIST } from "../src/domain/fixtures/collectors";
import { NOTICES, POSTS } from "../src/domain/fixtures/social";
import { MemoryCollectionRepository } from "../src/domain/memory-repository";
import { runAssistantTools } from "../src/domain/assistant-tools";
import { resolveDigitalRepresentation } from "../src/domain/representation";

const repo = new MemoryCollectionRepository();
let failures = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    console.log(`  ok    ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function inputFor(userId: typeof SOO | typeof MINJI): CompatibilityInput {
  const profile = PROFILES.find((item) => item.userId === userId)!;
  return {
    userId,
    holdings: HOLDINGS_FIXTURE.filter((holding) => holding.ownerId === userId),
    wishlist: WISHLIST.filter((item) => item.userId === userId),
    favoriteGroupIds: profile.favoriteGroupIds,
    biasMemberIds: profile.biasMemberIds,
    favoriteEraIds: profile.favoriteEraIds,
    collectorInterests: profile.collectorInterests,
  };
}

console.log("\nCATALOG INTEGRITY");
for (const room of ROOMS) {
  for (const placement of repo.listPlacements(room.id)) {
    const view = repo.getHoldingView(placement.holdingId);
    if (!view) {
      failures += 1;
      console.log(`  FAIL  unresolvable holding ${placement.holdingId}`);
    }
    const zoneExists = room.zones.some((z) => z.id === placement.zoneId);
    if (!zoneExists) {
      failures += 1;
      console.log(`  FAIL  placement points at missing zone ${placement.zoneId}`);
    }
  }
}
check("every placement resolves to a holding and a zone", failures === 0);

console.log("\nSOOMIN");
const sooStats = repo.getStats(SOO);
console.log(`  ${sooStats.totalItems} items · ${sooStats.photocards} photocards · ${sooStats.albums} albums · ${sooStats.grails} grails`);
const ate = repo.getSetProgress(SOO, "set-ate");
check("ATE set is at 11/12", ate?.owned === 11 && ate.total === 12, `${ate?.owned}/${ate?.total}`);
check(
  "the missing ATE card is the chase card",
  ate?.missingTemplateIds[0] === "set-ate-pc-12",
  ate?.missingTemplateIds.map((t) => TEMPLATE_BY_ID.get(t)?.name).join(", "),
);
const rockstar = repo.getSetProgress(SOO, "set-rockstar");
check("樂-STAR set is already complete", rockstar?.complete === true, `${rockstar?.owned}/${rockstar?.total}`);

console.log("\nMINJI");
const minjiStats = repo.getStats(MINJI);
console.log(`  ${minjiStats.totalItems} items · ${minjiStats.photocards} photocards · ${minjiStats.albums} albums · ${minjiStats.grails} grails`);
const switchSet = repo.getSetProgress(MINJI, "set-switch");
check("IVE SWITCH set is complete", switchSet?.complete === true, `${switchSet?.owned}/${switchSet?.total}`);
check(
  "Minji owns the card Soo is hunting",
  repo.listHoldings(MINJI).some((h) => h.templateId === "set-ate-pc-12"),
);

console.log("\nCOMPATIBILITY");
const compat = repo.getCompatibility(SOO, MINJI);
console.log(`  score: ${compat.score}%`);
for (const reason of compat.reasons) console.log(`    · ${reason}`);
check("score is high enough to be socially interesting", compat.score >= 45, `${compat.score}%`);
check("score is not implausibly perfect", compat.score <= 95, `${compat.score}%`);
check("there is a two-way trade opportunity", compat.theyOwnYourWants.length > 0 && compat.youOwnTheirWants.length > 0);

console.log("\nCANONICAL DOMAIN INTEGRITY");
const directA = computeCompatibility(inputFor(SOO), inputFor(MINJI), {
  template: (id) => TEMPLATE_BY_ID.get(id),
  groupName: (id) => GROUP_BY_ID.get(id)?.name ?? id,
  memberName: (id) => MEMBER_BY_ID.get(id)?.stageName ?? id,
  eraName: (id) => ERA_BY_ID.get(id)?.name ?? id,
});
const directB = computeCompatibility(inputFor(SOO), inputFor(MINJI), {
  template: (id) => TEMPLATE_BY_ID.get(id),
  groupName: (id) => GROUP_BY_ID.get(id)?.name ?? id,
  memberName: (id) => MEMBER_BY_ID.get(id)?.stageName ?? id,
  eraName: (id) => ERA_BY_ID.get(id)?.name ?? id,
});
check("demo/web repository uses canonical computeCompatibility", directA.score === compat.score, `direct ${directA.score} vs repo ${compat.score}`);
check("canonical score is deterministic", directA.score === directB.score, `${directA.score}`);
check("wishlist complement is present in the canonical score", directA.theyOwnYourWants.length > 0 && directA.youOwnTheirWants.length > 0);
check(
  "SOOMIN↔MINJI they-own-your-wants is the canonical five",
  [...directA.theyOwnYourWants].sort().join(",") === "set-ate-pc-12,set-lovedive-pc-1,set-switch-pc-6,t-ls-ive,t-poster-switch",
  [...directA.theyOwnYourWants].sort().join(", "),
);
check(
  "SOOMIN↔MINJI you-own-their-wants is the canonical four",
  [...directA.youOwnTheirWants].sort().join(",") === "set-lovedive-pc-4,set-rockstar-pc-8,t-poster-hyunjin,t-v-ate-vinyl",
  [...directA.youOwnTheirWants].sort().join(", "),
);
console.log(`  they own your wants: ${directA.theyOwnYourWants.length}`);
console.log(`  you own their wants: ${directA.youOwnTheirWants.length}`);
console.log(`  shared groups: ${directA.sharedGroupIds.join(", ")}`);
console.log(`  shared biases: ${directA.sharedBiasIds.join(", ")}`);

const chase = describeMatch(inputFor(SOO), inputFor(MINJI), "set-ate-pc-12" as never, true);
check("ATE chase card is they-own/you-want", chase.theyOwnYourWant && chase.theyOwn && chase.youWant);
check("ATE chase card is not treated as already owned by Soo", chase.youOwn === false);

const sooHolding = repo.listHoldingViews(SOO)[0];
if (sooHolding) {
  const representation = resolveDigitalRepresentation({ holding: sooHolding.holding, template: sooHolding.template });
  check("representation geometry is kind-derived", Boolean(representation.geometry));
  check("fixture representation does not invent personal media", representation.source !== "personal-media" || Boolean(sooHolding.holding.personalMediaUrl));
}

const binderEligible = repo.listHoldingViews(SOO).filter((view) => view.template.kind === "photocard");
check("binder eligibility is photocard holdings, not all objects", binderEligible.length === sooStats.photocards, `${binderEligible.length}`);
const stored = repo.listStoredHoldings(SOO);
check("room stored tray is unplaced holdings, not a second ownership set", stored.every((view) => repo.listHoldings(SOO).some((holding) => holding.id === view.holding.id)));
check("ownership is independent from placement", repo.listHoldings(SOO).length >= repo.listPlacements(ROOMS[0]!.id).length);

console.log("\nFEED");
check("feed has entries for Soo", repo.listActivity(SOO).length > 0, `${repo.listActivity(SOO).length} entries`);

console.log("\nCOMMUNICATION");
const sooNotices = NOTICES.filter((notice) => notice.recipientId === SOO);
check("SOO has five fixture notices", sooNotices.length === 5, `${sooNotices.length}`);
check(
  "notice kinds are existing product kinds only",
  sooNotices.every((notice) => ["like", "comment", "follow", "trade", "activity", "repost"].includes(notice.kind)),
);
const shareNeedle = "minji";
const shareRecipients = USERS.filter((user) => user.id !== SOO).filter((user) => (
  user.handle.toLowerCase().includes(shareNeedle) || user.displayName.toLowerCase().includes(shareNeedle)
));
check("Demo Send-to search finds Minji", shareRecipients.some((user) => user.id === MINJI));
const sharePost = POSTS.find((post) => post.id === "p-minji-concert");
check("share payload keeps a real fixture post id", Boolean(sharePost), sharePost?.id);
check(
  "share context is author + body, not an invented caption",
  Boolean(sharePost && sharePost.authorId === MINJI && sharePost.body.length > 0),
);
const askWishlist = runAssistantTools({
  viewerId: SOO,
  question: "What's on my wishlist?",
  locale: "en",
  context: { surface: "home" },
});
check("Ask Seoully wishlist maps to the fixture wishlist intent", askWishlist.intent === "wishlist", askWishlist.intent);
check("Ask Seoully wishlist cards come from the repository", askWishlist.cards.length > 0, `${askWishlist.cards.length}`);

console.log(failures === 0 ? "\nAll fixture checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
