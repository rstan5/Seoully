import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHOP_CATALOG, CARRIER_ROOM_OBJECT_KINDS, canAddRoomObject, clampRoomObject, spawnRoomObject, turnRoomObject, defaultRoomObject, surfacesOwnedBy, surfaceOwner, childrenOnInstance, rotatedRoomObjectFootprint, cloneRoomObjects, serializeRoomLayout, parseRoomLayout, deskBinderWorld, liveDeskBinderYaw, storageTakeoutFor, objectPointFromAuthored } from "../apps/mobile/src/room/roomObjects";
import { nativeRoomSurfaces, settleRoomRenderable, surfaceWorldPoint, type RoomRenderable } from "../apps/mobile/src/room/model";
import { resolveRoomWorldTransform, asAuthoredRenderable, inspectItemAtWorld, liveZoneDock } from "../apps/mobile/src/room/roomWorldTransform";
import { intersectSurface } from "../apps/mobile/src/room/touchEdit";
import { pushPlacementHistory, type PlacementHistoryEntry } from "../apps/mobile/src/room/editSession";
import { ROOM_YAWS } from "../src/domain/room-object-schema";
import { DESK_BINDER_AT, ZONE_DOCKS } from "../apps/mobile/src/room/camera";
import { saveDemoRoomLayout, buildFixtureRoomSnapshot } from "../apps/mobile/src/room/demoRoom";
const roomId="completeness";
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const point=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>{near(a.x,b.x);near(a.y,b.y);near(a.z,b.z);};
let objects: ReturnType<typeof spawnRoomObject>[]=[];
for(const kind of SHOP_CATALOG){
  assert.equal(canAddRoomObject(objects,kind),true);
  const a=spawnRoomObject(objects,kind); objects.push(a);
  assert.equal(canAddRoomObject(objects,kind),true);
  const b=spawnRoomObject(objects,kind); objects.push(b);
  assert.notEqual(a.id,b.id); assert.equal(objects.filter(o=>o.kind===kind).length,2);
  assert.notDeepEqual({x:a.x,y:a.y,z:a.z},{x:b.x,y:b.y,z:b.z},`nearby independent spawn ${kind}`);
  const savedA=JSON.stringify(a);const turned=turnRoomObject(b);
  assert.equal(JSON.stringify(a),savedA);
  assert.equal(turned.rotateY,kind==='wall-frame'||kind==='photo-string'?0:30);
  const remaining=objects.filter(o=>o.id!==b.id); assert.ok(remaining.some(o=>o.id===a.id));
  let rotated=b;for(let i=0;i<12;i++)rotated=turnRoomObject(rotated);assert.equal(rotated.rotateY,0);near(rotated.y,b.y);
  const undo: PlacementHistoryEntry<RoomRenderable,typeof a>[]=[];const redo: typeof undo=[];
  const before=cloneRoomObjects(remaining), after=cloneRoomObjects(objects);
  pushPlacementHistory(undo,redo,{before:{storedHoldingId:b.id},after:{storedHoldingId:b.id},objectsBefore:before,objectsAfter:after,childrenBefore:[],childrenAfter:[]});
  const entry=undo.pop()!;redo.push(entry);assert.deepEqual(entry.objectsBefore,remaining);assert.deepEqual(redo.pop()!.objectsAfter,objects);
}
assert.equal(new Set(objects.map(o=>o.id)).size,20);
for(const kind of CARRIER_ROOM_OBJECT_KINDS){
  const [a,b]=objects.filter(o=>o.kind===kind); const idsA=surfacesOwnedBy(roomId,a), idsB=surfacesOwnedBy(roomId,b);
  assert.ok(idsA.length>0);assert.ok(idsA.every(id=>!idsB.includes(id)));
  const authoredParent=defaultRoomObject(kind);
  const authoredSurface=nativeRoomSurfaces(roomId,[authoredParent]).find(s=>s.id===surfacesOwnedBy(roomId,authoredParent)[0])!;
  const child={holding:{id:`owned-${kind}`},geometry:"album",scale:1,position:{x:authoredSurface.x+.1,y:authoredSurface.y+.2,z:authoredSurface.z+.04},rotation:{x:0,y:.1,z:0},placement:{surfaceId:idsB[0]}} as RoomRenderable;
  const unchanged=JSON.stringify(child);
  assert.equal(surfaceOwner(roomId,[a,b],idsB[0])?.id,b.id);
  assert.equal(surfaceOwner(roomId,[a],idsB[0]),null,"no first-kind fallback for new instance IDs");
  assert.deepEqual(childrenOnInstance([child],roomId,[a,b],a.id),[]);
  assert.deepEqual(childrenOnInstance([child],roomId,[a,b],b.id),[child]);
  for(const yaw of [30,60,150,210,330] as const){
    const moved={...b,x:.2,z:-.5,rotateY:yaw}; const current=[{...a,x:-1,z:1,rotateY:120 as const},moved];
    const world=resolveRoomWorldTransform(child,roomId,current);
    const expected=objectPointFromAuthored(child.position,moved);near(world.position.x,expected.x);near(world.position.z,expected.z);
    near(world.rotation.y,.1+yaw*Math.PI/180);
    point(inspectItemAtWorld(child,roomId,current).position,world.position);
    point(resolveRoomWorldTransform(child,roomId,[a,b],{roomId,origin:b,current:moved}).position,world.position);
    const inverse=asAuthoredRenderable({...child,...world},roomId,current);near(inverse.position.x,child.position.x);near(inverse.position.z,child.position.z);near(inverse.rotation.y,.1);
    const surface=nativeRoomSurfaces(roomId,current).find(s=>s.id===idsB[0])!;assert.equal(surface.rotateY,yaw);
    const hit=surfaceWorldPoint({x:.1,y:0,z:.04},surface);assert.equal(intersectSurface({origin:{...hit,y:hit.y+2},dir:{x:0,y:-1,z:0}},surface)?.inBounds,true);
    point(resolveRoomWorldTransform(child,roomId,[{...a,x:99},moved]).position,world.position);
  }
  assert.equal(JSON.stringify(child),unchanged);
  const legacyId=surfacesOwnedBy(roomId,authoredParent)[0];assert.equal(surfaceOwner(roomId,[authoredParent,a,b],legacyId)?.id,kind);
  const oldCustom={...authoredParent,id:`old-${kind}`};assert.equal(surfaceOwner(roomId,[oldCustom,a,b],legacyId)?.id,oldCustom.id);
  const legacyChild={...child,placement:{surfaceId:legacyId}} as RoomRenderable;
  const legacyWorld=resolveRoomWorldTransform(legacyChild,roomId,[oldCustom,a,b]);
  const legacySaved=settleRoomRenderable({...legacyChild,...legacyWorld},roomId,legacyId,[oldCustom,a,b]);
  assert.equal(surfaceOwner(roomId,[oldCustom,a,b],legacySaved.surfaceId)?.id,oldCustom.id);
}
const desks=objects.filter(o=>o.kind==='desk');for(const yaw of [30,60,150,270,330] as const){
  const b={...desks[1],rotateY:yaw};const both=[desks[0],b];point(deskBinderWorld(both,b.id)!,objectPointFromAuthored(DESK_BINDER_AT,b));assert.equal(liveDeskBinderYaw(both,undefined,b.id),yaw);
  point(liveZoneDock('desk',both,b.id).lookAt,objectPointFromAuthored(ZONE_DOCKS.desk.lookAt,b));
  point(deskBinderWorld(both,desks[0].id)!,objectPointFromAuthored(DESK_BINDER_AT,desks[0]));
}
const archives=objects.filter(o=>o.kind==='archive');for(const a of archives)assert.equal(storageTakeoutFor(archives,a.id).x,a.x);
const base=defaultRoomObject('desk'),foot0=rotatedRoomObjectFootprint(base);
for(const yaw of ROOM_YAWS){const f=rotatedRoomObjectFootprint({...base,rotateY:yaw}),c=Math.abs(Math.cos(yaw*Math.PI/180)),s=Math.abs(Math.sin(yaw*Math.PI/180));near(f.halfX,c*foot0.halfX+s*foot0.halfZ);near(f.halfZ,s*foot0.halfX+c*foot0.halfZ);}
const strings=objects.filter(o=>o.kind==='photo-string');strings[0].photoString!.slots[0]='11111111-1111-4111-8111-111111111111';strings[1].photoString!.slots[1]='11111111-1111-4111-8111-111111111111';
const copy=cloneRoomObjects(strings);copy[0].photoString!.slots[0]=null;assert.equal(strings[0].photoString!.slots[0],'11111111-1111-4111-8111-111111111111');assert.equal(copy[1].photoString!.slots[1],strings[1].photoString!.slots[1]);
for(let i=0;i<40;i++)objects.push(spawnRoomObject(objects,SHOP_CATALOG[i%SHOP_CATALOG.length]));
objects=objects.map((o,i)=>clampRoomObject({...o,rotateY:o.kind==='wall-frame'||o.kind==='photo-string'?0:ROOM_YAWS[i%12]}));
const state={source:'authored' as const,firstRoomEditCompleted:true,objects}; const serialized=serializeRoomLayout(state);assert.deepEqual(parseRoomLayout(serialized).objects,objects);
assert.throws(()=>serializeRoomLayout({...state,objects:[objects[0],objects[0]]}),/invalid/);
assert.equal(parseRoomLayout({version:1,objects:[]}).objects.length,0);
const original=buildFixtureRoomSnapshot(undefined,{ownStarter:true});
assert.throws(()=>saveDemoRoomLayout(original.room.ownerUserId,state),/ineligible/);
const eligible=original.holdings.find(h=>h.template.kind==='photocard'&&h.template.status!=='restricted')!;
strings[0].photoString!.slots[0]=eligible.id;strings[1].photoString!.slots[1]=eligible.id;
// Objects were cloned by clamp above, so configure the two distinct persisted instances explicitly.
objects.find(o=>o.id===strings[0].id)!.photoString!.slots[0]=eligible.id;
objects.find(o=>o.id===strings[1].id)!.photoString!.slots[1]=eligible.id;
saveDemoRoomLayout(original.room.ownerUserId,state);const restored=buildFixtureRoomSnapshot(undefined,{ownStarter:true});assert.deepEqual(parseRoomLayout(restored.room.layout).objects,objects);assert.deepEqual(restored.holdings,original.holdings);saveDemoRoomLayout(original.room.ownerUserId,parseRoomLayout(original.room.layout));
const sql=readFileSync('supabase/migrations/20261004000000_native_room_layout.sql','utf8');assert.ok(sql.includes('object_ids'));assert.ok(sql.includes('330'));assert.ok(!sql.includes('between 1 and 24'));
const screen=readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8');assert.ok(screen.includes('childrenOnInstance('));assert.ok(screen.includes('applyFurnitureHistory(entry, true)'));assert.ok(screen.includes('openBinderFromWorld(undefined, selectedRoomObject.id)'));
console.log('Completeness: 30-degree yaw, 60-instance round-trip, exact parent surfaces, selected Binder origins, independent config/history and legacy compatibility passed');
