import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { CANONICAL_ZONE_KINDS } from "../apps/mobile/src/room/worldView";
import { applyExploreOffset, CAMERA_FOV_DEG, EXPLORE_LIMITS, HOME_POSE, IDENTITY_EXPLORE, IMMERSIVE_HOME, ROOM_INTERIOR } from "../apps/mobile/src/room/camera";
import { envelopeCoversPose, immersiveRoomHolds, permittedExploreSamples, ROOM_BOX, WORLD_ENVELOPE } from "../apps/mobile/src/room/envelope";
import { REPAIR02_BACK_Z, REPAIR02_WALL_X, ROOM_DEPTH_SCALE, ROOM_WIDTH_SCALE } from "../apps/mobile/src/room/roomLayout";
import {
  deskBinderWorld,
  liveDeskBinderWorld,
  spawnRoomObject,
  parseRoomLayout,
  shouldAutoEnterFirstRoomEdit,
  shopHasNoCommerce,
  starterRoomLayout,
  UNIQUE_ROOM_OBJECT_KINDS,
} from "../apps/mobile/src/room/roomObjects";
import { parseRoomStyle, resolveRoomLook, STYLE_BY_THEME } from "../apps/mobile/src/room/roomStyle";
import {
  ROOM_ANISOTROPY_LARGE_CAP,
  ROOM_ANISOTROPY_SMALL_CAP,
  ROOM_PIXEL_RATIO_CAP,
  ROOM_SHADOW_CAMERA,
  ROOM_SHADOW_MAP_SIZE,
  ROOM_TEXTURE_MAX_EDGE,
} from "../apps/mobile/src/room/roomRendererQuality";
import { representationForHolding } from "../apps/mobile/src/room/representation";

