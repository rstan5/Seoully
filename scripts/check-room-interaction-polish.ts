import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BACK_WALL, ROOM_BOX } from "../apps/mobile/src/room/envelope";
import { ROOM_LAYOUT } from "../apps/mobile/src/room/roomLayout";
import { FLOOR_Y, furnitureGroundY } from "../apps/mobile/src/room/roomGrounding";
import { SHOP_CATALOG, TURNABLE_ROOM_OBJECT_KINDS, CARRIER_ROOM_OBJECT_KINDS, defaultRoomObject, normalizeBinderDesk, spawnRoomObject, turnRoomObject, rotatedRoomObjectFootprint, cloneRoomObjects, serializeRoomLayout, parseRoomLayout, surfacesOwnedBy, clampRoomObject, deskBinderWorld, liveDeskBinderWorld, liveDeskBinderYaw, objectPointFromAuthored } from "../apps/mobile/src/room/roomObjects";
import { resolveRoomWorldTransform, asAuthoredRenderable, liveZoneDock, inspectItemAtWorld } from "../apps/mobile/src/room/roomWorldTransform";
import { nativeRoomSurfaces, surfaceAcceptsGeometry, surfaceWorldPoint, surfaceLocalPoint, type RoomRenderable } from "../apps/mobile/src/room/model";
import { previewOnSurface, intersectSurface, projectTouchOntoSurfaces } from "../apps/mobile/src/room/touchEdit";
import { projectRoomObjectOntoWorld } from "../apps/mobile/src/room/roomObjectEdit";
import { pushPlacementHistory, isObjectHistory, type PlacementHistoryEntry } from "../apps/mobile/src/room/editSession";
import { DESK_BINDER_AT, ZONE_DOCKS } from "../apps/mobile/src/room/camera";
import { photoStringAttachmentWorld } from "../apps/mobile/src/room/photoString";
import { visibleLowerBound, extentsForGeometry } from "../apps/mobile/src/room/representation";

