import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { binderLabel, binderLabelInk, binderTravel, BINDER_DISPLAY_TILT } from "../apps/mobile/src/room/binderPresentation";
import { ROOM_BINDER_COLORS } from "../src/domain/room-object-schema";
import { contrastRatio } from "../apps/mobile/src/ui/profileContrast";
assert.equal(binderLabel('Ryan','en').name,'Ryan');
assert.equal(binderLabel('민지','ko').name,'민지');
assert.equal(binderLabel('Minji','en').fontFamily,'DancingScript');
assert.equal(binderLabel('민지','ko').fontFamily,'NotoSansKR_700Bold');
assert.ok(binderLabel('x'.repeat(10000),'en').name.length<=28);
assert.ok(binderLabel('x'.repeat(10000),'en').name.includes('…'));
assert.equal(binderLabel('','en').name,'');
for(const cover of Object.values(ROOM_BINDER_COLORS)) assert.ok(contrastRatio(binderLabelInk(cover),cover)>=4.5,'Binder text contrast');
assert.ok(BINDER_DISPLAY_TILT*180/Math.PI>=65 && BINDER_DISPLAY_TILT*180/Math.PI<=70);
for(const reduced of [true,false]) {
 assert.equal(binderTravel(0,reduced).ease,0); assert.equal(binderTravel(0,reduced).orientation,0);
 assert.equal(binderTravel(1,reduced).ease,1); assert.equal(binderTravel(1,reduced).orientation,1);
 assert.ok(Math.abs(binderTravel(1,reduced).lift)<1e-8);
 assert.ok(binderTravel(.08,reduced).lift>0 && binderTravel(.08,reduced).orientation===0,'clear support before rotation');
 for(let i=1;i<=1000;i++) {
  const a=binderTravel((i-1)/1000,reduced),b=binderTravel(i/1000,reduced);
  for(const key of ['ease','orientation','spread','lift','camera'] as const) assert.ok(Math.abs(b[key]-a[key])<0.01,`${key} continuous forward/reverse path`);
 }
}
const screen=readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8');
const focus=screen.slice(screen.indexOf('useFocusEffect(useCallback'),screen.indexOf('const binderPages'));
assert.ok(focus.includes('setSelectedObjectId(null)') && focus.includes('setView({ kind: "home" })'));
const close=screen.slice(screen.indexOf('function closeBinder()'),screen.indexOf('function beginEditing()'));
assert.ok(close.includes('setSelectedObjectId(null)') && close.includes('clearHeldVisual()'));
assert.ok(screen.includes('setOwnerName(publicRoom.owner.displayName)'));
assert.ok(screen.includes('setOwnerName(demoRoom.demoCollectorDisplayName(next.room.ownerUserId))'));
assert.ok(screen.includes('identity?.profile.user.displayName'));
assert.ok(screen.includes('ownerName={ownerName}'));
const binder=readFileSync('apps/mobile/src/room/NativeOpenBinder.tsx','utf8');
assert.ok(!binder.includes('StandingBinder'));
assert.ok(binder.includes('ref={stand}') && binder.includes('stand.current.rotation.y=liveDeskBinderYaw'));
assert.ok(binder.includes('if (!open && progress.current===0) onOpen?.()'));
assert.ok(binder.includes('origin.current.position.copy(group.current.position)'));
assert.ok(binder.includes('origin.current.quaternion.copy(group.current.quaternion)'));
assert.ok(binder.includes('.slerp(openQuaternion,travel.orientation)'));
assert.ok(!binder.includes('closedRef') && !binder.includes('readingRef'),'one continuous mesh assembly');
assert.ok(binder.includes('if(!starting) progress.current'),'first animated frame preserves rendered T0');
const label=readFileSync('apps/mobile/src/room/BinderOwnerLabel.tsx','utf8');
assert.ok(label.includes('renderToImageAsync(text,{fontFamily:font'));
assert.ok(label.includes('resize({width:512})') && label.includes('texture?.dispose()'));
assert.ok(!/personalMedia|holdingId|https:/.test(label));
console.log('Binder presentation: neutral entry/close, name-only Latin script/non-Latin bundled typography, bounded names/textures, seven-color contrast, fixed stand and reversible lift-first path passed');
