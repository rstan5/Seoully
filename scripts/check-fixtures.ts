/**
 * Fixture sanity check. Verifies that every placement resolves, every set
 * progress reads the way the demo narrative assumes, and that compatibility
 * lands somewhere meaningful. Run with `npm run check:fixtures`.
 */
import { MemoryCollectionRepository } from "../src/domain/memory-repository";
import { MINJI, ROOMS, SOO } from "../src/domain/fixtures/collectors";
import { TEMPLATE_BY_ID } from "../src/domain/fixtures/catalog";

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

console.log("\nFEED");
check("feed has entries for Soo", repo.listActivity(SOO).length > 0, `${repo.listActivity(SOO).length} entries`);

console.log(failures === 0 ? "\nAll fixture checks passed.\n" : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