const near = (a: number, b: number, message = "coordinate") => assert.ok(Math.abs(a-b) < 1e-8, `${message}: ${a} / ${b}`);
const pointNear = (a: {x:number;y:number;z:number}, b: {x:number;y:number;z:number}) => { for (const key of ["x","y","z"] as const) near(a[key],b[key]); };
const floorKinds = SHOP_CATALOG.filter((kind) => kind !== "wall-frame" && kind !== "photo-string");
assert.deepEqual([...TURNABLE_ROOM_OBJECT_KINDS].sort(), [...floorKinds].sort());
for (const kind of SHOP_CATALOG) {
  const before = defaultRoomObject(kind);
  if (!TURNABLE_ROOM_OBJECT_KINDS.has(kind)) { assert.equal(turnRoomObject(before),before); continue; }
  let turned = before;
  for (const angle of [30,60,90,120,150,180,210,240,270,300,330,0]) {
    turned = turnRoomObject(turned);
    assert.equal(turned.rotateY, angle);
    near(turned.y, furnitureGroundY(kind));
    const foot = rotatedRoomObjectFootprint(turned);
    assert.ok(Math.abs(turned.x)+foot.halfX <= ROOM_BOX.wallX-0.16+1e-8);
    assert.ok(turned.z-foot.halfZ >= ROOM_BOX.backZ+0.22-1e-8);
    assert.ok(turned.z+foot.halfZ <= 1.65+1e-8);
  }
  const center = clampRoomObject({...before,x:0,z:-1});
  const centerTurn = turnRoomObject(center);
  near(centerTurn.x,center.x); near(centerTurn.z,center.z);
  const document = serializeRoomLayout({source:"authored",firstRoomEditCompleted:true,objects:[centerTurn]});
  assert.deepEqual(parseRoomLayout(document).objects,normalizeBinderDesk([centerTurn]));
}
const roomId = "interaction-polish";
for (const kind of CARRIER_ROOM_OBJECT_KINDS) {
  const parent = defaultRoomObject(kind);
  const surfaceId = surfacesOwnedBy(roomId,parent)[0];
  const surfaces = nativeRoomSurfaces(roomId,[parent]);
  const surface = surfaces.find((s)=>s.id===surfaceId)!;
  const authored = {geometry:"album",scale:1,position:{x:surface.x+0.12,y:surface.y+0.23,z:surface.z+0.07},rotation:{x:0,y:0.2,z:0},placement:{surfaceId}} as RoomRenderable;
  const original = JSON.stringify(authored);
  let turned = clampRoomObject({...parent,x:0,z:0,rotateY:90});
  for (const angle of [90,180,270,0] as const) {
    turned = clampRoomObject({...turned,rotateY:angle});
    const world = resolveRoomWorldTransform(authored,roomId,[turned]);
    const localX = authored.position.x-parent.x, localZ = authored.position.z-parent.z;
    const expected = angle===90 ? [localZ,-localX] : angle===180 ? [-localX,-localZ] : angle===270 ? [-localZ,localX] : [localX,localZ];
    near(world.position.x,turned.x+expected[0]); near(world.position.z,turned.z+expected[1]);
    near(world.rotation.y,authored.rotation.y+angle*Math.PI/180);
    const landing = nativeRoomSurfaces(roomId,[turned]).find((s)=>s.id===surfaceId)!;
    near(world.position.y+visibleLowerBound("album",world.fittedScale,world.rotation),landing.y+0.002);
    assert.equal(landing.rotateY,angle);
    const hitPoint=surfaceWorldPoint({x:0.1,y:0,z:0.05},landing);
    assert.equal(intersectSurface({origin:{...hitPoint,y:hitPoint.y+2},dir:{x:0,y:-1,z:0}},landing)?.inBounds,true);
    const outside=surfaceWorldPoint({x:landing.width/2+0.2,y:0,z:0},landing);
    assert.equal(intersectSurface({origin:{...outside,y:outside.y+2},dir:{x:0,y:-1,z:0}},landing)?.inBounds,false);
    const preview = previewOnSurface({...authored, rotation:world.rotation}, landing, outside);
    const clampedLocal=surfaceLocalPoint(preview.position,landing);
    assert.ok(Math.abs(clampedLocal.x)<=landing.width/2);
    const roundTrip=asAuthoredRenderable({...authored,...world},roomId,[turned]);
    near(roundTrip.position.x,authored.position.x); near(roundTrip.position.z,authored.position.z); near(roundTrip.rotation.y,authored.rotation.y);
    pointNear(inspectItemAtWorld(authored,roomId,[turned]).position,world.position);
    const carry={roomId,origin:parent,current:turned};
    pointNear(resolveRoomWorldTransform(authored,roomId,[parent],carry).position,world.position);
    const worldAgain=resolveRoomWorldTransform(roundTrip,roomId,[turned]);
    pointNear(worldAgain.position,world.position); near(worldAgain.rotation.y,world.rotation.y);
  }
  assert.equal(JSON.stringify(authored),original,"rotation does not rewrite authored placement");
}
const desk = clampRoomObject({...defaultRoomObject("desk"),x:0,z:0,rotateY:90});
pointNear(deskBinderWorld([desk])!,objectPointFromAuthored(DESK_BINDER_AT,desk));
pointNear(liveDeskBinderWorld([defaultRoomObject("desk")],desk)!,deskBinderWorld([desk])!);
assert.equal(liveDeskBinderYaw([desk]),90);
pointNear(liveZoneDock("desk",[desk]).lookAt,objectPointFromAuthored(ZONE_DOCKS.desk.lookAt,desk));
const spawned = spawnRoomObject([desk], "chair");
const deskFoot=rotatedRoomObjectFootprint(desk), chairFoot=rotatedRoomObjectFootprint(spawned);
assert.ok(Math.abs(spawned.x-desk.x)>=deskFoot.halfX+chairFoot.halfX+0.08 || Math.abs(spawned.z-desk.z)>=deskFoot.halfZ+chairFoot.halfZ+0.08, "Shop spawn respects already-rotated furniture footprint");
const nearWall=clampRoomObject({...defaultRoomObject("desk"),x:100,z:-100,rotateY:90});
const newTurn=turnRoomObject(nearWall);
assert.ok(newTurn.x <= nearWall.x && newTurn.z >= nearWall.z,"rotation makes only inward boundary correction");
const undo: PlacementHistoryEntry<RoomRenderable>[]=[]; const redo: PlacementHistoryEntry<RoomRenderable>[]=[];
pushPlacementHistory(undo,redo,{before:{storedHoldingId:desk.id},after:{storedHoldingId:desk.id},objectsBefore:cloneRoomObjects([nearWall]),objectsAfter:cloneRoomObjects([newTurn]),childrenBefore:[],childrenAfter:[]});
assert.equal(undo.length,1); const entry=undo.pop()!; assert.ok(isObjectHistory(entry)); redo.push(entry);
assert.deepEqual(entry.objectsBefore,[nearWall]); assert.deepEqual(redo.pop()!.objectsAfter,[newTurn]);
const { saveDemoRoomLayout, buildFixtureRoomSnapshot } = require("../apps/mobile/src/room/demoRoom") as typeof import("../apps/mobile/src/room/demoRoom");
const demoBefore=buildFixtureRoomSnapshot(undefined,{ownStarter:true});
const demoOwner=demoBefore.room.ownerUserId;
const demoLayout=demoBefore.room.layout;
saveDemoRoomLayout(demoOwner,{source:"authored",firstRoomEditCompleted:true,objects:[desk]});
assert.equal(parseRoomLayout(buildFixtureRoomSnapshot(undefined,{ownStarter:true}).room.layout).objects[0].rotateY,90);
saveDemoRoomLayout(demoOwner,parseRoomLayout(demoLayout));
near(BACK_WALL.maxX-BACK_WALL.minX,ROOM_LAYOUT.wallX*2-0.08);
near(BACK_WALL.minY,FLOOR_Y+ROOM_LAYOUT.baseboardHeight+0.04);
near(BACK_WALL.maxY,ROOM_LAYOUT.backWallCenterY+ROOM_LAYOUT.backWallHeight/2-0.04);
const wall = nativeRoomSurfaces(roomId,[]).find((s)=>s.kind==="wall")!;
near(wall.width,BACK_WALL.maxX-BACK_WALL.minX); near(wall.depth,BACK_WALL.maxY-BACK_WALL.minY);
assert.equal(nativeRoomSurfaces(roomId,[]).filter((s)=>s.kind==="wall").length,1,"back wall only");
for (const kind of ["wall-frame","photo-string"] as const) {
  const base=defaultRoomObject(kind);
  const extremes=[[-100,-100],[100,-100],[-100,100],[100,100]];
  for (const [x,y] of extremes) {
    const result=clampRoomObject({...base,x,y});
    assert.ok(Math.abs(result.x)>1.9,"wall object reaches beyond old center zone");
    assert.ok(result.y<0 || result.y>2.5,"reaches low/high wall");
    near(result.z,BACK_WALL.z); assert.equal(result.rotateY,0);
    const halfWidth=kind==="wall-frame"?0.66:1.38;
    assert.ok(result.x-halfWidth>=BACK_WALL.minX-1e-8 && result.x+halfWidth<=BACK_WALL.maxX+1e-8);
    const lower=kind==="wall-frame"?-0.76:-0.68, upper=kind==="wall-frame"?0.76:0.035;
    assert.ok(result.y+lower>=BACK_WALL.minY-1e-8 && result.y+upper<=BACK_WALL.maxY+1e-8);
    if (kind==="photo-string") for (let slot=0;slot<5;slot++) {
      const at=photoStringAttachmentWorld(result,slot), originalAt=photoStringAttachmentWorld(base,slot);
      near(at.x-originalAt.x,result.x-base.x); near(at.y-originalAt.y,result.y-base.y);
    }
  }
  // Rays across the full wall, including off-edge touches, remain valid and clamp continuously.
  for (const point of [{x:BACK_WALL.minX,y:BACK_WALL.minY,z:BACK_WALL.z},{x:BACK_WALL.maxX,y:BACK_WALL.maxY,z:BACK_WALL.z},{x:0,y:1,z:BACK_WALL.z}]) {
    const pose={position:{...point,z:point.z+2},lookAt:point};
    const projected=projectRoomObjectOntoWorld(200,400,400,800,pose,base)!;
    assert.equal(projected.valid,true); near(projected.current.z,BACK_WALL.z);
  }
}
const poster={geometry:"poster",scale:1,position:{x:0,y:1,z:wall.z},rotation:{x:0,y:0,z:0}} as RoomRenderable;
for (const x of [BACK_WALL.minX,BACK_WALL.maxX]) for(const y of [BACK_WALL.minY,BACK_WALL.maxY]) {
  const placed=previewOnSurface(poster,wall,{x,y,z:wall.z}); const size=extentsForGeometry("poster");
  const target={x,y,z:wall.z};
  const candidate=projectTouchOntoSurfaces(200,400,400,800,{position:{...target,z:target.z+2},lookAt:target},roomId,poster,false,[]);
  assert.equal(candidate?.valid,true); assert.equal(candidate?.surface.kind,"wall");
  assert.ok(placed.position.x-size.x/2>=BACK_WALL.minX-1e-8 && placed.position.x+size.x/2<=BACK_WALL.maxX+1e-8);
  assert.ok(placed.position.y-size.y/2>=BACK_WALL.minY-1e-8 && placed.position.y+size.y/2<=BACK_WALL.maxY+1e-8);
}
assert.equal(surfaceAcceptsGeometry(wall,"album"),false); assert.equal(surfaceAcceptsGeometry(wall,"poster"),true);
assert.equal(surfaceAcceptsGeometry(nativeRoomSurfaces(roomId,[]).find((s)=>s.kind==="horizontal")!,"poster"),false);
const source=readFileSync("apps/mobile/src/room/RoomWorldScreen.tsx","utf8");
assert.ok(source.includes("options?.world ? next : withResolvedWorld"),"held world drop is not resolved twice");
assert.ok(source.includes("persistPlacement(held.rest, { world: true })"));
assert.ok(source.includes("TURNABLE_ROOM_OBJECT_KINDS.has(selectedRoomObject.kind)"));
assert.ok(readFileSync("apps/mobile/src/room/NativeOpenBinder.tsx","utf8").includes("liveDeskBinderYaw"));
console.log("Interaction polish universal rotation, inverse transforms, oriented surfaces, Binder, history, Demo and full-wall checks passed");
