import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildPages } from "../src/world/objects/binderGeometry";
import { isBinderEligible } from "../apps/mobile/src/data/ownership";
import { holdingRemainsAfterStore, pushPlacementHistory, restoreEditBaseline, revertDrop, storeRenderable } from "../apps/mobile/src/room/editSession";
import { nativeRoomSurfaces, surfaceAcceptsGeometry } from "../apps/mobile/src/room/model";
import {
  canAddRoomObject,
  childrenOnObject,
  deskBinderWorld,
  emptyLayoutMeansLegacy,
  legacyRoomLayout,
  parseRoomLayout,
  serializeRoomLayout,
  shouldAutoEnterFirstRoomEdit,
  shopHasNoCommerce,
  starterRoomLayout,
  translateChildren,
  UNIQUE_ROOM_OBJECT_KINDS,
  defaultRoomObject,
  furnitureDelta,
  ROOM_OBJECT_DEFAULTS,
} from "../apps/mobile/src/room/roomObjects";
import {
  authoredPlacementFromWorld,
  liveZoneDock,
  resolveRoomWorldTransform,
} from "../apps/mobile/src/room/roomWorldTransform";
import { acquireHeld, acquirePlaceFromStorage, compatibleSurfaces, LONG_PRESS_MS, placementsMatch, projectTouchOntoSurfaces, screenRay } from "../apps/mobile/src/room/touchEdit";
import { filterStoredHoldings } from "../apps/mobile/src/room/storedHoldings";
import {
  applyExploreOffset,
  BINDER_EXAMINE_POSE,
  BINDER_OPEN_POSE,
  CAMERA_FOV_DEG,
  clampExplore,
  exploreAllowedForView,
  explorePanLimits,
  EXPLORE_LIMITS,
  HOME_POSE,
  IDENTITY_EXPLORE,
  nudgeExploreFromDrag,
  nudgeExploreFromPinch,
  PORTRAIT_ASPECT,
  ROOM_INTERIOR,
  visibleHalfWidth,
} from "../apps/mobile/src/room/camera";
import { envelopeCoversPose } from "../apps/mobile/src/room/envelope";
import { layoutX, layoutZ } from "../apps/mobile/src/room/roomLayout";
import { entranceForeground, isInternalCollectorId, roomEntranceCopy } from "../apps/mobile/src/room/entrance";
import { roomOverlayChrome, roomPalette } from "../apps/mobile/src/room/theme";
import { BUTTON_LABEL_OPTICAL_Y } from "../apps/mobile/src/theme";
import { contrastRatio, relativeLuminance } from "../apps/mobile/src/ui/profileContrast";
import { CANONICAL_ZONE_KINDS, stepBack } from "../apps/mobile/src/room/worldView";
import {
  binderCameraForViewport,
  binderCardInspectionWorld,
  binderFitsPortrait,
  binderSpreadSize,
  frontFaceAxis,
  inspectionOrientationDelta,
  inspectionPresentation,
  openBinderWorldAt,
  presentedFaceSize,
} from "../apps/mobile/src/room/composition";

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
assertContains(representation, 'source: holding.personalMediaUrl ? "personal-media"', "personal media source");
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
assertContains(worldScreen, "onOpenBinder={deskPresent ? () => openBinderFromWorld() : undefined}", "Binder opens from the world object");
assertContains(worldScreen, "if (!snapshot || readOnly) return;", "public cannot place from storage");
assertContains(worldScreen, 'if (viewRef.current.kind !== "edit") return;', "physical placement requires edit mode");

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
assertContains(read("src/server/dal/room-schema.ts"), 'ROOM_OWNER_SELECT = "id,owner_user_id,created_at,updated_at,style,layout"', "style and layout selected without theme_id");
assertNotContains(read("src/server/dal/room-schema.ts"), 'ROOM_OWNER_SELECT = "id,owner_user_id,theme_id', "20261002 theme_id stays unselected");
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
assertContains(worldScreen, "openBinderFromWorld()", "desk Binder tap");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "ZONE_HOTSPOTS", "world zone taps");
assertContains(read("apps/mobile/src/room/roomEnvironment.tsx"), 'onSelectZone?.("shelf", object.id)', "shelf furniture tap");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "onOpenBinder", "desk Binder tap");
assertContains(read("apps/mobile/app/room.tsx"), "immersiveRoomFill", "own Room fills the physical viewport");
assertContains(read("apps/mobile/app/collector-room.tsx"), "immersiveRoomFill", "collector Room fills the physical viewport");
assertNotContains(read("apps/mobile/app/room.tsx"), "SafeAreaView", "own Room canvas is not shrunk by SafeAreaView");
assertNotContains(read("apps/mobile/app/collector-room.tsx"), "SafeAreaView", "collector Room canvas is not shrunk by SafeAreaView");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "style={StyleSheet.absoluteFill}", "Canvas covers the Room viewport");
assertContains(read("apps/mobile/src/ui/shellLayout.ts"), "Safe-area insets belong to overlays, not this fill", "safe area does not shrink the world");
assertContains(read("apps/mobile/app/(tabs)/profile.tsx"), 'router.push("/room")', "Profile enters stack Room");
assertContains(read("apps/mobile/src/i18n.ts"), 'editRoom: "Edit Room"', "Edit Room copy");
assertContains(read("apps/mobile/src/ui/shellLayout.ts"), "safe-area + gutter only", "immersive companion contract");
const authTree = read("apps/mobile/src/startup/AuthRouteTree.tsx");
assertContains(authTree, 'name="room" options={{ contentStyle: immersiveRoomFill(ROOM_THEMES.hearth.void), gestureEnabled: false, fullScreenGestureEnabled: false }}', "own Room disables swipe-back and paints the stack card");
assertContains(authTree, 'name="collector-room" options={{ contentStyle: immersiveRoomFill(ROOM_THEMES.hearth.void), gestureEnabled: false, fullScreenGestureEnabled: false }}', "collector Room disables swipe-back and paints the stack card");
assertContains(authTree, '<SeoullyLoadingState fullScreen', "blocking startup uses the full-screen branded surface");
assertContains(read("apps/mobile/app/room.tsx"), "gestureEnabled: false", "own Room route gesture off");
assertContains(read("apps/mobile/app/collector-room.tsx"), "gestureEnabled: false", "collector Room route gesture off");
assertNotContains(read("apps/mobile/app/collectible.tsx"), "gestureEnabled: false", "other stack routes keep swipe-back");
assert.equal(exploreAllowedForView({ kind: "home" }), true);
assert.equal(exploreAllowedForView({ kind: "zone", zone: "shelf" }), true);
assert.equal(exploreAllowedForView({ kind: "inspect", zone: "desk", holdingId: "h" }), false);
assert.equal(exploreAllowedForView({ kind: "binder", spread: 0 }), false);
assert.equal(exploreAllowedForView({ kind: "edit" }), true);
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
assert.ok(extreme.dolly >= EXPLORE_LIMITS.homeDollyMin && extreme.dolly <= EXPLORE_LIMITS.homeDollyMax);
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
assert.ok(pinched.dolly >= EXPLORE_LIMITS.homeDollyMin);
assert.equal(pinched.panX, 0);