import { buildRoomRenderables, createInitialRoomRenderable, nativeRoomSurfaces } from "../apps/mobile/src/room/model";
import { openBinderWorldAt } from "../apps/mobile/src/room/composition";
import { CONTACT_EPSILON } from "../apps/mobile/src/room/roomGrounding";
import { extentsForGeometry } from "../apps/mobile/src/room/representation";
import type { NativeHolding } from "../apps/mobile/src/api";

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
assertContains(read("apps/mobile/src/room/camera.ts"), "homeDollyMax: 1.16", "immersive home dolly");
assert.ok(EXPLORE_LIMITS.homeDollyMax <= 1.22, "max dolly stays a modest step-back");
assert.ok(HOME_POSE.position.z < 8, "HOME stands inside the bedroom, not outside a dollhouse");
assert.ok(!read("apps/mobile/src/room/camera.ts").includes("15.55"), "rejected dollhouse HOME z is gone");
assert.ok(!read("apps/mobile/src/room/envelope.ts").includes("wholeRoomCompositionHolds"), "whole-room fit is not an acceptance check");
for (const prop of ["FloorLamp", "Plant", "StorageBoxes", "Rug", "RoomWindow"]) {
  const start = environment.indexOf(`function ${prop}`);
  const from = environment.slice(start);
  const next = from.slice(1).search(/\n(?:export )?function /);
  const body = next === -1 ? from : from.slice(0, next + 1);
  assert.ok(!body.includes("onClick"), `${prop} must stay non-interactive`);
}
assertContains(read("apps/mobile/src/room/model.ts"), "layoutX(-3.15)", "shelf landing follows layout X");
assertContains(read("apps/mobile/src/room/model.ts"), "layoutZ(-2.85)", "desk landing follows layout Z");
assertContains(read("apps/mobile/src/room/touchEdit.ts"), "layoutX(-1.2)", "storage takeout follows archive");
assert.ok(Math.abs(ROOM_WIDTH_SCALE - 0.81) < 1e-9, "Repair 08 width is another 10% narrower");
assert.ok(Math.abs(ROOM_DEPTH_SCALE - 0.8) < 1e-9, "depth scale is 20% shallower");
assert.ok(Math.abs(ROOM_BOX.wallX / REPAIR02_WALL_X - 0.81) < 1e-9, "visible wall half-width is 81% of Repair 02");
assert.ok(Math.abs(ROOM_BOX.backZ / REPAIR02_BACK_Z - 0.8) < 1e-9, "visible back wall is 80% of Repair 02 depth");
assert.equal(HOME_POSE.position.z, 5.72, "HOME was not pulled backward");
assert.equal(HOME_POSE.position.y, 1.58, "HOME height remains Repair 02");
assertContains(read("apps/mobile/src/room/roomMaterials.tsx"), "assets/room/plaster.png", "plaster texture is bundled");
assertContains(read("apps/mobile/src/room/roomMaterials.tsx"), "assets/room/wood-floor.png", "floor texture is bundled");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "castShadow", "one key light may cast shadows");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "ROOM_SHADOW_MAP_SIZE", "shadow map uses the Repair 05 constant");
assert.equal(ROOM_SHADOW_MAP_SIZE, 1024, "single directional shadow map is 1024");
assert.ok(ROOM_SHADOW_MAP_SIZE <= 1024, "shadow map never exceeds 1024");
assert.ok(ROOM_SHADOW_CAMERA.left >= -5.3 && ROOM_SHADOW_CAMERA.right <= 5.3, "shadow camera is fitted to the Room");
assert.ok(ROOM_SHADOW_CAMERA.far <= 13, "shadow camera far plane stays around the bedroom");
assert.equal((renderer.match(/castShadow/g) || []).length, 1, "only the key light casts realtime shadows in the renderer");
assert.ok(!/function (CollectibleForm|PersonalMediaFace|Cardstock|AlbumForm)[\s\S]{0,800}castShadow/.test(renderer), "collectibles stay non-casters");
assertContains(read("apps/mobile/src/room/roomEnvironment.tsx"), "ContactShadow", "authored contact cues exist");
assertContains(read("apps/mobile/src/room/roomMaterials.tsx"), "getMaxAnisotropy", "anisotropy queries renderer capabilities");
assertContains(read("apps/mobile/src/room/roomMaterials.tsx"), "LinearMipmapLinearFilter", "world textures keep mipmaps");
assertContains(read("apps/mobile/src/room/roomMaterials.tsx"), "prepCollectibleTexture", "collectible images use their own filter path");
assert.equal(ROOM_ANISOTROPY_LARGE_CAP, 4, "large-surface anisotropy stays conservative");
assert.equal(ROOM_ANISOTROPY_SMALL_CAP, 2, "small-surface anisotropy stays conservative");
assert.equal(ROOM_PIXEL_RATIO_CAP, 2, "documented pixel-ratio cap stays conservative");
assertNotContains(renderer, "dpr=", "Canvas does not override R3F native PixelRatio.get()");
assertNotContains(renderer, "surfaceReady", "renderer has no surfaceReady");
assertNotContains(read("apps/mobile/src/room/roomMaterials.tsx"), "http", "no remote texture fetch");
assertNotContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "EffectComposer", "no post-processing");
assertNotContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "PMREM", "no HDR environment");
assert.equal((renderer.match(/<Canvas/g) || []).length, 1, "one Room Canvas");
assertNotContains(worldScreen, "<Canvas", "world screen does not mount a second Canvas");
const textureDir = path.join(repoRoot, "apps/mobile/assets/room");
const textureFiles = fs.readdirSync(textureDir).filter((name) => name.endsWith(".png"));
assert.ok(textureFiles.length <= 8, "texture count stays bounded");
const textureEdges: Record<string, number> = {
  "plaster.png": 512,
  "wood-floor.png": 512,
  "wood-fine.png": 512,
  "fabric.png": 256,
  "cardboard.png": 128,
  "vinyl.png": 128,
  "paper.png": 128,
};
for (const name of textureFiles) {
  const bytes = fs.readFileSync(path.join(textureDir, name));
  const edge = bytes.readUInt32BE(16);
  assert.ok(edge <= ROOM_TEXTURE_MAX_EDGE, `${name} stays at or under ${ROOM_TEXTURE_MAX_EDGE}px`);
  if (textureEdges[name]) assert.equal(edge, textureEdges[name], `${name} keeps its Repair 05 size`);
}
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
assert.equal(immersiveRoomHolds(wideHome), true, "max dolly stays inside the bedroom");
assert.ok(wideHome.position.z <= IMMERSIVE_HOME.maxZ, "immersive Z guard holds at max dolly");
assert.ok(ROOM_BOX.wallNearZ > IMMERSIVE_HOME.maxZ, "inner side walls continue past the camera");
assert.ok(Math.abs(wideHome.position.x) < ROOM_BOX.wallX - 0.2, "camera does not stand outside the side walls");
for (const pose of permittedExploreSamples()) {
  assert.equal(immersiveRoomHolds(pose), true, `immersive home must hold ${JSON.stringify(pose.position)}`);
}

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
assertContains(read("docs/native-road-to-ship.md"), "Repair 04 — true Edit Room", "Repair 04 documented");
assertContains(read("docs/native-road-to-ship.md"), "Repair 05 — mobile render fidelity", "Repair 05 documented");
assertContains(read("apps/mobile/src/room/roomWorldTransform.ts"), "resolveRoomWorldTransform", "live world resolver exists");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "resolveRoomWorldTransform", "renderer consumes the resolver");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "inspectionPresentation(liveFocused, aspect)", "inspect camera uses resolved focus");
assertNotContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "carry.current.x - carry.origin.x", "no ad hoc furniture delta in the renderer");
assertNotContains(read("apps/mobile/src/room/RoomWorldScreen.tsx"), "translateChildren(", "furniture move does not rewrite child placements");
assertContains(read("apps/mobile/src/room/roomRendererQuality.ts"), "ROOM_SHADOW_MAP_SIZE", "Repair 05 shadow constant remains");
assert.equal(ROOM_SHADOW_MAP_SIZE, 1024, "Repair 05 1024 shadow remains");
assert.equal(ROOM_TEXTURE_MAX_EDGE, 512, "Repair 05 texture ceiling remains");
const starter = starterRoomLayout();
assert.equal(starter.objects.length, 3);
assert.equal(starter.objects.some((item) => item.kind === "desk" && item.binderDesk), true);
assert.equal(shouldAutoEnterFirstRoomEdit(parseRoomLayout({}), false), false);
assert.equal(shopHasNoCommerce(), true);
assert.equal(UNIQUE_ROOM_OBJECT_KINDS.has("rug"), false);
assertContains(worldScreen, "RoomShopSheet", "Shop sheet");
assertContains(worldScreen, "styles.editBar", "compact floating toolbar");
assertNotContains(worldScreen, "styles.editTray", "giant white edit block removed");
assertContains(worldScreen, "roomFirstTitle", "first-room copy");
assertContains(worldScreen, "showToast", "transient placement errors");
assertNotContains(read("apps/mobile/src/room/RoomShopSheet.tsx"), "Stripe", "no Stripe");
assertNotContains(read("apps/mobile/src/room/RoomShopSheet.tsx"), "coin", "no coins");
assertContains(environment, "FurniturePose", "furniture uses instance transforms");
assertContains(environment, "WallFrame", "wall decor is a Room object");
assertContains(read("apps/mobile/src/room/roomEnvironment.tsx"), "RoomWindow", "window stays architectural");
assertContains(read("src/server/dal/public-room.ts"), "layout", "public Room may expose visual layout");
assertContains(read("supabase/migrations/20261004000000_native_room_layout.sql"), "rooms_update_own", "layout stays on owner-write rooms");

