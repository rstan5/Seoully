import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CANONICAL_ZONE_KINDS } from "../apps/mobile/src/room/worldView";
import { applyExploreOffset, CAMERA_FOV_DEG, EXPLORE_LIMITS, HOME_POSE, IDENTITY_EXPLORE, ROOM_INTERIOR } from "../apps/mobile/src/room/camera";
import { envelopeCoversPose, permittedExploreSamples, wholeRoomCompositionHolds, WORLD_ENVELOPE } from "../apps/mobile/src/room/envelope";
import { parseRoomStyle, resolveRoomLook, STYLE_BY_THEME } from "../apps/mobile/src/room/roomStyle";
import { representationForHolding } from "../apps/mobile/src/room/representation";

const repoRoot = process.cwd();
function read(rel: string) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}
function assertContains(haystack: string, needle: string, label: string) {
  assert.ok(haystack.includes(needle), `${label} missing ${JSON.stringify(needle)}`);
}
function assertNotContains(haystack: string, needle: string, label: string) {
  assert.ok(!haystack.includes(needle), `${label} unexpectedly contains ${JSON.stringify(needle)}`);
}

const worldScreen = read("apps/mobile/src/room/RoomWorldScreen.tsx");
const renderer = read("apps/mobile/src/room/NativeRoomRenderer.tsx");
const environment = read("apps/mobile/src/room/roomEnvironment.tsx");
const binder = read("apps/mobile/src/room/NativeOpenBinder.tsx");

assert.deepEqual([...CANONICAL_ZONE_KINDS], ["shelf", "wall", "case", "desk", "binder", "archive"]);
assert.equal((CANONICAL_ZONE_KINDS as readonly string[]).includes("closet"), false);
assertContains(environment, "WORLD_ENVELOPE", "envelope constants drive the shell");
assertContains(environment, "boxGeometry args={[2.15, 1.15, 1.55]}", "7C storage hit remains");
assertContains(environment, "boxGeometry args={[1.15, 1.02, 0.82]}", "7C Binder hit remains");
assertContains(environment, "RoomWindow", "authored window exists");
assertContains(environment, "FloorLamp", "floor lamp dressing exists");
assertContains(environment, "Plant", "plant dressing exists");
assertContains(environment, "StorageBoxes", "storage boxes exist");
assertContains(environment, "0.22, 0.03, 0.03", "desk drawer handles exist");
assertContains(renderer, "inspectionPresentation", "inspection repair remains");
assertContains(binder, "InspectedBinderCard", "binder card lift remains");
assertContains(read("apps/mobile/src/room/camera.ts"), "homeDollyMax: 1.48", "wide home dolly");
for (const prop of ["FloorLamp", "Plant", "StorageBoxes", "Rug", "RoomWindow"]) {
  const start = environment.indexOf(`function ${prop}`);
  const from = environment.slice(start);
  const next = from.slice(1).search(/\n(?:export )?function /);
  const body = next === -1 ? from : from.slice(0, next + 1);
  assert.ok(!body.includes("onClick"), `${prop} must stay non-interactive`);
}
assertContains(read("apps/mobile/src/room/model.ts"), "x: -3.15, y: -1.4, z: -3.48", "shelf landing plane unchanged");
assertContains(read("apps/mobile/src/room/model.ts"), "x: 1.45, y: -0.72, z: -2.85", "desk landing plane unchanged");
assertContains(read("apps/mobile/src/room/composition.ts"), "inspectionPresentation", "inspection repair file remains");
assertContains(renderer, "PosterForm", "posters have framed geometry");
assertContains(renderer, "bound", "books have bound treatment");
assertContains(renderer, "slim", "disc cases stay thin");
assertContains(renderer, "sphereGeometry args={[0.14, 24, 18]}", "lightstick head remains");
assertContains(binder, "boxGeometry args={[CARD_W, CARD_H, 0.012]}", "photocard pocket thickness");
assertContains(worldScreen, "RoomStyleSheet", "unified Edit Room style sheet");
assertContains(worldScreen, "saveNativeRoomStyle", "live style persist");
assertContains(worldScreen, "saveDemoRoomStyle", "demo style persist");
assertContains(worldScreen, "{!privateRoom ? <View", "Canvas mounts without waiting for snapshot");
assertNotContains(worldScreen, "surfaceReady", "no entrance readiness gate");
assertNotContains(renderer, "surfaceReady", "renderer has no surfaceReady");
assertNotContains(worldScreen, "Customize Room", "no second customization mode");
assertNotContains(read("apps/mobile/app/(tabs)/_layout.tsx"), "binder", "Binder stays off tabs");
assertNotContains(read("apps/mobile/app/(tabs)/_layout.tsx"), 'name="room"', "Room stays off tabs");
assertContains(read("apps/mobile/src/room/camera.ts"), "ceiling: 3.4", "camera ceiling unchanged");
assertContains(read("apps/mobile/src/room/camera.ts"), "floorGuard: -2.08", "camera floor guard unchanged");
assert.equal(CAMERA_FOV_DEG, 46);
assert.ok(WORLD_ENVELOPE.floorNearZ > ROOM_INTERIOR.floorNearZ, "floor extends past the accepted near lip");
assert.ok(WORLD_ENVELOPE.wallX > ROOM_INTERIOR.xMax, "side walls extend past accepted pan");
assert.ok(WORLD_ENVELOPE.ceilingY > ROOM_INTERIOR.ceiling, "ceiling sits above accepted look");

