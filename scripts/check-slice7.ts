import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPages } from "../src/world/objects/binderGeometry";
import { isBinderEligible } from "../apps/mobile/src/data/ownership";
import { holdingRemainsAfterStore, restoreEditBaseline, revertDrop, storeRenderable } from "../apps/mobile/src/room/editSession";
import {
  applyExploreOffset,
  clampExplore,
  exploreAllowedForView,
  explorePanLimits,
  HOME_POSE,
  IDENTITY_EXPLORE,
  nudgeExploreFromDrag,
  nudgeExploreFromPinch,
  ROOM_INTERIOR,
  visibleFrustumY,
} from "../apps/mobile/src/room/camera";
import { entranceForeground, isInternalCollectorId, roomEntranceCopy } from "../apps/mobile/src/room/entrance";
import { roomOverlayChrome, roomPalette } from "../apps/mobile/src/room/theme";
import { BUTTON_LABEL_OPTICAL_Y } from "../apps/mobile/src/theme";
import { contrastRatio, relativeLuminance } from "../apps/mobile/src/ui/profileContrast";
import { CANONICAL_ZONE_KINDS, stepBack } from "../apps/mobile/src/room/worldView";

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

// A. Canonical zones — no Closet
assert.deepEqual([...CANONICAL_ZONE_KINDS], ["shelf", "wall", "case", "desk", "binder", "archive"]);
assert.equal((CANONICAL_ZONE_KINDS as readonly string[]).includes("closet"), false);
assertNotContains(read("apps/mobile/src/room/worldView.ts"), "closet", "worldView.ts");
assertNotContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "Closet", "NativeRoomRenderer.tsx");

// B. Room is not a primary tab
const tabs = read("apps/mobile/app/(tabs)/_layout.tsx");
assertContains(tabs, 'name="index"', "tabs");
assertContains(tabs, 'name="search"', "tabs");
assertContains(tabs, 'name="create"', "tabs");
assertContains(tabs, 'name="messages"', "tabs");
assertContains(tabs, 'name="profile"', "tabs");
assertNotContains(tabs, 'name="room"', "tabs");
assertContains(tabs, 'name="collector" options={{ href: null', "collector profile is a hidden social screen");
assert.equal(fs.existsSync(path.join(repoRoot, "apps/mobile/app/(tabs)/room.tsx")), false, "room is stack-only");
assert.equal(fs.existsSync(path.join(repoRoot, "apps/mobile/app/(tabs)/collector.tsx")), true, "collector profile is in the social shell");
assert.equal(fs.existsSync(path.join(repoRoot, "apps/mobile/app/collector.tsx")), false, "collector is not a stack-only profile");
const tabBar = read("apps/mobile/src/ui/SeoullyTabBar.tsx");
assertContains(tabBar, "index: IconHome", "tab bar");
assertNotContains(tabBar, "room: ", "tab bar must not show Room");

// C. Ownership vs placement
const owned = [{ id: "h1" }];
const placed = [{ holding: { id: "h1" }, position: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }];
assert.equal(storeRenderable(placed, "h1").length, 0);
assert.equal(holdingRemainsAfterStore(owned, "h1"), true);

// D. Public room — no edit mutation
const worldScreen = read("apps/mobile/src/room/RoomWorldScreen.tsx");
assertContains(worldScreen, 'const readOnly = mode === "public"', "public readOnly");
assertContains(worldScreen, "if (readOnly) return;", "public cannot enter edit");

// E. Private room
assertContains(worldScreen, "setPrivateRoom(publicRoom.private || !publicRoom.room)", "private public room");
assertContains(read("apps/mobile/app/collector-room.tsx"), 'mode="public"', "collector-room public");

// F. Media privacy
assertContains(worldScreen, "buildPublicRoomRenderables(publicRoom.room.id, publicRoom.room.placements)", "public placements only");
assertNotContains(worldScreen, "loadMyHoldings", "public room must not load own holdings");
assertContains(read("src/server/dal/public-room.ts"), "get_public_room_by_handle", "public RPC");