function assertWorldEnvelope(dolly: number, panY: number) {
  const pose = applyExploreOffset(HOME_POSE, { panX: 0, panY, dolly }, "home");
  assert.ok(envelopeCoversPose(pose), `dolly ${dolly} panY ${panY} must stay inside the world envelope`);
}

const identityLimits = explorePanLimits(1, "home");
assert.ok(identityLimits.panXMin <= -0.85 && identityLimits.panXMax >= 0.85, "home still has horizontal travel");
assert.ok((identityLimits.panXMax - identityLimits.panXMin) > (identityLimits.panYMax - identityLimits.panYMin) * 2, "horizontal pan larger than vertical");

for (const dolly of [1, EXPLORE_LIMITS.homeDollyMin, EXPLORE_LIMITS.homeDollyMax]) {
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
assertContains(worldScreen, "immersiveRoomFill(roomTheme.void)", "Room void fills the world, not a hardcoded slice");
assertContains(worldScreen, "contentStyle: immersiveRoomFill(roomTheme.void)", "live Room void publishes onto the stack card");
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
assertContains(seoullyText, "CONTROL_LABEL_OPTICAL_Y", "control optical correction is shared");
assertContains(seoullyText, "control || variant === \"button\"", "optical Y reaches buttons and compact control labels");
assertContains(seoullyText, 'locale === "en"', "optical Y is Baloo / English only");
assertContains(read("apps/mobile/src/theme.ts"), "export const CONTROL_LABEL_OPTICAL_Y = 1.5", "named control optical token");
assert.equal(BUTTON_LABEL_OPTICAL_Y, 1.5);
assertNotContains(read("apps/mobile/src/theme.ts"), "translateY", "body/title tokens do not carry a screen hack");
assertNotContains(worldScreen, "translateY:", "Room overlays do not add a local label offset");
assertContains(read("apps/mobile/src/ui/SeoullyControls.tsx"), "control variant=\"caption\"", "chips/pills use the shared control label");
assertContains(read("apps/mobile/src/ui/SeoullyHeader.tsx"), "control variant=\"caption\"", "Demo pill uses the shared control label");
assertContains(read("apps/mobile/app/(tabs)/index.tsx"), "control variant=\"caption\"", "match pills use the shared control label");
assertContains(read("apps/mobile/src/ui/SeoullyLoadingState.tsx"), "justifyContent: \"center\"", "loading group is centered");
assertContains(read("apps/mobile/src/ui/SeoullyLoadingState.tsx"), "flex: 1", "loading uses the full usable viewport");
assertNotContains(read("apps/mobile/src/ui/SeoullyLoadingState.tsx"), "marginTop: 36", "loading has no arbitrary top offset");
const post = read("apps/mobile/src/ui/SeoullyPost.tsx");
assertContains(post, "useProfileIdentity", "collectible tag can read profile identity");
assertContains(post, "identity.paper", "profile collectible tags use identity paper");
assertContains(post, "colors.blush", "Discover collectible tags use Seoully soft pink");
assertNotContains(post, "backgroundColor: colors.surface", "collectible tag is not a generic white card");
assertContains(read("apps/mobile/src/i18n.ts"), 'back: "Back"', "EN Back label");
assertContains(read("apps/mobile/src/i18n.ts"), 'editRoom: "Edit Room"', "EN Edit Room label");
assertContains(read("apps/mobile/src/i18n.ts"), "back: \"뒤로\"", "KO Back label");
assertContains(read("apps/mobile/src/i18n.ts"), 'editRoom: "룸 편집"', "KO Edit Room label");
assertNotContains(worldScreen, "merch-box", "storage is an Archive crate, not a merch-box zone");
assertNotContains(worldScreen, "groupStoredHoldings", "legacy Stored tray grouping is gone");
assertContains(worldScreen, "StoredCollectionSheet", "stored collection uses a sheet");
assertContains(worldScreen, "beginPlaceFromStorage", "Edit Room places from storage");
assertContains(worldScreen, "binderReturnRef", "Binder captures the Room framing");
assertContains(worldScreen, "onOpenStorage={readOnly ? undefined", "public storage stays closed");
assertNotContains(worldScreen, "copy.rotateLeft", "Turn left is not a primary edit control");
assertNotContains(worldScreen, "copy.rotateRight", "Turn right is not a primary edit control");
assertNotContains(worldScreen, "copy.scaleDown", "Smaller is not a primary edit control");
assertNotContains(worldScreen, "copy.scaleUp", "Larger is not a primary edit control");
assertNotContains(worldScreen, "applyLocal(turnRenderable", "rotate buttons removed from Edit Room");
assertNotContains(worldScreen, "applyLocal(resizeRenderable", "scale buttons removed from Edit Room");
assertContains(worldScreen, "LONG_PRESS_MS", "long-press acquisition");
assertContains(worldScreen, "onCollectiblePressStart", "edit press starts a hold timer");
assertContains(worldScreen, "projectTouchOntoSurfaces", "drag projects into Room space");
assertContains(worldScreen, "previewRef", "drag preview is ref-driven");
assertContains(worldScreen, "heldRef.current", "acquired object owns the drag");
assertContains(worldScreen, "if (heldRef.current) {", "held drag does not pan the camera");
assertContains(worldScreen, "async function releaseHeld", "release commits or rolls back");
assertContains(worldScreen, "if (stored) rememberPlacement(held.origin ?? { storedHoldingId: held.holdingId }, stored)", "committed move or place is undoable");
assertContains(worldScreen, "revertDrop(all, origin)", "invalid release restores origin");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "onPressStart", "collectibles receive long-press");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "LandingHighlights", "compatible surfaces highlight while held");
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "held={heldId === item.holding.id}", "held object lifts");
assert.equal(LONG_PRESS_MS, 320);
assert.ok(LONG_PRESS_MS >= 250 && LONG_PRESS_MS <= 450, "long-press is between tap and a long wait");

