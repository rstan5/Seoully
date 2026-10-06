import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROOM_OBJECT_KINDS, validRoomObjectRelationships } from "../src/domain/room-object-schema";
import { SHOP_CATALOG, starterRoomLayout, legacyRoomLayout, defaultRoomObject, normalizeBinderDesk, primaryBinderDeskId, spawnRoomObject, attachRoomDecor, detachRoomDecor, resolveRoomObjectTransform, removeFurnitureSafely, turnRoomObject, surfacesOwnedBy, serializeRoomLayout, parseRoomLayout, cloneRoomObjects } from "../apps/mobile/src/room/roomObjects";
import { FLOOR_Y } from "../apps/mobile/src/room/roomGrounding";
import { nativeRoomSurfaces, surfaceWorldPoint, type RoomRenderable } from "../apps/mobile/src/room/model";
import { previewOnSurface } from "../apps/mobile/src/room/touchEdit";
import { projectRoomObjectOntoWorld } from "../apps/mobile/src/room/roomObjectEdit";
import { parseRoomStyle, resolveRoomLook, ROOM_BINDER_IDS } from "../apps/mobile/src/room/roomStyle";
import { buildFixtureRoomSnapshot, saveDemoRoomLayout, saveDemoRoomStyle } from "../apps/mobile/src/room/demoRoom";
import { publicVisualRoomLayout } from "../src/domain/public-room-layout";
const read=(path:string)=>readFileSync(path,"utf8"),near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} / ${b}`);
assert.equal(ROOM_OBJECT_KINDS.length,12);assert.equal(SHOP_CATALOG.length,12);
const starter=starterRoomLayout();assert.deepEqual(starter.objects.map(o=>o.kind),['shelf','lamp','desk']);assert.equal(primaryBinderDeskId(starter.objects),'desk');
assert.ok(!legacyRoomLayout().objects.some(o=>o.kind==='table-lamp'||o.kind==='large-plant'));
const deskA={...defaultRoomObject('desk','desk-a'),x:0,z:-1,binderDesk:true as const},deskB={...defaultRoomObject('desk','desk-b'),x:1,z:0};
let parents=normalizeBinderDesk([deskA,deskB,defaultRoomObject('shelf','shelf-b')]);
for(const kind of ['plant','table-lamp'] as const){
 const decor=defaultRoomObject(kind,`${kind}-a`);const world={...decor,x:deskA.x+1.1,y:deskA.y+.0825,z:deskA.z};
 const child=attachRoomDecor(world,deskA,'desk',parents);assert.equal(child.parent?.objectId,deskA.id);assert.equal(child.id,decor.id);
 let all=[...parents,child];const stored=JSON.stringify(child);
 for(const yaw of [30,60,150,210,330] as const){
  const moved={...deskA,x:.5,z:-.5,rotateY:yaw};const current=all.map(o=>o.id===deskA.id?moved:o);
  const live=resolveRoomObjectTransform(child,current);const radians=yaw*Math.PI/180;
  near(live.x,moved.x+Math.cos(radians)*child.x+Math.sin(radians)*child.z);near(live.z,moved.z-Math.sin(radians)*child.x+Math.cos(radians)*child.z);near(live.y,moved.y+.0825+.002);
  const turned=turnRoomObject(child,current);assert.equal(turned.rotateY,30);assert.equal(resolveRoomObjectTransform(turned,current).rotateY,(yaw+30)%360);
  assert.deepEqual(resolveRoomObjectTransform(child,current.map(o=>o.id===deskB.id?{...o,x:99}:o)),live);
 }
 assert.equal(JSON.stringify(child),stored);
 const shelf=parents.find(o=>o.kind==='shelf')!;const reparent=attachRoomDecor({...resolveRoomObjectTransform(child,all),x:shelf.x,z:shelf.z},shelf,'shelf-bay-1',all);assert.equal(reparent.parent?.objectId,shelf.id);
 const floor=detachRoomDecor(resolveRoomObjectTransform(reparent,[...parents,reparent]));assert.equal(floor.parent,undefined);near(floor.y,FLOOR_Y);
 const removed=removeFurnitureSafely(all,deskA.id);assert.equal(primaryBinderDeskId(removed),deskB.id);const kept=removed.find(o=>o.id===child.id)!;assert.equal(kept.parent,undefined);near(kept.y,FLOOR_Y);
 const round=serializeRoomLayout({source:'authored',firstRoomEditCompleted:true,objects:all});assert.deepEqual(parseRoomLayout(round).objects,all);
 const pub=publicVisualRoomLayout({...round,privateMedia:'secret'});assert.ok(JSON.stringify(pub).includes('parent'));assert.ok(!JSON.stringify(pub).includes('secret'));
 assert.equal(validRoomObjectRelationships([...all,{...child,id:'invalid',parent:{objectId:child.id,surfaceId:'desk'}}]),false);
 assert.throws(()=>attachRoomDecor(defaultRoomObject('large-plant'),deskA,'desk',parents),/floor_only/);
 // Real ray projection onto a side of the primary Desk creates an instance relationship.
 const point={x:deskA.x+1.1,y:deskA.y+.0825,z:deskA.z};const pose={position:{...point,y:point.y+3,z:point.z+1},lookAt:point};
 const projected=projectRoomObjectOntoWorld(200,400,400,800,pose,decor,parents,'content')!;assert.equal(projected.valid,true);assert.equal(projected.current.parent?.objectId,deskA.id);
 const large=projectRoomObjectOntoWorld(200,400,400,800,pose,defaultRoomObject('large-plant'),parents,'content')!;assert.equal(large.valid,false);
}
assert.throws(()=>removeFurnitureSafely([deskA],deskA.id),/binder_needs_desk/);
assert.equal(validRoomObjectRelationships([{...deskA}, {...deskB,binderDesk:true}]),false);
const surface=nativeRoomSurfaces('content',parents).find(s=>s.id===surfacesOwnedBy('content',deskA)[0])!;assert.ok(surface.reserved);
const collectible={geometry:'album',scale:1,position:{x:surface.x,y:surface.y,z:surface.z},rotation:{x:0,y:0,z:0}} as RoomRenderable;
const placed=previewOnSurface(collectible,surface,{x:surface.x,y:surface.y,z:surface.z});assert.ok(Math.abs(placed.position.x-surface.x)>.66);
const snapshot=buildFixtureRoomSnapshot(undefined,{ownStarter:true});const old=parseRoomLayout(snapshot.room.layout);
let many=cloneRoomObjects(starter.objects);for(const kind of SHOP_CATALOG)for(let i=0;i<2;i++)many.push(spawnRoomObject(many,kind));many=normalizeBinderDesk(many);
const parent=many.find(o=>o.binderDesk)!;many.push(attachRoomDecor({...defaultRoomObject('table-lamp','parented-demo'),x:parent.x+1.1,z:parent.z},parent,'desk',many));
saveDemoRoomLayout(snapshot.room.ownerUserId,{source:'authored',firstRoomEditCompleted:true,objects:many});const restored=buildFixtureRoomSnapshot(undefined,{ownStarter:true});assert.deepEqual(parseRoomLayout(restored.room.layout).objects,many);assert.deepEqual(restored.holdings,snapshot.holdings);saveDemoRoomLayout(snapshot.room.ownerUserId,old);
for(const binder of ROOM_BINDER_IDS){const style=parseRoomStyle({...snapshot.room.style,binder});assert.notEqual(resolveRoomLook(style).binder,'#4a1c2c');saveDemoRoomStyle(snapshot.room.ownerUserId,style);assert.equal(buildFixtureRoomSnapshot(undefined,{ownStarter:true}).room.style?.binder,binder);}saveDemoRoomStyle(snapshot.room.ownerUserId,snapshot.room.style!);
assert.equal(parseRoomStyle({}).binder,'cream');
const binderSource=read('apps/mobile/src/room/NativeOpenBinder.tsx');for(const visual of ['StandingBinder','torusGeometry','sheet','side*0.49','group.current.visible = true'])assert.ok(binderSource.includes(visual));
assert.ok(read('apps/mobile/src/room/RoomStyleSheet.tsx').includes('copy.styleBinder'));
assert.ok(read('supabase/migrations/20261004000000_native_room_layout.sql').includes("parent_obj ? 'parent'"));
console.log('Content: 12-kind Shop, local decor parenting/reparent/floor/30° transforms, anchor transfer/protection, reservation, Demo ownership/style and public-safe relationships passed');