// G. Personal card art wins
const representation = read("apps/mobile/src/room/representation.ts");
assertContains(representation, 'source: imageUrl ? "personal-media"', "personal media source");
assertContains(representation, "holding.personalMediaUrl", "personal url");

// H. Representation fallback
for (const kind of ["photocard", "poster", "album", "vinyl", "book", "lightstick", "plushie", "figure", "apparel"]) {
  assertContains(representation, `"${kind}"`, `kind ${kind}`);
}
assertContains(representation, "memorabiliaKind", "memorabilia fallback");
assertContains(representation, 'return "generic"', "generic fallback");

// I. Invalid drop reverts
const model = read("apps/mobile/src/room/model.ts");
assertContains(model, "surfaceAcceptsGeometry", "surface rules");
assertContains(model, 'if (geometry === "poster") return surface.kind === "wall"', "poster wall only");
assertContains(worldScreen, "revertDrop(all, origin)", "invalid drop revert");
const origin = { holding: { id: "drop" }, position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
const moved = { ...origin, position: { x: 99, y: 99, z: 99 } };
assert.equal(revertDrop([moved], origin)[0]?.position.x, 0);

// J. Cancel edit restores
assert.equal(restoreEditBaseline([{ position: { x: 1 }, rotation: { y: 0 } }])[0]?.position.x, 1);
assertContains(worldScreen, "restoreEditBaseline(editBaseline.current)", "cancel edit");

// K. Save edit persists
assertContains(worldScreen, "saveNativeRoomPlacement", "save persist");
assertContains(worldScreen, "async function saveEditing", "save editing");

// L. Binder odd page
const webPages = buildPages([], [], () => undefined);
assert.equal(webPages.length % 2, 0);
assertContains(read("apps/mobile/src/binder/model.ts"), "if (pages.length % 2 === 1)", "native odd page");
assertContains(read("src/world/objects/binderGeometry.ts"), "if (pages.length % 2 === 1)", "web odd page");

// M. Binder image failure keeps geometry
const binder3d = read("apps/mobile/src/room/NativeOpenBinder.tsx");
assertContains(binder3d, "boxGeometry args={[CARD_W, CARD_H, 0.012]}", "card geometry");
assertContains(binder3d, "onError={() => setFailed(true)}", "image failure");

// N. Binder content — photocards only
assertContains(read("apps/mobile/src/binder/model.ts"), 'holding.template.kind === "photocard"', "photocards only");
assert.equal(isBinderEligible({ template: { kind: "photocard" } }), true);
assert.equal(isBinderEligible({ template: { kind: "album" } }), false);

// O. Card return
assert.deepEqual(stepBack({ kind: "binder", spread: 2, heldHoldingId: "p" }), { kind: "binder", spread: 2 });

// P. Room → Binder
assertContains(worldScreen, "openBinderView", "binder transition");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "NativeOpenBinder", "in-world binder");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "hideClosedBinder", "closed binder object");

// Q. Binder → Room
assert.deepEqual(stepBack({ kind: "binder", spread: 0 }), { kind: "zone", zone: "desk" });
assert.deepEqual(stepBack({ kind: "zone", zone: "desk" }), { kind: "home" });
assert.equal(stepBack({ kind: "home" }), "leave");

// R. Public binder
assertContains(worldScreen, "onOpenBinder={readOnly || editing ? undefined : () => openBinder()}", "public binder tap");
assertContains(worldScreen, "if (!snapshot || readOnly) return;", "public cannot place");

// S. Demo/Live isolation
assertContains(worldScreen, "loadDemoRoom", "demo require");
assertContains(worldScreen, "loadNativeRoom", "live room");
assertNotContains(read("apps/mobile/app/room.tsx"), "from \"../src/room/demoRoom\"", "no static demoRoom import");
assertNotContains(read("apps/mobile/src/data/production.ts"), "demoRoom", "production repo");