console.log("check:slice7d passed");

// Repair 07: placement truth, a clean starter, and persistent spatial Binder.
const clean = starterRoomLayout();
assert.deepEqual(clean.objects.map((object) => object.kind), ["shelf", "lamp", "desk"]);
assert.equal(clean.firstRoomEditCompleted, false);
assert.ok(deskBinderWorld(clean.objects));
const desk07 = spawnRoomObject(clean.objects, "desk");
const withDesk07 = [...clean.objects.filter(o => o.kind !== "desk"), desk07];
const anchor07 = deskBinderWorld(withDesk07)!;
const moved07 = { ...desk07, x: desk07.x + 0.7, z: desk07.z + 0.4 };
const movedAnchor07 = liveDeskBinderWorld(withDesk07, moved07)!;
assert.ok(Math.abs(movedAnchor07.x - anchor07.x - 0.7) < 1e-9);
assert.ok(Math.abs(movedAnchor07.z - anchor07.z - 0.4) < 1e-9);
assert.ok(Math.abs(movedAnchor07.x - deskBinderWorld([...clean.objects.filter(o => o.kind !== "desk"), moved07])!.x) < 1e-9);
assert.equal(openBinderWorldAt(movedAnchor07).x, movedAnchor07.x);
const archive07 = spawnRoomObject(withDesk07, "archive");
assert.ok(Math.hypot(archive07.x - anchor07.x, archive07.z - anchor07.z) > 2);
const holding07 = { id: "repair07-owned", templateId: "template07", template: { id: "template07", kind: "album", name: "Album" } } as NativeHolding;
assert.deepEqual(buildRoomRenderables([holding07], []), [], "ownership never creates placement");
const placement07 = { id: "p07", roomId: "r07", holdingId: holding07.id, zoneId: "r07-shelf", slot: 0, offset: null, transform: null, surfaceId: "r07-shelf-bay-0" };
assert.equal(buildRoomRenderables([holding07], [placement07]).length, 1);
const album07 = createInitialRoomRenderable(holding07, 0, "r07");
const shelf07 = nativeRoomSurfaces("r07").find((surface) => surface.id === "r07-shelf-bay-0")!;
assert.equal(album07.position.y - extentsForGeometry("album").y / 2, shelf07.y + CONTACT_EPSILON);
assertContains(worldScreen, "__DEV__ && demo && !readOnly && editing", "reset UI is Demo owner edit only");
assertContains(worldScreen, 'if (!__DEV__ || !demo || mode !== "own" || !snapshot) return;', "reset handler guard");
assertContains(worldScreen, "showLegacyBoxes={false}", "no decorative storage clutter");
assertContains(worldScreen, "{ ownStarter: true }", "own Demo starts clean");
const demo07 = read("apps/mobile/src/room/demoRoom.ts");
const reset07 = demo07.slice(demo07.indexOf("export function resetDemoRoomToStarter"), demo07.indexOf("export function saveDemoRoomLayout"));
assertContains(reset07, "session.set(ownerId, [])", "reset clears session placements only");
assertContains(reset07, "starterRoomLayout()", "reset clears first-edit flag");
assertNotContains(reset07, "await", "no server reset");
assertNotContains(reset07, "delete", "no data deletion");
assertContains(renderer, "{binderAt ? <NativeOpenBinder", "Binder lifecycle follows Desk, not open view");
assertContains(binder, "liveDeskBinderWorld(objects, objectPreviewRef?.current, deskInstanceId)", "open and close use live Desk");
assertContains(binder, "open ? 1 : -1", "reverse the same spatial motion on close");
assertNotContains(binder, "setY(", "page turn uses refs");
assertNotContains(binder, "<Canvas", "no second Canvas");
assertNotContains(worldScreen, "Vision", "no Vision");
assert.ok(extentsForGeometry("ticket").y < 0.02);
assert.ok(extentsForGeometry("memorabilia").y < 0.02);
console.log("Repair 07 focused checks passed");

const twin07 = { ...holding07, id: "repair07-twin" };
const defaults07 = buildRoomRenderables([holding07, twin07], [placement07, { ...placement07, id: "p08", holdingId: twin07.id }]);
assert.notDeepEqual(defaults07[0].position, defaults07[1].position, "duplicate fallback slots are distinct");
const saved07 = { x: 33, y: 44, z: 55, rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1 };
const overlaps07 = buildRoomRenderables([holding07, twin07], [
  { ...placement07, transform: saved07 },
  { ...placement07, id: "p08", holdingId: twin07.id, transform: saved07 },
]);
assert.deepEqual(overlaps07[0].position, overlaps07[1].position, "intentional overlap remains authoritative");
assertContains(worldScreen, 'if (!desk) return;', "no Binder entry without Desk");

// Repair 08 extends the physical builder and privacy checks.
import "./check-room-repair08";

import "./check-room-interaction-polish";

import "./check-room-builder-completeness";

import "./check-room-content";

import "./check-room-physical-repair";

import "./check-binder-presentation";
