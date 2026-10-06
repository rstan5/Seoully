import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { surfaceFitScale, rotatedRepresentationSize } from "../apps/mobile/src/room/surfaceFit";
import { nativeRoomSurfaces, buildRoomRenderables, buildPublicRoomRenderables } from "../apps/mobile/src/room/model";
import { defaultRoomObject, surfacesOwnedBy, legacyRoomObjects } from "../apps/mobile/src/room/roomObjects";
import { resolveRoomWorldTransform } from "../apps/mobile/src/room/roomWorldTransform";
import { visibleLowerBound } from "../apps/mobile/src/room/representation";
import { buildFixtureRoomSnapshot, resetDemoRoomSession } from "../apps/mobile/src/room/demoRoom";
const near=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8,`${a} / ${b}`);
const objects=[...legacyRoomObjects(),defaultRoomObject('chair')], roomId='fit';
const surfaces=nativeRoomSurfaces(roomId,objects);
const zero={x:0,y:0,z:0};
for(const kind of ['shelf','case','desk','chair','archive'] as const){
 const parent=objects.find(o=>o.kind===kind)!;
 const surface=surfaces.find(s=>s.id===surfacesOwnedBy(roomId,parent)[0])!;
 const item={geometry:'album' as const,scale:2,position:{x:surface.x,y:99,z:surface.z},rotation:zero,placement:{surfaceId:surface.id}};
 const original=JSON.stringify(item);
 const fitted=surfaceFitScale(item.geometry,item.scale,item.rotation,surface);
 assert.ok(fitted<=item.scale);
 const dimensions=rotatedRepresentationSize(item.geometry,zero);
 assert.ok(dimensions.x*fitted<surface.width && dimensions.z*fitted<surface.depth);
 if(surface.clearanceHeight!==undefined)assert.ok(dimensions.y*fitted<surface.clearanceHeight);
 for(const yaw of [0,30,60,120,150,210,330] as const){
  const moved=objects.map(o=>o.id===parent.id?{...o,rotateY:yaw}:o);
  const world=resolveRoomWorldTransform(item,roomId,moved);
  near(world.fittedScale,fitted);
  const landing=nativeRoomSurfaces(roomId,moved).find(s=>s.id===surface.id)!;
  near(world.position.y+visibleLowerBound(item.geometry,world.fittedScale,world.rotation),landing.y+.002);
 }
 assert.equal(JSON.stringify(item),original,'fitting never persists or mutates authored data');
}
const shelf=surfaces.find(s=>s.id.endsWith('shelf-bay-0'))!;
const top=surfaces.find(s=>s.id.endsWith('shelf-bay-3'))!;
assert.equal(top.clearanceHeight,undefined);
near(surfaceFitScale('photocard',.4,zero,shelf),.4);
near(surfaceFitScale('figure',.1,zero,shelf),.1);
near(surfaceFitScale('album',2,zero,surfaces.find(s=>s.id.endsWith('-floor'))),2);
const desk=surfaces.find(s=>s.id.endsWith('-desk'))!;
assert.ok(surfaceFitScale('album',1,zero,desk)>surfaceFitScale('album',1,zero,shelf));
for(const geometry of ['album','book','plushie','figure','lightstick','vinyl','photocard','apparel','generic'] as const){
 const size=rotatedRepresentationSize(geometry,zero), scale=surfaceFitScale(geometry,4,zero,shelf);
 assert.ok(size.y*scale<shelf.clearanceHeight! && size.z*scale<shelf.depth && size.x*scale<shelf.width);
}
resetDemoRoomSession();
for(const user of ['u-minji','u-soo',undefined]){
 const snapshot=buildFixtureRoomSnapshot(user);
 const dataBefore=JSON.stringify(snapshot);
 const items=buildRoomRenderables(snapshot.holdings,snapshot.placements);
 assert.ok(items.length>0,`fixture ${user} has representations`);
 const furniture=legacyRoomObjects();
 if(user==='u-minji') assert.ok(items.some(i=>i.geometry==='album'),'actual Minji albums tested');
 const publicItems=buildPublicRoomRenderables(snapshot.room.id,snapshot.placements.map(placement=>{
  const holding=snapshot.holdings.find(h=>h.id===placement.holdingId)!;
  return {...placement,holding:{templateId:holding.templateId,tradeStatus:holding.tradeStatus,template:{kind:holding.template.kind,name:holding.template.name}}};
 }));
 for(const item of [...items,...publicItems]){
  const world=resolveRoomWorldTransform(item,snapshot.room.id,furniture);
  const surface=nativeRoomSurfaces(snapshot.room.id,furniture).find(s=>s.id===item.placement?.surfaceId);
  if(surface?.clearanceHeight!==undefined){
   const size=rotatedRepresentationSize(item.geometry,item.rotation);
   assert.ok(size.y*world.fittedScale<surface.clearanceHeight,'generic fixture compartment fit');
  }
 }
 assert.equal(JSON.stringify(snapshot),dataBefore,'Holding/catalog/media/placement data unchanged');
 console.log(`Fixture ${user ?? 'Demo owner'}: ${items.length} owner / ${publicItems.length} public representations fit generically`);
}
const renderer=readFileSync('apps/mobile/src/room/NativeRoomRenderer.tsx','utf8');
assert.ok(renderer.includes('focused ? item.scale : world.fittedScale'),'inspection scale independent');
assert.ok(renderer.includes('scale={restWorld.fittedScale}'),'raycast geometry shares rendered fit');
const binder=readFileSync('apps/mobile/src/room/NativeOpenBinder.tsx','utf8');
assert.ok(binder.includes('Math.PI / 2 - Math.PI / 45'));
near(Math.PI-2*(Math.PI/2-Math.PI/45),8*Math.PI/180);
assert.ok(binder.includes('V_ANGLE * spreadAmount'),'reading geometry remains separate');
console.log('Physical repair: uniform local fit/contact/yaw, bounded Shelf/Case, unbounded top/floor, fixture paths, independent inspection/hits and 8° resting Binder passed');