// T. Reduced motion
assertContains(worldScreen, "isReduceMotionEnabled", "reduced motion");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "reducedMotion", "camera reduced motion");
assertContains(binder3d, "reducedMotion", "page turn reduced motion");
assertContains(read("apps/mobile/src/room/camera.ts"), "if (reducedMotion) return 1", "snap camera");

// U. GL import safety
assertNotContains(read("apps/mobile/app/_layout.tsx"), "NativeRoomRenderer", "root layout");
assertNotContains(read("apps/mobile/app/(tabs)/_layout.tsx"), "NativeRoomRenderer", "tabs layout");
assertContains(worldScreen, "lazy(async () =>", "lazy room");
assertContains(read("apps/mobile/src/room/threeFiberCompat.ts"), "extractUrlBase", "LoaderUtils guard");

// V. Migration safety
assertContains(read("supabase/migrations/20261002000000_native_room_theme.sql"), "theme_id", "migration file exists");
assertContains(read("src/server/dal/room-schema.ts"), 'ROOM_OWNER_SELECT = "id,owner_user_id,created_at,updated_at"', "no theme_id select");
assertContains(read("src/server/dal/rooms.ts"), "room_theme_unavailable", "theme write blocked");
assertNotContains(read("apps/mobile/app/room.tsx"), "saveNativeRoomTheme", "room does not write theme");

assertNotContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "OrbitControls", "no orbit controls");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "AuthoredCamera", "authored camera");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "applyExploreOffset", "constrained explore");
assertContains(read("apps/mobile/src/ui/SeoullyProfile.tsx"), "RoomWorldGlimpse", "profile glimpse");
assertNotContains(read("apps/mobile/src/ui/SeoullyProfile.tsx"), "theme?.paper ?? colors.canvas", "no paper placeholder");