const roomSurfaces = nativeRoomSurfaces("room-qa");
const shelf = roomSurfaces.find((surface) => surface.id.includes("shelf-bay-0"));
const desk = roomSurfaces.find((surface) => surface.id.endsWith("-desk"));
const wall = roomSurfaces.find((surface) => surface.kind === "wall");
const floor = roomSurfaces.find((surface) => surface.id.endsWith("-floor"));
const binder = roomSurfaces.find((surface) => surface.id.endsWith("-binder"));
const display = roomSurfaces.find((surface) => surface.id.includes("display-case"));
assert.ok(shelf && desk && wall && floor && binder && display);
assert.equal(surfaceAcceptsGeometry(shelf, "album"), true);
assert.equal(surfaceAcceptsGeometry(desk, "album"), true);
assert.equal(surfaceAcceptsGeometry(floor, "album"), true);
assert.equal(surfaceAcceptsGeometry(wall, "album"), false);
assert.equal(surfaceAcceptsGeometry(wall, "poster"), true);
assert.equal(surfaceAcceptsGeometry(floor, "poster"), false);
assert.equal(surfaceAcceptsGeometry(desk, "poster"), false);
assert.equal(surfaceAcceptsGeometry(binder, "photocard"), true);
assert.equal(surfaceAcceptsGeometry(desk, "photocard"), true);
assert.equal(surfaceAcceptsGeometry(floor, "photocard"), true);
assert.equal(surfaceAcceptsGeometry(display, "figure"), true);
assert.equal(surfaceAcceptsGeometry(floor, "figure"), true);
assert.equal(compatibleSurfaces("room-qa", "poster").every((surface) => surface.kind === "wall"), true);

