import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROOM_OBJECT_KINDS, validPhotoStringConfig, eligiblePhotoStringHolding } from "../src/domain/room-object-schema";
import { publicPhotoStringVisuals, publicVisualRoomLayout } from "../src/domain/public-room-layout";
import { defaultRoomObject, spawnRoomObject, starterRoomLayout, parseRoomLayout, serializeRoomLayout, cloneRoomObjects, clampRoomObject, SHOP_CATALOG, isWallObject } from "../apps/mobile/src/room/roomObjects";
import { FLOOR_Y, furnitureGroundY, FURNITURE_LOWER_BOUND, DESK_DRAWER_CENTERS, DESK_TABLETOP_TOP } from "../apps/mobile/src/room/roomGrounding";
import { nativeRoomSurfaces, surfaceAcceptsGeometry, settleRoomRenderable, type RoomRenderable } from "../apps/mobile/src/room/model";
import { visibleLowerBound } from "../apps/mobile/src/room/representation";
import { configuredPhotoString, eligiblePhotocards, photoStringAttachmentWorld, photoStringSlot, publicPhotoStringHolding, PHOTO_STRING_CAPACITY } from "../apps/mobile/src/room/photoString";
import { resolveRoomWorldTransform } from "../apps/mobile/src/room/roomWorldTransform";
import { ROOM_LAYOUT, ROOM_WIDTH_SCALE, ROOM_DEPTH_SCALE } from "../apps/mobile/src/room/roomLayout";
import { ROOM_BOX } from "../apps/mobile/src/room/envelope";
import { STARTER_ROOM_LAYOUT } from "../src/server/dal/room-schema";
import type { NativeHolding } from "../apps/mobile/src/api";