// Slice 7A — immersive shell + direct-touch camera
assertNotContains(worldScreen, "LookChip", "no permanent zone pills");
assertNotContains(worldScreen, "roomLookHome", "no Home pill");
assertNotContains(worldScreen, "fontSize: 30", "no giant Room title");
assertNotContains(worldScreen, "copy.roomLead", "no explanatory Room lead");
assertContains(worldScreen, "OverlayChrome", "minimal overlays");
assertContains(worldScreen, "copy.editRoom", "Edit Room entry");
assertContains(worldScreen, "nudgeExploreFromDrag", "one-finger explore");
assertContains(worldScreen, "nudgeExploreFromPinch", "pinch zoom");
assertContains(worldScreen, "Math.hypot(gesture.dx, gesture.dy) > 10", "drag threshold");
assertContains(worldScreen, "exploreRef={exploreRef}", "camera reads explore ref");
assertContains(worldScreen, "onOpenBinder={readOnly || editing ? undefined : () => openBinder()}", "desk Binder tap");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "ZONE_HOTSPOTS", "world zone taps");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), 'onSelectZone?.("shelf")', "shelf furniture tap");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "onOpenBinder", "desk Binder tap");
assertContains(read("apps/mobile/app/room.tsx"), 'edges={[]}', "own Room is full-bleed");
assertContains(read("apps/mobile/app/collector-room.tsx"), 'edges={[]}', "collector Room is full-bleed");
assertContains(read("apps/mobile/app/(tabs)/profile.tsx"), 'router.push("/room")', "Profile enters stack Room");
assertContains(read("apps/mobile/src/i18n.ts"), 'editRoom: "Edit Room"', "Edit Room copy");
assertContains(read("apps/mobile/src/ui/shellLayout.ts"), "safe-area + gutter only", "immersive companion contract");
const authTree = read("apps/mobile/src/startup/AuthRouteTree.tsx");
assertContains(authTree, 'name="room" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}', "own Room disables swipe-back");
assertContains(authTree, 'name="collector-room" options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}', "collector Room disables swipe-back");
assertContains(read("apps/mobile/app/room.tsx"), "gestureEnabled: false", "own Room route gesture off");
assertContains(read("apps/mobile/app/collector-room.tsx"), "gestureEnabled: false", "collector Room route gesture off");
assertNotContains(read("apps/mobile/app/collectible.tsx"), "gestureEnabled: false", "other stack routes keep swipe-back");
assert.equal(exploreAllowedForView({ kind: "home" }), true);
assert.equal(exploreAllowedForView({ kind: "zone", zone: "shelf" }), true);
assert.equal(exploreAllowedForView({ kind: "inspect", zone: "desk", holdingId: "h" }), false);
assert.equal(exploreAllowedForView({ kind: "binder", spread: 0 }), false);
assert.equal(exploreAllowedForView({ kind: "edit" }), false);
assertContains(read("apps/mobile/src/room/camera.ts"), "panX: number", "explore state is panX");
assertContains(read("apps/mobile/src/room/camera.ts"), "panY: number", "explore state is panY");
assertNotContains(read("apps/mobile/src/room/camera.ts"), "yaw: number", "explore is not yaw-primary");
assertContains(worldScreen, "frozenExploreRef", "inspection stores explore framing");
assertContains(worldScreen, "exploreRef.current = { ...frozenExploreRef.current }", "close inspect restores pan/dolly");
const identity = applyExploreOffset(HOME_POSE, IDENTITY_EXPLORE, "home");
assert.ok(Math.abs(identity.position.x - HOME_POSE.position.x) < 0.08);
assert.ok(Math.abs(identity.position.z - HOME_POSE.position.z) < 0.08);
assert.ok(Math.abs(identity.lookAt.x - HOME_POSE.lookAt.x) < 0.08);
const extreme = clampExplore({ panX: 99, panY: -99, dolly: 0.05 }, "home");
const limits = explorePanLimits(extreme.dolly, "home");
assert.ok(extreme.panX >= limits.panXMin && extreme.panX <= limits.panXMax);
assert.ok(extreme.panY >= limits.panYMin && extreme.panY <= limits.panYMax);
assert.ok(extreme.dolly >= 0.78 && extreme.dolly <= 1.22);
assert.ok((limits.panXMax - limits.panXMin) > (limits.panYMax - limits.panYMin) * 2, "horizontal pan larger than vertical");
const panned = applyExploreOffset(HOME_POSE, { panX: 1.4, panY: 0.2, dolly: 1 }, "home");
assert.ok(Math.abs(panned.lookAt.x - HOME_POSE.lookAt.x) > 0.5, "pan moves look target");
assert.ok(Math.abs((panned.position.x - panned.lookAt.x) - (HOME_POSE.position.x - HOME_POSE.lookAt.x)) < 0.08, "pan translates framing");
assert.ok(panned.lookAt.x >= ROOM_INTERIOR.xMin && panned.lookAt.x <= ROOM_INTERIOR.xMax);
assert.ok(panned.position.z > panned.lookAt.z, "camera stays in front of the look plane");
assert.ok(panned.position.z >= ROOM_INTERIOR.cameraMinZ, "home camera stays in the room");
const escaped = applyExploreOffset(HOME_POSE, { panX: 40, panY: 20, dolly: 0.4 }, "home");
assert.ok(escaped.position.y > 0, "camera cannot invert");
assert.ok(escaped.lookAt.x <= ROOM_INTERIOR.xMax && escaped.lookAt.x >= ROOM_INTERIOR.xMin, "lookAt stays interior");
assert.ok(escaped.position.z > escaped.lookAt.z, "no behind-wall pose");
const dragged = nudgeExploreFromDrag(IDENTITY_EXPLORE, 80, 0, "home");
assert.ok(dragged.panX < 0, "direct-manipulation pan");
assert.equal(dragged.dolly, 1);
const vertical = nudgeExploreFromDrag(IDENTITY_EXPLORE, 0, 80, "home");
assert.ok(Math.abs(vertical.panY) < Math.abs(dragged.panX), "vertical travel is smaller");
const pinched = nudgeExploreFromPinch(IDENTITY_EXPLORE, 1, 100, 140, "home");
assert.ok(pinched.dolly < 1);
assert.ok(pinched.dolly >= 0.78);
assert.equal(pinched.panX, 0);