const originAlbum = {
  holding: { id: "h-album" },
  position: { x: layoutX(-3.15), y: 0, z: layoutZ(-3.48) },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  geometry: "album" as const,
  color: "#000",
  accent: "#111",
  placement: { id: "p", roomId: "room-qa", holdingId: "h-album", zoneId: "room-qa-shelf", slot: 0, offset: null, transform: null, surfaceId: "room-qa-shelf-bay-0" },
};
const held = acquireHeld(originAlbum as never);
assert.equal(held.holdingId, "h-album");
assert.ok(held.preview.position.y > originAlbum.position.y, "acquired object lifts");
assert.equal(placementsMatch(originAlbum as never, originAlbum as never), true);
const undo: { before: typeof originAlbum; after: typeof originAlbum }[] = [];
const redo: typeof undo = [];
pushPlacementHistory(undo, redo, { before: originAlbum, after: { ...originAlbum, position: { ...originAlbum.position, x: 1 } } });
assert.equal(undo.length, 1);
assert.equal(redo.length, 0);
const deskHit = projectTouchOntoSurfaces(180, 420, 390, 844, {
  position: { x: 0.42, y: 2.45, z: 5.95 },
  lookAt: { x: 1.45, y: -0.72, z: -2.85 },
}, "room-qa", originAlbum as never);
assert.ok(!deskHit || deskHit.valid === false || deskHit.surface.id.includes("desk") || deskHit.surface.id.includes("shelf"));
const floorReject = projectTouchOntoSurfaces(195, 820, 390, 844, {
  position: { x: 0.42, y: 2.45, z: 5.95 },
  lookAt: { x: 0, y: -2.15, z: -1.2 },
}, "room-qa", { ...originAlbum, geometry: "poster" } as never);
assert.ok(!floorReject || floorReject.valid === false, "poster cannot settle on the floor");
const ray = screenRay(195, 400, 390, 844, { position: { x: 0.55, y: 1.92, z: 5.25 }, lookAt: { x: 0.18, y: -0.12, z: -2.35 } });
assert.ok(Math.abs(ray.dir.z) > 0.2, "touch ray points into the Room");

assertContains(read("docs/native-road-to-ship.md"), "DEFERRED TO 7D", "slanted floor sliver is documented for 7D");
assertContains(read("docs/native-road-to-ship.md"), "long-press object = acquire", "7B gesture model is documented");
assertContains(read("docs/web-native-parity-contract.md"), "DEFERRED TO 7D", "parity contract records the 7D envelope defect");
assertNotContains(read("apps/mobile/src/room/camera.ts"), "ceiling: 3.41", "7B does not chase the 7A camera envelope");
assertContains(read("apps/mobile/src/room/camera.ts"), "ceiling: 3.4", "accepted 7A ceiling bound remains");
assertContains(read("apps/mobile/src/room/camera.ts"), "floorGuard: -2.08", "accepted 7A floor guard remains");
assertNotContains(worldScreen, "saveNativeRoomTheme", "theme writes stay blocked");