const read = (path: string) => readFileSync(path, "utf8");
const roomId = "repair08";
const starter = starterRoomLayout();
assert.deepEqual(starter.objects.map((o) => o.kind), ["shelf", "lamp"]);
assert.equal(starter.firstRoomEditCompleted, false);
for (const [i, o] of parseRoomLayout(STARTER_ROOM_LAYOUT).objects.entries()) {
  assert.equal(o.kind, starter.objects[i].kind);
  for (const axis of ["x", "y", "z"] as const) assert.ok(Math.abs(o[axis] - starter.objects[i][axis]) < 1e-9);
}
assert.deepEqual(serializeRoomLayout(parseRoomLayout({})), {});
assert.ok(!parseRoomLayout({}).objects.some((o) => o.kind === "chair" || o.kind === "photo-string"), "no retroactive Chair/String defaults");
assert.equal(ROOM_WIDTH_SCALE, 0.81);
assert.equal(ROOM_DEPTH_SCALE, 0.8);
assert.ok(Math.abs(ROOM_LAYOUT.wallX / (4.52 * 0.9) - 0.9) < 1e-10);
const sql = read("supabase/migrations/20261004000000_native_room_layout.sql");
const sqlKindLine = sql.split("\n").find((line) => line.includes("obj->>'kind'") && line.includes("not in"))!;
assert.deepEqual([...sqlKindLine.matchAll(/'([^']*)'/g)].map((match) => match[1]).filter((value) => value !== "kind" && value !== ""), [...ROOM_OBJECT_KINDS], "exact native/SQL kind parity");
for (const kind of ROOM_OBJECT_KINDS) assert.ok(sql.includes(`'${kind}'`), `${kind} native/SQL parity`);
for (const kind of Object.keys(FURNITURE_LOWER_BOUND) as (keyof typeof FURNITURE_LOWER_BOUND)[]) {
  const o = spawnRoomObject(starter.objects, kind);
  assert.ok(Math.abs(o.y + FURNITURE_LOWER_BOUND[kind] - FLOOR_Y - (kind === "rug" ? 0.002 : 0)) < 1e-10, `${kind} deterministic contact`);
  assert.equal(o.y, furnitureGroundY(kind));
}
assert.ok(DESK_DRAWER_CENTERS.every((y) => y + 0.11 < DESK_TABLETOP_TOP), "drawer fronts stay below tabletop");
assert.ok(SHOP_CATALOG.includes("chair") && SHOP_CATALOG.includes("photo-string"));
for (const kind of SHOP_CATALOG) {
  assert.ok(read("apps/mobile/src/room/ShopMiniature.tsx").includes(kind === "wall-frame" || kind === "photo-string" ? `"${kind}"` : `${kind}:`), `${kind} local miniature metadata`);
  const o = spawnRoomObject(starter.objects, kind);
  if (isWallObject(kind)) assert.equal(o.z, ROOM_BOX.backZ + 0.12);
  else assert.equal(o.y, furnitureGroundY(kind));
}
const objects = [...starter.objects, ...["desk", "case", "chair", "archive"].map((k) => defaultRoomObject(k as "desk" | "case" | "chair" | "archive"))];
const surfaces = nativeRoomSurfaces(roomId, objects);
const normal = ["album", "photocard", "lightstick", "plushie", "figure", "ticket", "memorabilia", "vinyl", "book", "apparel", "disc-case", "generic"] as const;
for (const form of normal) {
  for (const suffix of ["floor", "desk", "shelf-bay-0", "chair-seat", "display-case-shelf", "archive"]) {
    const surface = surfaces.find((s) => s.id === `${roomId}-${suffix}`)!;
    assert.ok(surface && surfaceAcceptsGeometry(surface, form), `${form} on ${suffix}`);
    const item = { geometry: form, scale: 1.2, rotation: { x: 0, y: 0.4, z: 0 }, position: { x: surface.x, y: 100, z: surface.z }, placement: { surfaceId: surface.id } } as RoomRenderable;
    const settled = settleRoomRenderable(item, roomId, surface.id, objects).renderable;
    assert.ok(Math.abs(settled.position.y + visibleLowerBound(form, item.scale, item.rotation) - surface.y - 0.002) < 1e-9, `${form}/${suffix} contact`);
  }
  assert.equal(surfaceAcceptsGeometry(surfaces.find((s) => s.kind === "wall")!, form), false, `${form} direct-wall rejection`);
}
for (const surface of surfaces) assert.equal(surfaceAcceptsGeometry(surface, "poster"), surface.kind === "wall");
for (const kind of ["wall-frame", "photo-string"] as const) {
  const o = clampRoomObject({ ...defaultRoomObject(kind), y: -50, z: 50 });
  assert.equal(o.z, ROOM_BOX.backZ + 0.12);
  assert.ok(o.y > -2);
}
const chair = objects.find((o) => o.kind === "chair")!;
const seat = surfaces.find((s) => s.id.endsWith("chair-seat"))!;
assert.equal(seat.y, chair.y + 0.06);
const heldPlush = { geometry: "plushie", scale: 1, position: { x: chair.x, y: seat.y + 0.262, z: chair.z }, rotation: { x: 0, y: 0, z: 0 }, placement: { surfaceId: seat.id } } as RoomRenderable;
const movedChair = { ...chair, x: chair.x + 1, z: chair.z + 0.4 };
const world = resolveRoomWorldTransform(heldPlush, roomId, objects.map((o) => o.id === chair.id ? movedChair : o));
assert.ok(Math.abs(world.position.x - heldPlush.position.x - 1) < 1e-9, "Chair child uses Repair 06 resolver exactly once");
assert.ok(Math.abs(world.position.y - seat.y - 0.262) < 1e-9);
assert.equal(PHOTO_STRING_CAPACITY, 5);
const photocard = { id: "owned-card", templateId: "template-card", template: { id: "template-card", kind: "photocard", status: "active", name: "Card", imageUrl: "catalog", groupName: "Group" }, personalMediaUrl: "private-crop" } as NativeHolding;
const album = { ...photocard, id: "album", template: { ...photocard.template, kind: "album" } };
const restricted = { ...photocard, id: "restricted", template: { ...photocard.template, status: "restricted" } };
assert.deepEqual(eligiblePhotocards([photocard, album, restricted]).map((h) => h.id), [photocard.id]);
assert.equal(eligiblePhotoStringHolding({ ownerUserId: "owner", template: photocard.template }, "owner"), true);
assert.equal(eligiblePhotoStringHolding({ ownerUserId: "other", template: photocard.template }, "owner"), false);
const ownershipBefore = JSON.stringify([photocard, album]);
const string = configuredPhotoString(defaultRoomObject("photo-string"), [photocard.id, null, null, null, null], [photocard, album]);
assert.equal(JSON.stringify([photocard, album]), ownershipBefore, "attachment does not mutate ownership/media/Binder eligibility");
assert.equal(string.photoString!.slots.length, 5);
assert.ok(validPhotoStringConfig({ slots: Array(5).fill(null) }));
assert.equal(validPhotoStringConfig({ slots: ["abcdefab-1234-1234-1234-123456789abc", "ABCDEFAB-1234-1234-1234-123456789ABC", null, null, null] }), false, "case-insensitive duplicate UUID rejection");
for (const invalid of [null, { slots: [] }, { slots: Array(6).fill(null) }, { slots: [photocard.id, photocard.id, null, null, null] }, { slots: [3, null, null, null, null] }, { slots: Array(5).fill(null), secret: true }]) assert.equal(validPhotoStringConfig(invalid), false);
assert.throws(() => configuredPhotoString(string, [album.id, null, null, null, null], [album]));
assert.throws(() => configuredPhotoString(string, ["unowned", null, null, null, null], [photocard]));
const roundTrip = parseRoomLayout(serializeRoomLayout({ source: "authored", firstRoomEditCompleted: true, objects: [string] }));
assert.deepEqual(roundTrip.objects[0].photoString, string.photoString);
assert.throws(() => parseRoomLayout({ version: 1, objects: [{ ...string, photoString: { slots: [1] } }] }));
const clone = cloneRoomObjects([string]); clone[0].photoString!.slots[0] = null;
assert.equal(string.photoString!.slots[0], photocard.id, "history owns a deep attachment copy");
for (let slot = 0; slot < 5; slot++) {
  const at = photoStringAttachmentWorld(string, slot), moved = photoStringAttachmentWorld({ ...string, x: string.x + 0.6, y: string.y + 0.3 }, slot);
  assert.ok(Math.abs(moved.x - at.x - 0.6) < 1e-9 && Math.abs(moved.y - at.y - 0.3) < 1e-9, "attachments inherit current parent pose");
}
assert.ok(photoStringSlot(2).y < photoStringSlot(0).y, "authored sag");
const publicLayout = publicVisualRoomLayout({ version: 1, objects: [{ ...string, privateMediaUrl: "secret" }] });
assert.ok(!JSON.stringify(publicLayout).includes("owned-card") && !JSON.stringify(publicLayout).includes("secret"), "public layout hides owner config/metadata");
const publicCards = publicPhotoStringVisuals([{ objectId: string.id, slot: 0, templateId: "template-card", holdingId: "owned-card", personalMediaUrl: "private-crop", mediaPath: "storage-secret", template: { ...photocard.template, personalMediaUrl: "private-crop", imageUrl: "unchecked-url" } }]);
assert.equal(publicCards.length, 1);
assert.ok(!/private-crop|storage-secret|owned-card|unchecked-url/.test(JSON.stringify(publicCards)));
const safe = publicPhotoStringHolding({ ...publicCards[0], catalogImageUrl: "active-shared-reference" });
assert.equal(safe.personalMediaUrl, undefined);
assert.equal(safe.template.imageUrl, "active-shared-reference");
const screen = read("apps/mobile/src/room/RoomWorldScreen.tsx");
const add = screen.slice(screen.indexOf("async function beginPlaceFromShop"), screen.indexOf("async function savePhotoString"));
assert.ok(add.indexOf("setRoomLayout(next)") < add.indexOf("await persistLayout(next)"), "immediate render before save/pointer");
assert.ok(add.includes("objectsBefore: beforeObjects") && add.includes("objectsAfter:"), "Add history supports Undo/Redo");
assert.ok(!add.includes("acquireRoomObject") && !add.includes("setHeldObjectId"), "no invalid ghost placement session");
assert.ok(screen.includes("opacity: helperOpacity") && screen.includes("lifetime - duration") && screen.includes("350"), "helper fades within original lifetime");
assert.ok(screen.includes("copy.openBinder") && read("apps/mobile/src/room/NativeOpenBinder.tsx").includes("group.current.visible = open || progress.current > 0"), "Binder intentional access without closed prop");
const renderer = read("apps/mobile/src/room/NativeRoomRenderer.tsx");
assert.equal((renderer.match(/<Canvas\b/g) ?? []).length, 1);
assert.ok(!/physics|rapier|cannon|Vision|EffectComposer|WebView/.test(renderer));
assert.ok(sql.includes("h.owner_user_id = new.owner_user_id") && sql.includes("ct.kind = 'photocard'"), "DB owner/eligibility trigger");
assert.ok(sql.includes("create trigger rooms_validate_photo_string") && !sql.includes("create policy"), "direct-write guard without RLS changes");
const cardsSQL = sql.slice(sql.indexOf("'photoStringCards'"), sql.indexOf("'placements'"));
assert.ok(!/mediaPath|mediaBucket|storage_path|personalMedia/.test(cardsSQL), "RPC attachment projection contains no private media");
console.log("Repair 08 focused schema, placement, privacy, spawn, helper and regression checks passed");

// Node has no native Image bridge. Stub only fixture image URI resolution, not Room logic.
const demoAssetPath = require.resolve("../apps/mobile/src/data/demo/assets");
const previousAssets = require.cache[demoAssetPath];
require.cache[demoAssetPath] = { id: demoAssetPath, filename: demoAssetPath, loaded: true, exports: { demoAssetUri: (path: string) => path } } as NodeModule;
const { buildFixtureRoomSnapshot, saveDemoRoomLayout, resetDemoRoomSession } = require("../apps/mobile/src/room/demoRoom") as typeof import("../apps/mobile/src/room/demoRoom");
if (previousAssets) require.cache[demoAssetPath] = previousAssets; else delete require.cache[demoAssetPath];
// Demo must exercise actual eligible Holdings and layout round trips without RoomPlacements.
resetDemoRoomSession();
const demo = buildFixtureRoomSnapshot(undefined, { ownStarter: true });
const demoOwner = demo.room.ownerUserId;
const ownedIds = eligiblePhotocards(demo.holdings).slice(0, 5).map((holding) => holding.id);
assert.equal(ownedIds.length, 5);
const demoString = configuredPhotoString(defaultRoomObject("photo-string"), ownedIds, demo.holdings);
const ownedSnapshot = JSON.stringify(demo.holdings);
saveDemoRoomLayout(demoOwner, { source: "authored", firstRoomEditCompleted: false, objects: [...starter.objects, defaultRoomObject("chair"), demoString] });
const demoReload = buildFixtureRoomSnapshot(undefined, { ownStarter: true });
assert.deepEqual(parseRoomLayout(demoReload.room.layout).objects.find((object) => object.kind === "photo-string")!.photoString!.slots, ownedIds);
assert.equal(demoReload.placements.length, 0, "attachments never become RoomPlacements");
assert.equal(JSON.stringify(demoReload.holdings), ownedSnapshot);
saveDemoRoomLayout(demoOwner, starter);
assert.equal(JSON.stringify(buildFixtureRoomSnapshot(undefined, { ownStarter: true }).holdings), ownedSnapshot, "removing Photo String retains all Holdings");
resetDemoRoomSession();
console.log("Repair 08 Demo Chair/String attachment round-trip and ownership checks passed");