function assertWorldEnvelope(dolly: number, panY: number) {
  const pose = applyExploreOffset(HOME_POSE, { panX: 0, panY, dolly }, "home");
  const ceiling = visibleFrustumY(pose, ROOM_INTERIOR.backZ);
  const floor = visibleFrustumY(pose, ROOM_INTERIOR.floorNearZ);
  assert.ok(ceiling.top <= ROOM_INTERIOR.ceiling + 0.02, `dolly ${dolly} panY ${panY} top ${ceiling.top}`);
  assert.ok(floor.bottom >= ROOM_INTERIOR.floor - 0.02, `dolly ${dolly} panY ${panY} bottom ${floor.bottom}`);
}

const identityLimits = explorePanLimits(1, "home");
assert.ok(Math.abs(identityLimits.panXMin + 3.241072952372463) < 1e-9, "horizontal min bound unchanged");
assert.ok(Math.abs(identityLimits.panXMax - 2.8810729523724627) < 1e-9, "horizontal max bound unchanged");

for (const dolly of [1, 0.78, 1.22]) {
  const up = clampExplore({ panX: 0, panY: 9, dolly }, "home");
  assertWorldEnvelope(up.dolly, up.panY);
  const down = clampExplore({ panX: 0, panY: -9, dolly }, "home");
  const downPose = applyExploreOffset(HOME_POSE, down, "home");
  assert.ok(downPose.position.y > ROOM_INTERIOR.floorGuard, "downward pan keeps the camera above the floor");
  assertWorldEnvelope(down.dolly, down.panY);
  assertWorldEnvelope(dolly, 0);
}

assertNotContains(worldScreen, "identity={", "no permanent Room identity chrome");
assertNotContains(worldScreen, "setOwnerName(userId)", "demo Room does not show raw user ids");
assertContains(worldScreen, "demoCollectorDisplayName", "demo Room uses display names");
assertContains(worldScreen, "RoomEntranceTitle", "transient entrance title");
assertContains(worldScreen, "pointerEvents=\"none\"", "entrance title does not intercept touches");
assertContains(worldScreen, "reducedMotion", "entrance respects reduced motion");
assertContains(read("apps/mobile/app/(tabs)/collector.tsx"), "usePublishProfileIdentity", "collector profile publishes tab theme");
assertContains(read("apps/mobile/src/ui/ProfileIdentity.tsx"), "identityPublicationSurvives", "theme survives Room transition");
assertContains(read("apps/mobile/src/ui/shellLayout.ts"), 'leaf === "profile" || leaf === "collector" || leaf === "room" || leaf === "collector-room"', "theme keep-set");
assertContains(read("apps/mobile/src/ui/ProfileIdentity.tsx"), "identityPublicationSurvives(pathname) ? published : null", "do not clear during Room");
assertNotContains(read("apps/mobile/src/ui/ProfileIdentity.tsx"), "return () => publish(null);", "blur does not flash default chrome");
assertContains(read("apps/mobile/src/i18n.ts"), 'enteringYourRoom: "Entering your room"', "own entrance copy");
assertContains(read("apps/mobile/src/i18n.ts"), 'enteringCollectorRoom: "Entering {name}\'s room"', "visitor entrance copy");
assert.equal(roomEntranceCopy({
  mode: "own",
  displayName: "u-soo",
  fallbackName: "Seoully collector",
  ownLabel: "Entering your room",
  visitorLabel: "Entering {name}'s room",
}), "Entering your room");
assert.equal(roomEntranceCopy({
  mode: "public",
  displayName: "Minji",
  fallbackName: "Seoully collector",
  ownLabel: "Entering your room",
  visitorLabel: "Entering {name}'s room",
}), "Entering Minji's room");
assert.equal(roomEntranceCopy({
  mode: "public",
  displayName: "u-minji",
  fallbackName: "Seoully collector",
  ownLabel: "Entering your room",
  visitorLabel: "Entering {name}'s room",
}), "Entering Seoully collector's room");
assert.equal(isInternalCollectorId("u-minji"), true);
assert.equal(isInternalCollectorId("Minji"), false);
assert.equal(entranceForeground("#120e12").color, "#f7f1f4");
assert.equal(entranceForeground("#efe8da").color, "#2c2e4c");