for (const pose of permittedExploreSamples()) {
  assert.equal(envelopeCoversPose(pose), true, `envelope must cover ${JSON.stringify(pose)}`);
}

const wideHome = applyExploreOffset(HOME_POSE, { ...IDENTITY_EXPLORE, dolly: EXPLORE_LIMITS.homeDollyMax }, "home");
assert.equal(envelopeCoversPose(wideHome), true, "widest home pose stays envelope-covered");
assert.equal(wholeRoomCompositionHolds(wideHome), true, "max dolly shows side wall, window, and furniture span");

const cream = resolveRoomLook(parseRoomStyle({ wall: "cream", floor: "oak", furniture: "oak", rug: "cream", light: "day", brightness: "bright" }));
assert.notEqual(cream.wall, resolveRoomLook(STYLE_BY_THEME.hearth).wall);
assert.ok(cream.brightness > 1);
const personal = representationForHolding({
  id: "h1",
  templateId: "t1",
  acquiredAt: "2026-01-01",
  tradeStatus: "not-for-trade",
  personalMediaUrl: "https://example.com/p.jpg",
  template: { id: "t1", groupId: "g", memberId: null, releaseId: null, kind: "album", name: "Get Up", descriptor: "", status: "complete", groupName: "NewJeans", memberName: null, releaseName: "Get Up", imageUrl: "https://example.com/c.jpg" },
});
assert.equal(personal.source, "personal-media");
const catalog = representationForHolding({
  id: "h2",
  templateId: "t2",
  acquiredAt: "2026-01-01",
  tradeStatus: "not-for-trade",
  template: { id: "t2", groupId: "g", memberId: null, releaseId: null, kind: "album", name: "Get Up", descriptor: "", status: "complete", groupName: "NewJeans", memberName: null, releaseName: "Get Up", imageUrl: "https://example.com/c.jpg" },
});
assert.equal(catalog.source, "catalog-reference");
const fallback = representationForHolding({
  id: "h3",
  templateId: "t3",
  acquiredAt: "2026-01-01",
  tradeStatus: "not-for-trade",
  template: { id: "t3", groupId: "g", memberId: null, releaseId: null, kind: "album", name: "Get Up", descriptor: "", status: "complete", groupName: "NewJeans", memberName: null, releaseName: "Get Up" },
});
assert.equal(fallback.source, "type-fallback");
assertContains(read("src/server/dal/rooms.ts"), "updateMyRoomStyle", "owner style writes");
assertContains(read("src/server/dal/rooms.ts"), "room_theme_unavailable", "old theme_id write stays blocked");
assertContains(read("supabase/migrations/20261003000000_native_room_style.sql"), "room_style_is_valid", "style migration validates curated ids");
assertContains(read("supabase/migrations/20261002000000_native_room_theme.sql"), "theme_id", "obsolete preset migration still exists");
assertContains(read("docs/native-road-to-ship.md"), "SLICE 7D — ROOM VISUAL RECONSTRUCTION", "7D documented");

console.log("check:slice7d passed");
