/** Exercise actual native screen gesture callbacks with deterministic timers. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8');
const ast=ts.createSourceFile('screen.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const edit=require('../.tmp/build/apps/mobile/src/room/touchEdit.js');
const names=['clearPendingPress','clearHeldVisual','onObjectPressStart','onObjectPressEnd','onCollectiblePressStart','closeBinder','beginEditing','applyLoadedLayout'];
const chunks=[];let responder,focus;const stage={};
function visit(n){
 if(ts.isCallExpression(n)&&n.expression.getText(ast)==='useFocusEffect') focus=n.arguments[0].arguments[0].getText(ast);
 if(ts.isFunctionDeclaration(n)&&names.includes(n.name?.text))chunks.push(n.getText(ast));
 if(ts.isVariableDeclaration(n)&&n.name.getText(ast)==='panResponder')responder=n.initializer.getText(ast);
 if(ts.isJsxAttribute(n)&&['onTouchStart','onTouchEnd','onTouchCancel'].includes(n.name.getText(ast)))stage[n.name.getText(ast)]=n.initializer.expression.getText(ast);
 ts.forEachChild(n,visit);
}visit(ast);
const ref=current=>({current}),noop=()=>{};let now=0,nextTimer=0;const timers=new Map();
const s={demo:false,liveSync:{cancelLoad:noop},exports:{},PanResponder:{create:x=>x},viewRef:ref({kind:'edit'}),activeTouchesRef:ref(0),touchOwnerRef:ref(null),dragOwnerRef:ref(null),heldRef:ref(null),queuedStorageRef:ref(null),latestItems:ref([]),heldObjectRef:ref(null),previewRef:ref(null),objectPreviewRef:ref(null),furnitureCarryRef:ref(null),highlightSurfaceIdRef:ref(null),pendingPressRef:ref(null),gestureRef:ref({objectDrag:false}),latestObjects:ref([{id:'desk',kind:'desk',binderDesk:true,x:0,y:-1,z:0}]),snapshotRef:ref({room:{id:'touch-room'}}),shopSaving:ref(false),reducedMotionRef:ref(true),suppressTapRef:ref(false),exploreRef:ref({x:0}),readOnly:false,LONG_PRESS_MS:edit.LONG_PRESS_MS,LONG_PRESS_SLOP_PX:12,setHeldId:noop,setHeldObjectId:noop,setPlacingItem:noop,setHelperKind:noop,setSelectedId:noop,setSelectedObjectId:noop,acquireHeld:edit.acquireHeld,cloneRenderable:edit.cloneRenderable,withResolvedWorld:x=>x,acquireRoomObject:o=>({objectId:o.id,origin:o,current:o,valid:true}),resolveRoomObjectTransform:o=>o,liftRoomObject:o=>o,exploreAllowedForView:()=>true,touchSpan:e=>e.nativeEvent.touches.length>=2?100:0,nudgeExploreFromDrag:(o,x)=>({x:o.x+x}),nudgeExploreFromPinch:()=>({x:999}),applyExploreOffset:x=>x,poseForView:()=>({}),layoutRef:ref({width:100,height:100,x:0,y:0}),projectRoomObjectOntoWorld:()=>({current:{x:5},valid:false}),turnDir:0,binderSpreadIndex:0,spreads:[],setTimeout:(cb,ms)=>{const id=++nextTimer;timers.set(id,{cb,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};
Object.assign(s,{selectedRef:ref(null),binderReturnRef:ref(null),homeExploreRef:ref({}),editBaseline:ref([]),objectBaseline:ref([]),styleBaseline:ref({}),firstEntryRef:ref(false),layoutStateRef:ref({objects:s.latestObjects.current}),roomStyle:{},items:[],undoStack:ref([]),redoStack:ref([]),IDENTITY_EXPLORE:{},cloneRenderables:x=>x,cloneRoomObjects:x=>x,shouldAutoEnterFirstRoomEdit:()=>false,setCanUndo:noop,setCanRedo:noop,setShopOpen:noop,setOwnerName:noop,showHelper:noop,setRoomLayout:noop,refresh:noop});
s.setSelectedObjectId=id=>s.selectedObjectId=id;s.setSelectedId=id=>s.selectedId=id;s.setView=view=>s.viewRef.current=view;
vm.createContext(s);
const text=`exports.focus=${focus};\n`+chunks.join('\n')+`\nexports.pan=${responder};\n`+Object.entries(stage).map(([k,v])=>`exports.${k}=${v};`).join('\n')+'\n'+names.map(n=>`exports.${n}=${n};`).join('\n');
vm.runInContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,s);
const a=s.exports;let releases=0;s.releaseHeldObject=()=>{releases++;a.clearHeldVisual()};s.releaseHeld=()=>a.clearHeldVisual();
const event=(...ids)=>({nativeEvent:{touches:ids.map(id=>({identifier:String(id)}))}});
const tick=ms=>{now+=ms;for(const [id,t] of timers)if(t.at<=now){timers.delete(id);t.cb()}};
assert.equal(s.heldObjectRef.current,null,'entry/starter anchor never acquires gesture');
// Selected Desk and Shop selection do not own empty-world movement.
s.selectedObjectId='desk';a.onTouchStart(event(1));assert.equal(a.pan.onMoveShouldSetPanResponderCapture(event(1),{dx:20,dy:0}),true);a.pan.onPanResponderGrant(event(1));a.pan.onPanResponderMove(event(1),{dx:20,dy:0});assert.equal(s.exploreRef.current.x,20);assert.equal(s.latestObjects.current[0].x,0);assert.equal(s.heldObjectRef.current,null);a.onTouchEnd(event());
// Early release outside mesh must cancel timer without needing mesh pointer-up.
a.onTouchStart(event(2));a.onObjectPressStart('desk',2);tick(edit.LONG_PRESS_MS-1);assert.equal(s.heldObjectRef.current,null);a.onTouchEnd(event());tick(1);assert.equal(s.heldObjectRef.current,null);assert.equal(timers.size,0);
// Actual object-origin long press acquires only its initiating pointer.
a.onTouchStart(event(3));a.onObjectPressStart('desk',3);tick(edit.LONG_PRESS_MS);assert.equal(s.heldObjectRef.current.objectId,'desk');assert.equal(s.dragOwnerRef.current,'3');a.pan.onPanResponderGrant(event(3));a.pan.onPanResponderMove(event(3),{dx:20,dy:0,moveX:20,moveY:0});assert.equal(s.heldObjectRef.current.current.x,5);a.onTouchEnd(event());assert.equal(releases,1);assert.equal(s.dragOwnerRef.current,null);assert.equal(s.heldObjectRef.current,null);
// No stale ownership after release, cancellation, unrelated pointer or pinch.
a.onTouchStart(event(4));a.onObjectPressStart('desk',4);tick(edit.LONG_PRESS_MS);a.pan.onPanResponderMove(event(9),{dx:20,dy:0});assert.equal(s.heldObjectRef.current,null);
a.onTouchStart(event(5));a.onObjectPressStart('desk',5);a.onTouchCancel(event());tick(edit.LONG_PRESS_MS);assert.equal(s.heldObjectRef.current,null);assert.equal(s.dragOwnerRef.current,null);
a.onTouchStart(event(6));a.onObjectPressStart('desk',6);tick(edit.LONG_PRESS_MS);a.onTouchStart(event(6,7));assert.equal(s.heldObjectRef.current,null);a.pan.onPanResponderGrant(event(6,7));a.pan.onPanResponderMove(event(6,7),{dx:10,dy:0});assert.equal(s.exploreRef.current.x,999);
a.onTouchStart(event(8));a.onObjectPressStart('desk',8);tick(edit.LONG_PRESS_MS);a.pan.onPanResponderTerminate();assert.equal(s.heldObjectRef.current,null);assert.equal(s.touchOwnerRef.current,null);
const storageItem={holding:{id:'stored',template:{kind:'album'}},geometry:'album',scale:1,position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0}};
s.queuedStorageRef.current={holdingId:'stored',origin:null,preview:storageItem,rest:storageItem,valid:false};
a.onTouchStart(event(10));a.pan.onPanResponderGrant(event(10));a.pan.onPanResponderMove(event(10),{dx:20,dy:0});assert.ok(s.queuedStorageRef.current);assert.equal(s.heldRef.current,null);a.onTouchEnd(event());
a.onTouchStart(event(11));a.onCollectiblePressStart('stored',11);tick(edit.LONG_PRESS_MS);assert.equal(s.heldRef.current.holdingId,'stored');assert.equal(s.heldRef.current.origin,null);assert.equal(s.queuedStorageRef.current,null);a.onTouchCancel(event());
// Live photocards cannot acquire the generic Room free-drag gesture.
const cardItem={...storageItem,holding:{id:'card',template:{kind:'photocard'}},geometry:'photocard'};
s.queuedStorageRef.current={holdingId:'card',origin:null,preview:cardItem,rest:cardItem,valid:false};
a.onTouchStart(event(12));a.onCollectiblePressStart('card',12);tick(edit.LONG_PRESS_MS);assert.equal(s.heldRef.current,null);a.onTouchCancel(event());
assert.ok(source.includes('gestureRef.current.lastDx = gestureRef.current.lastDy = 0;'),'loaded/first Room entry neutralizes touch');
assert.ok(source.includes('gestureRef.current.pinching = false;\n    styleBaseline'),'Edit entry neutralizes touch');
s.selectedObjectId='desk';s.selectedId='card';s.viewRef.current={kind:'edit'};a.focus();assert.equal(s.selectedObjectId,null);assert.equal(s.selectedId,null);assert.equal(s.viewRef.current.kind,'home');
s.selectedObjectId='desk';a.beginEditing();assert.equal(s.selectedObjectId,null);assert.equal(s.viewRef.current.kind,'edit');
s.selectedObjectId='desk';a.applyLoadedLayout({source:'authored',objects:s.latestObjects.current,firstRoomEditCompleted:true},false);assert.equal(s.selectedObjectId,null);
s.selectedObjectId='desk';s.binderReturnRef.current={view:{kind:'home'},explore:{}};s.viewRef.current={kind:'binder'};a.closeBinder();assert.equal(s.selectedObjectId,null);assert.equal(s.selectedId,null);assert.equal(s.viewRef.current.kind,'home');assert.ok(s.latestObjects.current[0].binderDesk,'primary identity stays independent');
console.log('Physical repair actual screen callbacks: neutral entry, selected-world pan, exact pointer/long-press ownership, outside-release timer cleanup, cancel, pinch and termination passed');