assertContains(worldScreen, "roomOverlayChrome", "Room overlays use Room chrome");
assertContains(worldScreen, "backgroundColor: roomTheme.void", "Room void fills the world, not a hardcoded slice");
assertContains(worldScreen, "chrome.color", "Back/Edit inherit Room chrome ink");
assertNotContains(worldScreen, 'color={colors.plum}>{copy.back}', "Back is not generic Seoully pink");
assertNotContains(worldScreen, 'color={colors.plum}>{editing ? copy.finishEditing : copy.editRoom}', "Edit Room is not generic Seoully pink");
assertNotContains(worldScreen, 'overlayChip: { backgroundColor: "rgba(247,241,244,0.88)"', "overlay chips are not generic paper pills");
assertNotContains(read("apps/mobile/src/ui/SeoullyCompanion.tsx"), "roomOverlayChrome", "Ask Seoully heart stays the companion");
assertContains(read("apps/mobile/src/ui/SeoullyCompanion.tsx"), "seoully-heart-mark", "Ask Seoully heart mark unchanged");

for (const themeId of ["hearth", "midnight", "blossom"] as const) {
  const chrome = roomOverlayChrome(roomPalette(themeId));
  assert.equal(chrome.dark, true, `${themeId} Room chrome follows dark atmosphere`);
  assert.ok(contrastRatio(chrome.color, chrome.background) >= 4.5, `${themeId} overlay contrast`);
  assert.ok(relativeLuminance(chrome.background) < 0.45, `${themeId} overlay stays on the Room`);
  assert.notEqual(chrome.color.toLowerCase(), "#c45374");
  assert.notEqual(chrome.background.toLowerCase(), "#fffafb");
}

const lightChrome = roomOverlayChrome({
  ...roomPalette("blossom"),
  void: "#efe8da",
  wall: "#f4dce4",
  furniture: "#e8d0c8",
  paper: "#fff6f4",
  ink: "#2c2e4c",
  fill: "#f3d4e2",
});
assert.equal(lightChrome.dark, false);
assert.ok(contrastRatio(lightChrome.color, lightChrome.background) >= 4.5, "light Room overlay contrast");
assert.ok(relativeLuminance(lightChrome.background) > 0.55, "light Room overlay stays cream/paper");

const seoullyText = read("apps/mobile/src/ui/SeoullyText.tsx");
assertContains(seoullyText, "BUTTON_LABEL_OPTICAL_Y", "button optical correction is shared");
assertContains(seoullyText, 'variant === "button" && locale === "en"', "optical Y is button-label + Baloo only");
assertContains(read("apps/mobile/src/theme.ts"), "export const BUTTON_LABEL_OPTICAL_Y = 1.5", "named button optical token");
assert.equal(BUTTON_LABEL_OPTICAL_Y, 1.5);
assertNotContains(read("apps/mobile/src/theme.ts"), "translateY", "body/title tokens do not carry a screen hack");
assertNotContains(worldScreen, "translateY:", "Room overlays do not add a local label offset");
assertContains(read("apps/mobile/src/i18n.ts"), 'back: "Back"', "EN Back label");
assertContains(read("apps/mobile/src/i18n.ts"), 'editRoom: "Edit Room"', "EN Edit Room label");
assertContains(read("apps/mobile/src/i18n.ts"), "back: \"뒤로\"", "KO Back label");
assertContains(read("apps/mobile/src/i18n.ts"), 'editRoom: "룸 편집"', "KO Edit Room label");
assertNotContains(worldScreen, "onLongPress", "Slice 7B long-press editing is not introduced");
assertNotContains(worldScreen, "merch-box", "Slice 7B storage sheet is not introduced");

console.log("check:slice7 passed");
