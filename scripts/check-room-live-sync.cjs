const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const moduleBox={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/mobile/src/room/liveRoomSync.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleBox,exports:moduleBox.exports});
const {LiveRoomSync,liveRoomNeedsHydration}=moduleBox.exports;
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('Live world is gated until hydration; Demo gating is unchanged',()=>{
  assert.equal(liveRoomNeedsHydration(false,true,false),true);
  assert.equal(liveRoomNeedsHydration(false,true,true),true);
  assert.equal(liveRoomNeedsHydration(false,false,false),true);
  assert.equal(liveRoomNeedsHydration(false,false,true),false);
  assert.equal(liveRoomNeedsHydration(true,true,false),false);
});
for(const kind of ['move','rotation'])test(`${kind} publishes immediately and acknowledgement never replays geometry`,async()=>{
  const sync=new LiveRoomSync(),request=deferred(),seen=[];
  const next={x:2,yaw:kind==='rotation'?90:0};
  const pending=sync.save('layout',next,{x:0,yaw:0},x=>seen.push(x),()=>request.promise);
  assert.equal(seen.at(-1),next);await tick();assert.equal(seen.length,1);
  request.resolve({x:0,yaw:0});await pending;assert.equal(seen.length,1);
});
test('rapid full-layout edits serialize writes and retain newest local layout',async()=>{
  const sync=new LiveRoomSync(),a=deferred(),b=deferred(),seen=[],writes=[];
  const first=sync.save('layout',1,0,x=>seen.push(x),()=>{writes.push(1);return a.promise});
  const second=sync.save('layout',2,0,x=>seen.push(x),()=>{writes.push(2);return b.promise});
  await tick();assert.deepEqual(writes,[1]);assert.equal(seen.at(-1),2);
  b.resolve();await tick();assert.deepEqual(writes,[1]); // early later response cannot advance the queue
  a.resolve();await Promise.all([first,second]);assert.deepEqual(writes,[1,2]);assert.deepEqual(seen,[1,2]);
});
test('failed latest save rolls back to last confirmed value and queue recovers',async()=>{
  const sync=new LiveRoomSync(),seen=[];
  await sync.save('layout',1,0,x=>seen.push(x),async()=>{});
  await assert.rejects(sync.save('layout',2,0,x=>seen.push(x),async()=>{throw Error('offline')}));
  assert.deepEqual(seen,[1,2,1]);
  await sync.save('layout',3,0,x=>seen.push(x),async()=>{});assert.equal(seen.at(-1),3);
});
test('older failure cannot roll back newer pending edit; later failure restores confirmed baseline',async()=>{
  const sync=new LiveRoomSync(),a=deferred(),b=deferred(),seen=[];
  const first=sync.save('layout',1,0,x=>seen.push(x),()=>a.promise);const fail=assert.rejects(first);
  const second=sync.save('layout',2,0,x=>seen.push(x),()=>b.promise);const fail2=assert.rejects(second);
  a.reject(Error('offline'));await fail;assert.deepEqual(seen,[1,2]);
  b.reject(Error('offline'));await fail2;assert.deepEqual(seen,[1,2,0]);
});
test('failure followed by successful newer edit preserves newer state',async()=>{
  const sync=new LiveRoomSync(),a=deferred(),seen=[];
  const first=sync.save('layout',1,0,x=>seen.push(x),()=>a.promise);const fail=assert.rejects(first);
  const second=sync.save('layout',2,0,x=>seen.push(x),async()=>{});
  a.reject(Error('offline'));await fail;await second;assert.deepEqual(seen,[1,2]);
});
test('stale hydration, replaced fetches, and blurred fetches cannot apply',async()=>{
  const sync=new LiveRoomSync();const old=sync.beginLoad();const newer=sync.beginLoad();
  assert.equal(sync.acceptsLoad(old),false);assert.equal(sync.acceptsLoad(newer),true);
  await sync.save('layout',1,0,()=>{},async()=>{});assert.equal(sync.acceptsLoad(newer),false);
  const blurred=sync.beginLoad();sync.cancelLoad();assert.equal(sync.acceptsLoad(blurred),false);
});
test('reentry waits for pending saves before fetching latest confirmed state',async()=>{
  const sync=new LiveRoomSync(),a=deferred();let fetched=false;
  const save=sync.save('layout',1,0,()=>{},()=>a.promise);
  const read=sync.idle().then(()=>{fetched=true});await tick();assert.equal(fetched,false);
  a.resolve();await save;await read;assert.equal(fetched,true);
});
test('placement removal is ordered after a pending placement save',async()=>{
  const sync=new LiveRoomSync(),a=deferred(),writes=[],seen=[];
  const save=sync.save('placement:id',1,0,x=>seen.push(x),()=>{writes.push('save');return a.promise});
  const remove=sync.save('placement:id',undefined,0,x=>seen.push(x),async()=>{writes.push('remove')});
  await tick();assert.deepEqual(writes,['save']);assert.equal(seen.at(-1),undefined);
  a.resolve();await save;await remove;assert.deepEqual(writes,['save','remove']);assert.equal(seen.at(-1),undefined);
});
// Execute the screen's actual persistence function with a delayed API, not a copy of its implementation.
test('screen layout save publishes refs/state synchronously, keeps new edits and reports failure',async()=>{
  const source=fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8');
  const fn=source.slice(source.indexOf('  async function persistLayout('),source.indexOf('  async function applyRoomObjects('));
  const requests=[],seen=[],errors=[];
  const context={demo:false,readOnly:false,snapshot:null,snapshotRef:{current:{room:{id:'room',layout:0}}},liveSync:new LiveRoomSync(),layoutStateRef:{current:0},latestObjects:{current:[]},normalizeBinderDesk:x=>x,serializeRoomLayout:x=>x,parseRoomLayout:x=>x,setRoomLayout:x=>seen.push(x),setSnapshot:()=>{},setError:x=>errors.push(x),copy:{roomSaveFailed:'failed'},saveNativeRoomLayout:()=>{const d=deferred();requests.push(d);return d.promise}};
  vm.createContext(context);vm.runInContext(ts.transpileModule(fn+'\nthis.persist=persistLayout;', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const first=context.persist({objects:[{x:1}]}),second=context.persist({objects:[{x:2}]});
  assert.equal(context.latestObjects.current[0].x,2);await tick();requests[0].resolve();await first;assert.equal(context.latestObjects.current[0].x,2);
  await tick();requests[1].reject(Error('offline'));assert.equal(await second,false);assert.equal(context.latestObjects.current[0].x,1);assert.deepEqual(errors,['failed']);
});
test('unmount/reopen uses shared write ordering before new screen hydration',async()=>{
  const oldScreen=new LiveRoomSync(),newScreen=new LiveRoomSync(),a=deferred();let fetched=false;
  const save=oldScreen.save('layout',1,0,()=>{},()=>a.promise);
  const load=newScreen.idle().then(()=>{fetched=true});await tick();assert.equal(fetched,false);
  a.resolve();await save;await load;assert.equal(fetched,true);
});
test('actual Live hydration applies only the newest response, never a starter snapshot',async()=>{
  const source=fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8');
  const start=source.indexOf('async () => {',source.indexOf('const refresh ='));
  const body=source.slice(start,source.indexOf('    // applyLoadedLayout',start))+'\n};';
  const requests=[],snapshots=[],layouts=[],loading=[];
  const context={demo:false,mode:'own',persistLive:true,liveSync:new LiveRoomSync(),copy:{roomUnavailable:'failed'},setLoading:x=>loading.push(x),loadNativeRoom:()=>{const d=deferred();requests.push(d);return d.promise},loadCollectorProfile:async()=>null,setSnapshot:x=>snapshots.push(x),setHoldings:()=>{},setItems:()=>{},setRoomStyle:()=>{},setOwnerName:()=>{},setPrivateRoom:()=>{},setError:()=>{},parseRoomStyle:x=>x,defaultStyleForTheme:()=>({}),parseRoomLayout:x=>x,applyLoadedLayout:x=>layouts.push(x),buildRoomRenderables:()=>[]};
  vm.createContext(context);vm.runInContext(ts.transpileModule('this.refresh='+body,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
  const first=context.refresh();await tick();assert.equal(snapshots.length,0);assert.equal(layouts.length,0);
  const second=context.refresh();await tick();
  requests[1].resolve({room:{layout:'saved-new'},holdings:[],placements:[]});await second;
  requests[0].resolve({room:{layout:'stale-old'},holdings:[],placements:[]});await first;
  assert.deepEqual(layouts,['saved-new']);assert.equal(snapshots.length,1);assert.equal(loading.at(-1),false);
});