// Slice 7C — storage + Binder world integration
const renderer = read("apps/mobile/src/room/NativeRoomRenderer.tsx");
const storedHoldings = [
  {
    id: "h-card",
    templateId: "t-card",
    acquiredAt: "2026-01-01",
    tradeStatus: "not-for-trade" as const,
    template: { id: "t-card", groupId: "g", memberId: "m", releaseId: "r", kind: "photocard", name: "Love Dive", descriptor: "pob", status: "complete", groupName: "IVE", memberName: "Yujin", releaseName: "Love Dive" },
  },
  {
    id: "h-album",
    templateId: "t-album",
    acquiredAt: "2026-01-01",
    tradeStatus: "not-for-trade" as const,
    template: { id: "t-album", groupId: "g", memberId: null, releaseId: "r", kind: "album", name: "Get Up", descriptor: "", status: "complete", groupName: "NewJeans", memberName: null, releaseName: "Get Up" },
  },
];
assert.equal(filterStoredHoldings(storedHoldings, "yujin").map((holding) => holding.id).join(), "h-card");
assert.equal(filterStoredHoldings(storedHoldings, "Get Up").map((holding) => holding.id).join(), "h-album");
assert.equal(filterStoredHoldings(storedHoldings, "").length, 2);
const takeout = acquirePlaceFromStorage({
  holding: { id: "h-new", template: { id: "t", kind: "album", name: "Get Up" } },
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  geometry: "album",
  color: "#000",
  accent: "#111",
} as never);
assert.equal(takeout.origin, null);
assert.equal(takeout.valid, false);
assert.equal(takeout.surfaceId, null);
assertContains(worldScreen, "acquirePlaceFromStorage", "new placement reuses 7B takeout");
assertContains(worldScreen, "openBinderFromWorld", "Binder opens from the world");
assertContains(worldScreen, "closeBinder", "Binder close restores framing");
assertContains(worldScreen, "explore: { ...exploreRef.current }", "Binder captures explore");
assertContains(renderer, "onOpenStorage", "Archive crate is the storage hit target");
assertContains(read("apps/mobile/src/room/roomEnvironment.tsx"), "boxGeometry args={[2.15, 1.15, 1.55]}", "storage hit geometry is world-attached");
assertContains(read("apps/mobile/src/room/roomEnvironment.tsx"), "boxGeometry args={[1.15, 1.02, 0.82]}", "Binder has a forgiving world hit");
assertContains(renderer, "placingItem", "new placement preview is in-world");
assertContains(renderer, "style={StyleSheet.absoluteFill}", "Canvas still fills without an opacity gate");
assertNotContains(renderer, "surfaceReady", "failed entrance repair is not reintroduced");
assertNotContains(worldScreen, "surfaceReady", "Room screen has no renderer readiness gate");
assertNotContains(renderer, "opacity: surfaceReady", "Canvas is not gated on surfaceReady");
assertNotContains(worldScreen, "closet", "no Closet");
assertNotContains(renderer, "closet", "renderer has no Closet");
assert.equal(CANONICAL_ZONE_KINDS.length, 6);
assert.deepEqual([...CANONICAL_ZONE_KINDS], ["shelf", "wall", "case", "desk", "binder", "archive"]);
assertContains(read("apps/mobile/src/i18n.ts"), 'storedSearch: "Search stored collection"', "EN stored search");
assertContains(read("apps/mobile/src/i18n.ts"), "storedSearch: \"보관 컬렉션 검색\"", "KO stored search");
assertContains(read("apps/mobile/app/(tabs)/_layout.tsx"), "profile", "tabs still exist");
assertNotContains(read("apps/mobile/app/(tabs)/_layout.tsx"), "binder", "Binder is not a bottom tab");
assertNotContains(read("apps/mobile/app/(tabs)/_layout.tsx"), "room", "Room is not a bottom tab");
assertContains(read("docs/native-road-to-ship.md"), "SLICE 7C — ROOM WORLD INTEGRATION", "7C is documented");
assertContains(read("docs/native-road-to-ship.md"), "physically verified", "7B physical QA is recorded");
assertContains(read("docs/native-road-to-ship.md"), "failed entrance repair", "reverted entrance repair is recorded");
assertContains(read("docs/native-road-to-ship.md"), "0.5s", "own-Room initialization blank is deferred");
assertContains(read("docs/web-native-parity-contract.md"), "SLICE 7C — ROOM WORLD INTEGRATION", "parity contract records 7C");
assertContains(read("docs/web-native-parity-contract.md"), "public storage", "public storage privacy is documented");

