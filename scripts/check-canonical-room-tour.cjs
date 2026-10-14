const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const jsx=(type,props)=>({type,props});
function named(file,name,scope){const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);return vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope)}
const load=named('scripts/check-archetype-room-arrival.cjs','load',{fs,vm,ts,jsx,require});
const intro=named('scripts/check-archetype-room-arrival.cjs','intro',{load,assert,jsx});
const room=tree=>tree.props.children[0];
const descendants=node=>node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(descendants)]:[];
const flush=()=>new Promise(setImmediate);
function history(){const rows=new Map();let failure=false;const mocks={'@react-native-async-storage/async-storage':{__esModule:true,default:{getItem:async key=>rows.get(key)??null,setItem:async(key,value)=>{if(failure)throw Error('disk');rows.set(key,value)}}}};const reopen=()=>load('apps/mobile/src/onboarding/roomArrival.ts',mocks);return {rows,reopen,fail:()=>failure=true,recover:()=>failure=false};}
async function enter(scene,stage='heart'){
 let tree=scene.render();room(tree).props.onLiveSnapshotReady({placements:[]});room(tree).props.onWorldReady();tree=scene.render();
 if(stage==='heart'){tree.props.children[2].props.onContinue();await flush();tree=scene.render();}
 if(stage==='heart'||stage==='room'){scene.fade();await flush();tree=scene.render();scene.tick();tree=scene.render();}
 room(tree).props.onLiveBinderConfirmed(['card']);
 if(['heart','room','binder'].includes(stage)){room(tree).props.onBinderArrivalReady();await flush();}
 return scene.render();
}
for(const stage of ['heart','room','binder','home','edit','profile','dismissed'])test(`presentation history restores ${stage} after module reload; never regresses from stale writes`,async()=>{
 const disk=history(),api=disk.reopen();await api.recordRoomArrivalStage('collector','card',stage);assert.equal(await disk.reopen().readRoomArrivalStage('collector','card'),stage);await api.recordRoomArrivalStage('collector','card','heart');assert.equal(await api.readRoomArrivalStage('collector','card'),stage);assert.equal(await api.readRoomArrivalStage('other','card'),'heart');
});
test('legacy seen record resumes final action without replay; malformed history fails safely',async()=>{
 const disk=history();disk.rows.set('seoully:first-room-arrival:collector:card','seen');assert.equal(await disk.reopen().readRoomArrivalStage('collector','card'),'profile');disk.rows.set('seoully:first-room-arrival:collector:card','broken');await assert.rejects(disk.reopen().readRoomArrivalStage('collector','card'),/history_invalid/);
});
test('canonical fresh entrance persists every completed segment; ownership proof alone never requests completion',async()=>{
 const disk=history(),api=disk.reopen(),stages=[];const scene=intro({presentationWrite:async stage=>{stages.push(stage);await api.recordRoomArrivalStage('collector','card',stage)}});let tree=await enter(scene);assert.equal(await api.readRoomArrivalStage('collector','card'),'home');assert.equal(scene.requests,0);assert.equal(room(tree).props.initialHoldingId,'card');
 scene.tick();await flush();tree=scene.render();assert.equal(await api.readRoomArrivalStage('collector','card'),'edit');scene.tick();await flush();tree=scene.render();assert.equal(await api.readRoomArrivalStage('collector','card'),'profile');assert.deepEqual(stages,['room','binder','home','edit','profile']);assert.equal(scene.requests,0);
 descendants(room(tree).props.roomGuidance).find(n=>n.props.onPress?.name==='requestDiscover').props.onPress();scene.render();await flush();scene.render();assert.equal(scene.requests,1);assert.equal(scene.profile,1);scene.cleanup();
});
for(const stage of ['home','edit','profile','dismissed'])test(`already-saved Holding resumes ${stage}: no cinematic or automatic Binder replay`,async()=>{
 const disk=history(),api=disk.reopen();await api.recordRoomArrivalStage('collector','card',stage);const scene=intro({initialStage:await api.readRoomArrivalStage('collector','card'),presentationWrite:next=>api.recordRoomArrivalStage('collector','card',next)});let tree=await enter(scene,stage);assert.equal(room(tree).props.initialHoldingId,undefined);assert.equal(tree.props.children.some(n=>n?.type==='Heart'),false);assert.equal(scene.requests,0);assert.equal(scene.timers,['home','edit'].includes(stage)?1:0);
 if(stage==='dismissed')assert.equal(room(tree).props.roomGuidance,null);else assert.ok(descendants(room(tree).props.roomGuidance).some(n=>n.props.children===(stage==='home'?'Home ♡':stage==='edit'?'Edit':'Find people')));
 scene.background();scene.render();assert.equal(scene.timers,0);scene.foreground();tree=scene.render();assert.equal(room(tree).props.initialHoldingId,undefined);scene.cleanup();
});
test('completed message segments survive force-close and no duplicate Binder command is issued on recovery',async()=>{
 const disk=history(),api=disk.reopen();const first=intro({presentationWrite:stage=>api.recordRoomArrivalStage('collector','card',stage)});await enter(first);first.tick();await flush();first.render();first.cleanup();const resumed=await disk.reopen().readRoomArrivalStage('collector','card');assert.equal(resumed,'edit');const second=intro({initialStage:resumed,presentationWrite:stage=>api.recordRoomArrivalStage('collector','card',stage)});let tree=await enter(second,resumed);assert.equal(room(tree).props.initialHoldingId,undefined);second.tick();await flush();tree=second.render();assert.equal(await api.readRoomArrivalStage('collector','card'),'profile');assert.equal(second.timers,0);second.cleanup();
});
test('language rerender keeps current segment and existing countdown; dismissal is durable',async()=>{
 const disk=history(),api=disk.reopen(),scene=intro({initialStage:'edit',presentationWrite:stage=>api.recordRoomArrivalStage('collector','card',stage)});await enter(scene,'edit');scene.copy.roomArrivalEdit='룸을 편집하며 놀아 보세요.';let tree=scene.render();assert.ok(descendants(room(tree).props.roomGuidance).some(n=>n.props.children===scene.copy.roomArrivalEdit));assert.equal(scene.timers,1);assert.equal(room(tree).props.initialHoldingId,undefined);descendants(room(tree).props.roomGuidance).find(n=>n.props.accessibilityLabel==='Close').props.onPress();await flush();scene.render();assert.equal(await api.readRoomArrivalStage('collector','card'),'dismissed');assert.equal(scene.timers,0);scene.cleanup();
});
test('failed checkpoint stays recoverable; retry persists before advancing; unmount rejects stale UI callbacks',async()=>{
 const disk=history(),api=disk.reopen(),scene=intro({initialStage:'home',presentationWrite:stage=>api.recordRoomArrivalStage('collector','card',stage)});await enter(scene,'home');disk.fail();scene.tick();await flush();let tree=scene.render();assert.equal(tree.type,'ErrorScreen');assert.equal(await api.readRoomArrivalStage('collector','card'),'heart');disk.recover();tree.props.children.props.onPress();await flush();tree=scene.render();assert.equal(await api.readRoomArrivalStage('collector','card'),'edit');assert.ok(descendants(room(tree).props.roomGuidance).some(n=>n.props.children==='Edit'));scene.cleanup();
 let release;const interrupted=intro({initialStage:'home',presentationWrite:()=>new Promise(r=>release=r)});await enter(interrupted,'home');interrupted.tick();interrupted.cleanup();release();await flush();assert.equal(interrupted.timers,0);
});
test('only manual Edit starts editing; normal Room and completed bootstrap cannot mount onboarding tour',()=>{
 const world=fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8');assert.match(world,/deferFirstRoomEdit = true/);for(const file of fs.readdirSync("apps/mobile/app")){if(file.endsWith(".tsx"))assert.doesNotMatch(fs.readFileSync(`apps/mobile/app/${file}`,"utf8"),/deferFirstRoomEdit=\{false\}/);}assert.match(world,/onEdit=\{beginEditing\}/);assert.match(world,/showHelper\("edit"\)/);const route=fs.readFileSync('apps/mobile/app/room.tsx','utf8');assert.doesNotMatch(route,/OnboardingWorldIntro/);assert.match(route,/router.replace\("\/\(tabs\)\/profile"\)/);assert.doesNotMatch(route,/router.back/);
});