// Inspection front-face + Binder portrait composition
assert.equal(frontFaceAxis("album"), "+x");
assert.equal(frontFaceAxis("book"), "+x");
assert.equal(frontFaceAxis("disc-case"), "+x");
assert.equal(frontFaceAxis("photocard"), "+z");
assert.equal(frontFaceAxis("poster"), "+z");
assert.equal(frontFaceAxis("vinyl"), "+z");
assert.ok(Math.abs(inspectionOrientationDelta("album").y + Math.PI / 2) < 1e-6, "album inspect turns cover toward camera");
const albumFace = presentedFaceSize("album");
assert.ok(albumFace.width > 0.7 && albumFace.height > 0.7, "album cover face is the broad side, not the spine");
assert.ok(albumFace.width > albumFace.depth, "cover is wider than spine thickness");
const albumInspect = inspectionPresentation({
  geometry: "album",
  position: { x: -3.1, y: 0.1, z: -3.4 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  placement: { surfaceId: "room-shelf-0" },
});
assert.ok(Math.abs(albumInspect.rotation.y + Math.PI / 2) < 0.2, "shelf album inspect yaw presents +X cover");
assert.ok(albumInspect.position.z > -3.4, "album pulls forward off the shelf");
assert.ok(albumInspect.camera.position.z - albumInspect.position.z > 1.4, "inspect camera stays far enough to fit the cover");
const binderFit = binderFitsPortrait(PORTRAIT_ASPECT);
assert.equal(binderFit.fitsWidth, true);
assert.equal(binderFit.fitsHeight, true);
const binderPose = binderCameraForViewport(PORTRAIT_ASPECT);
const binderAt = openBinderWorldAt();
const binderDepth = Math.hypot(binderPose.position.x - binderAt.x, binderPose.position.y - binderAt.y, binderPose.position.z - binderAt.z);
assert.ok(visibleHalfWidth(binderDepth, PORTRAIT_ASPECT) * 2 > binderSpreadSize().width * 0.9, "portrait Binder framing includes the spread width");
assert.ok(binderPose.position.z > 4.5, "Binder camera is not inside the spread");
assert.deepEqual(BINDER_EXAMINE_POSE, BINDER_OPEN_POSE);
const cardInspect = binderCardInspectionWorld(PORTRAIT_ASPECT);
assert.ok(cardInspect.position.z > binderAt.z + 1.2, "photocard lifts toward the camera, out of the pocket");
assert.ok(cardInspect.distance < binderDepth - 1, "inspected card sits in front of the Binder");
assert.equal(CAMERA_FOV_DEG, 46);
assertContains(read("apps/mobile/src/room/NativeRoomRenderer.tsx"), "inspectionPresentation", "room inspect uses front-face presentation");
assertContains(read("apps/mobile/src/room/NativeOpenBinder.tsx"), "card.parent.worldToLocal(targetPosition)", "binder card lifts out of pocket");
assertContains(read("apps/mobile/src/room/NativeOpenBinder.tsx"), "holding.personalMediaUrl ?? holding.template.imageUrl", "binder card image priority");
assertContains(worldScreen, "InspectionTray", "shared compact inspect chrome");
assertContains(worldScreen, "copy.viewCollectible", "View collectible on inspect");
assertContains(worldScreen, "copy.returnToBinder", "return to binder");
assertContains(worldScreen, "onWishlistCollectible", "visitor wishlist hook");
assertContains(worldScreen, "onMessageCollectible", "visitor message hook");
assertContains(read("apps/mobile/app/collector-room.tsx"), "onInspectCollectible", "public room reuses collectible detail");
assertContains(read("apps/mobile/app/collector-room.tsx"), "/public-collectible", "visitor View collectible is public detail");
assertContains(read("apps/mobile/app/room.tsx"), "/collectible", "own View collectible is canonical detail");
assertNotContains(read("apps/mobile/src/room/NativeOpenBinder.tsx"), "held ? 1.85", "no in-pocket zoom inspect");
assertNotContains(worldScreen, "onInspectCollectible && !readOnly", "public inspect can view collectible");

const starter = starterRoomLayout();
assert.deepEqual(starter.objects.map((item) => item.kind).sort(), ["desk", "lamp", "shelf"]);
assert.equal(starter.firstRoomEditCompleted, false);
assert.equal(shouldAutoEnterFirstRoomEdit(starter, false), true);
assert.equal(shouldAutoEnterFirstRoomEdit(starter, true), false);
const legacy = parseRoomLayout({});
assert.equal(emptyLayoutMeansLegacy({}), true);
assert.equal(legacy.source, "legacy");
assert.equal(legacy.firstRoomEditCompleted, true);
assert.equal(shouldAutoEnterFirstRoomEdit(legacy, false), false);
assert.equal(JSON.stringify(serializeRoomLayout(legacy)), "{}");
assert.equal(canAddRoomObject(starter.objects, "desk"), true);
assert.equal(canAddRoomObject(legacy.objects, "desk"), true);
assert.equal(UNIQUE_ROOM_OBJECT_KINDS.has("desk"), false);
assert.equal(shopHasNoCommerce(), true);
const starterShelf = starter.objects.find((item) => item.kind === "shelf")!;
const carried = translateChildren([{
  holding: { id: "h1" },
  position: { x: layoutX(-3.15), y: 0, z: layoutZ(-3.48) },
  placement: { surfaceId: "room-1-shelf-bay-0" },
}], "room-1", starterShelf, { x: 0.5, y: 0, z: 0 });
assert.ok(Math.abs(carried[0]!.position.x - (layoutX(-3.15) + 0.5)) < 1e-6, "shelf children follow parent delta");
assert.equal(childrenOnObject(carried, "room-1", { ...starterShelf, x: starterShelf.x + 0.5 }).length, 1);
assert.ok(deskBinderWorld(starter.objects));
assert.ok(deskBinderWorld(legacy.objects));
const movedSurfaces = nativeRoomSurfaces("room-1", [{ ...starterShelf, x: starterShelf.x + 1 }]);
const defaultBay = nativeRoomSurfaces("room-1").find((surface) => surface.id.endsWith("shelf-bay-0"))!;
const movedBay = movedSurfaces.find((surface) => surface.id.endsWith("shelf-bay-0"))!;
assert.ok(Math.abs(movedBay.x - defaultBay.x - 1) < 1e-6, "landing surfaces move with shelf");
assertContains(worldScreen, "RoomShopSheet", "basic Room Shop exists");
assertContains(worldScreen, "beginPlaceFromShop", "Shop can enter placement");
assertContains(worldScreen, "saveNativeRoomLayout", "live layout persist");
assertContains(worldScreen, "saveDemoRoomLayout", "demo layout persist");
assertContains(worldScreen, "roomFirstTitle", "first-room helper");
assertContains(worldScreen, "styles.editBar", "compact Edit toolbar");
assertNotContains(worldScreen, "styles.editTray", "giant edit tray is gone");
assertNotContains(worldScreen, "stripe", "no commerce in Room screen");
assertNotContains(read("apps/mobile/src/room/RoomShopSheet.tsx"), "price", "Shop has no prices");
assertNotContains(read("apps/mobile/src/room/roomObjects.ts"), "CannonJS", "no physics engine");
assertContains(read("src/server/dal/rooms.ts"), "updateMyRoomLayout", "owner layout writes");
assertContains(read("src/server/dal/rooms.ts"), "room_layout_unavailable", "unapplied layout column is honest");
assertContains(read("src/server/dal/rooms.ts"), "STARTER_ROOM_LAYOUT", "new rooms bootstrap Shelf + Lamp");
assertContains(read("supabase/migrations/20261004000000_native_room_layout.sql"), "room_layout_is_valid", "layout migration validates objects");
assertContains(read("supabase/migrations/20261004000000_native_room_layout.sql"), "firstRoomEditCompleted", "first-room completion lives on layout");

const roomId = "room-1";
const albumAuthored = {
  geometry: "album" as const,
  position: { x: layoutX(-3.15), y: -0.35, z: layoutZ(-3.48) },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  placement: { surfaceId: `${roomId}-shelf-bay-0` },
};
const shelfA = defaultRoomObject("shelf");
const shelfB = { ...shelfA, x: shelfA.x + 1, z: shelfA.z + 0.4 };
const atA = resolveRoomWorldTransform(albumAuthored, roomId, [shelfA]);
const atB = resolveRoomWorldTransform(albumAuthored, roomId, [shelfB]);
assert.ok(Math.abs(atA.position.x - albumAuthored.position.x) < 1e-6, "A: authored album stays on default shelf");
assert.ok(Math.abs(atB.position.x - (albumAuthored.position.x + 1)) < 1e-6, "A: moved shelf carries album world X");
assert.ok(Math.abs(atB.position.z - (albumAuthored.position.z + 0.4)) < 1e-6, "A: moved shelf carries album world Z");
const inspectB = inspectionPresentation({ ...albumAuthored, position: atB.position, rotation: atB.rotation });
assert.ok(Math.abs(inspectB.camera.lookAt.x - atB.position.x) < 1e-6, "A: inspection target equals resolved album X");
assert.ok(Math.abs((atB.position.x - atA.position.x) - 1) < 1e-6, "B: shelf +1 moves album +1");
assert.ok(Math.abs(atB.position.x - albumAuthored.position.x - 2) > 0.5, "B: album is not double-delta +2");
assert.deepEqual(authoredPlacementFromWorld(atB.position, roomId, albumAuthored.placement.surfaceId, [shelfB]), { ...albumAuthored.position, y: atA.position.y }, "B: grounded authored placement is unchanged after parent move");
const undone = resolveRoomWorldTransform(albumAuthored, roomId, [shelfA]);
assert.ok(Math.abs(undone.position.x - atA.position.x) < 1e-6, "C: undo returns album to A");
const redone = resolveRoomWorldTransform(albumAuthored, roomId, [shelfB]);
assert.ok(Math.abs(redone.position.x - atB.position.x) < 1e-6, "D: redo returns album to B");
const deskA = defaultRoomObject("desk");
const deskB = { ...deskA, x: deskA.x + 0.8 };
const binderA = deskBinderWorld([deskA])!;
const binderB = deskBinderWorld([deskB])!;
assert.ok(Math.abs(binderB.x - binderA.x - 0.8) < 1e-6, "E: Binder rest follows current Desk");
assert.ok(Math.abs(binderCameraForViewport(9 / 19.5, binderB).lookAt.x - openBinderWorldAt(binderB).x) < 1e-6, "E: Binder camera follows current Desk");
const caseItem = {
  geometry: "figure" as const,
  position: { x: layoutX(3.65), y: 0.1, z: layoutZ(-3.52) },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1,
  placement: { surfaceId: `${roomId}-display-case-shelf` },
};
const caseA = defaultRoomObject("case");
const caseB = { ...caseA, x: caseA.x - 0.7 };
const caseWorld = resolveRoomWorldTransform(caseItem, roomId, [caseB]);
assert.ok(Math.abs(caseWorld.position.x - (caseItem.position.x - 0.7)) < 1e-6, "F: Case child follows Case");
const wallItem = {
  position: { x: layoutX(1.1), y: 0.75, z: layoutZ(-4.12) },
  placement: { surfaceId: `${roomId}-wall` },
};
const wallWorld = resolveRoomWorldTransform(wallItem, roomId, [shelfB, caseB, deskB]);
assert.ok(Math.abs(wallWorld.position.x - wallItem.position.x) < 1e-6, "G: wall collectible ignores furniture displacement");
const publicAlbum = resolveRoomWorldTransform(albumAuthored, roomId, [shelfB]);
assert.ok(Math.abs(publicAlbum.position.x - atB.position.x) < 1e-6, "H: public layout uses the same resolver");
assert.ok(Math.abs(resolveRoomWorldTransform(albumAuthored, roomId, [shelfA]).position.x - albumAuthored.position.x) < 1e-6, "I: legacy absolute placement remains resolvable");
const shopShelf = defaultRoomObject("shelf", "shelf-2");
shopShelf.x += 1.2;
const shopAlbum = {
  position: { x: layoutX(-3.15) + 0.2, y: -0.35, z: layoutZ(-3.48) },
  placement: { surfaceId: `${roomId}-shelf:shelf-2-bay-0` },
};
const shopWorld = resolveRoomWorldTransform(shopAlbum, roomId, [shopShelf]);
assert.ok(Math.abs(shopWorld.position.x - (shopAlbum.position.x + 1.2)) < 1e-6, "J: shop-added shelf anchors its child");
assert.ok(Math.abs(liveZoneDock("shelf", [shelfB]).lookAt.x - (liveZoneDock("shelf", [shelfA]).lookAt.x + 1)) < 1e-6, "zone return follows moved shelf");
assert.ok(Math.abs(furnitureDelta(shelfB).x - 1) < 1e-6, "furnitureDelta is current minus kind default");
assert.ok(Math.abs(ROOM_OBJECT_DEFAULTS.shelf.x - shelfA.x) < 1e-6, "default shelf is the authored reference");

console.log("check:slice7 passed");
