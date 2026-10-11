const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function loader(mocks={}, globals={}) {
 const cache=new Map();
 function load(file){file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const m={exports:{}};cache.set(file,m);
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{URL,...globals,module:m,exports:m.exports,console,require(name){
  if(Object.hasOwn(mocks,name))return mocks[name];
  if(name.startsWith('seoully-domain/'))return load('src/domain/'+name.slice(15)+'.ts');
  if(name.startsWith('.')) {let f=path.resolve(path.dirname(file),name);for(const suffix of ['.ts','.tsx','/index.ts'])if(fs.existsSync(f+suffix))return load(f+suffix);}
  return require(name);
 }});return m.exports;}return load;
}
const load=loader();
const {ownerRoomPreview,publicRoomPreview,nativeProfileTheme}=load('apps/mobile/src/room/profileRoom.ts');
const {DEFAULT_ROOM_STYLE,resolveRoomLook}=load('apps/mobile/src/room/roomStyle.ts');
const {identityPalette,contrastRatio}=load('apps/mobile/src/ui/profileContrast.ts');
const {identityPublicationSurvives}=load('apps/mobile/src/ui/shellLayout.ts');
const clean=x=>JSON.parse(JSON.stringify(x));
const styles=[{...DEFAULT_ROOM_STYLE,wall:'cream',floor:'oak',furniture:'oak'},{...DEFAULT_ROOM_STYLE,wall:'ink',floor:'charcoal',furniture:'ink'},{...DEFAULT_ROOM_STYLE,wall:'plum',floor:'walnut',furniture:'walnut'},{...DEFAULT_ROOM_STYLE,wall:'blush',floor:'blush-wood',furniture:'blush'}];
for(const style of styles) test(`${style.wall}: persisted Room drives sync and readable Profile controls`,()=>{
 const tokens=nativeProfileTheme({mode:'room-sync'},style),p=identityPalette(tokens,resolveRoomLook(style).void);
 assert.ok(contrastRatio(p.ink,p.mist)>=4.5);assert.ok(contrastRatio(p.onPrimary,p.action)>=4.5);
 assert.equal(tokens.mode,'room-sync');if(style.wall==='ink')assert.equal(p.scheme,'dark');
});
test('Default and Custom stay independent of Room edits',()=>{
 for(const choice of [{mode:'default'},{mode:'custom',background:'deep-navy',primary:'rose',secondary:'mint'}])
 assert.deepEqual(clean(nativeProfileTheme(choice,styles[0])),clean(nativeProfileTheme(choice,styles[1])));
 assert.notEqual(nativeProfileTheme({mode:'room-sync'},styles[0]).mist,nativeProfileTheme({mode:'room-sync'},styles[1]).mist);
});
test('missing public Room preserves explicit appearance and graceful sync fallback',()=>{
 assert.equal(publicRoomPreview('other',{owner:{userId:'other'},private:true,room:null}),null);
 assert.equal(nativeProfileTheme({mode:'custom',background:'charcoal'}).scheme,'dark');
 assert.equal(nativeProfileTheme({mode:'room-sync'}).mode,'room-sync');
});
test('public preview refuses another collector and never substitutes owner inventory',()=>{
 assert.throws(()=>publicRoomPreview('other',{owner:{userId:'self'},private:false,room:{}}),/mismatch/);
 const p=publicRoomPreview('other',{owner:{userId:'other'},private:false,room:{id:'public-room',style:styles[1],layout:{},placements:[]}});
 assert.equal(p.id,'public-room');assert.equal(p.style.wall,'ink');assert.equal(p.holdings.length,0);assert.equal(p.items.length,0);
});
test('actual saved objects and style survive preview; no invented placements',()=>{
 const object={id:'saved-desk',kind:'desk',x:0.5,y:0,z:-3,yaw:0,binderDesk:true};
 const room={id:'owner-room',style:styles[2],layout:{version:1,objects:[object]},placements:[]};
 const p=ownerRoomPreview(room,[]);assert.equal(p.style.wall,'plum');assert.equal(p.objects[0].id,'saved-desk');assert.equal(p.objects[0].x,0.5);assert.equal(p.items.length,0);
});
test('identity publication is confined to collector navigation',()=>{
 for(const route of ['/profile','/collector','/room','/collector-room'])assert.equal(identityPublicationSurvives(route),true);
 for(const route of ['/','/search','/create','/messages'])assert.equal(identityPublicationSurvives(route),false);
});
function harness({publicRead=async()=>({owner:{userId:'other'},private:false,room:null}),rows=[]}={}) {
 let state=[],index=0,focus;const reads=[];
 const react={useCallback:f=>f,useMemo:f=>f(),useState(initial){const i=index++;if(!(i in state))state[i]=initial;return [state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value}];}};
 const db={from(table){const q={select(columns){reads.push({table,columns});return q},eq(){return q},order(){return q},range(){return q},maybeSingle:async()=>({data:rows[0]??null,error:null}),then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q;}};
 const {useProfileRoom,readOwnerProfileRoom}=loader({'react':react,'expo-router':{useFocusEffect:f=>{focus=f}},'../api':{loadCollectorRoom:publicRead},'../supabase':{supabase:db}})('apps/mobile/src/room/useProfileRoom.ts');
 return {render(user='other',own=false){index=0;return useProfileRoom(user,own,false,[])},focus:()=>focus(),readOwnerProfileRoom,reads};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('blocking preview hydration completes without starter data',async()=>{
 const h=harness();assert.equal(h.render().ready,false);const blur=h.focus();await tick();assert.equal(h.render().ready,true);assert.equal(h.render().preview,null);blur();
});
test('blur discards late hydration; collector switch never exposes previous preview',async()=>{
 let resolve;const h=harness({publicRead:()=>new Promise(r=>resolve=r)});h.render();const blur=h.focus();blur();resolve({owner:{userId:'other'},private:false,room:null});await tick();assert.equal(h.render().ready,false);assert.equal(h.render('new-user').preview,null);
});
test('read failures are reachable and retryable',async()=>{
 let fail=true;const h=harness({publicRead:async()=>{if(fail)throw Error('offline');return {owner:{userId:'other'},private:false,room:null}}});
 h.render();h.focus();await tick();const failed=h.render();assert.equal(failed.failed,true);fail=false;failed.retry();h.render();h.focus();await tick();assert.equal(h.render().failed,undefined);assert.equal(h.render().ready,true);
});
test('owner preview reads only rooms/placements and never creates a missing Room',async()=>{
 const h=harness();assert.equal(await h.readOwnerProfileRoom('self'),null);assert.deepEqual(h.reads.map(r=>r.table),['rooms']);
 const p=harness({rows:[{id:'saved',style:styles[0],layout:{}}]});await p.readOwnerProfileRoom('self');assert.deepEqual(p.reads.map(r=>r.table),['rooms','room_placements']);
});
test('real shared renderer uses HOME_POSE, focus subscription and demand Profile frames',()=>{
 const glimpse=fs.readFileSync('apps/mobile/src/room/RoomWorldGlimpse.tsx','utf8');
 const renderer=fs.readFileSync('apps/mobile/src/room/NativeRoomRenderer.tsx','utf8');
 assert.match(glimpse,/<NativeRoomRenderer presentation="profile"/);assert.doesNotMatch(glimpse,/styles\.rug|roomPalette|<Canvas/);
 assert.match(renderer,/HOME_POSE\.position\.x/);assert.match(renderer,/HOME_POSE\.lookAt\.x/);assert.match(renderer,/presentation === "profile" \? "demand"/);
 assert.match(renderer,/if \(!isFocused\) return null/);assert.match(renderer,/return \(\) => \{ focus\(\); blur\(\); \}/);
});
test('Edit Profile saves complete appearance and adopts only confirmed response',()=>{
 const edit=fs.readFileSync('apps/mobile/app/edit-profile.tsx','utf8');
 assert.match(edit,/appearance,\n/);assert.match(edit,/setAppearance\(saved.identity.profile.appearance\)/);assert.match(edit,/profile_save_unconfirmed/);assert.match(edit,/setMessage\(copy.profileSaveFailed\)/);
 const editor=fs.readFileSync('apps/mobile/src/ui/ProfileAppearanceEditor.tsx','utf8');assert.match(editor,/BACKGROUND_PRESETS.map/);assert.match(editor,/ACCENT_PICKER.map/);assert.match(editor,/accessibilityRole="radio"/);assert.match(editor,/themePresetLabel/);
});

test('only persisted placements enter owner preview; personal image association is retained',()=>{
 const h={id:'owned',templateId:'template',acquiredAt:'',tradeStatus:'not-for-trade',personalMediaUrl:'https://fixture.invalid/authorized',template:{id:'template',name:'Album',kind:'album',groupName:'Artist',status:'active'}};
 const p=ownerRoomPreview({id:'saved',style:styles[0],layout:{},placements:[{id:'place',roomId:'saved',holdingId:'owned',zoneId:'saved-desk',slot:0,offset:null,surfaceId:null,transform:{x:0,y:0,z:0}}]},[h,{...h,id:'unplaced'}]);
 assert.equal(p.items.length,1);assert.equal(p.items[0].holding.id,'owned');assert.equal(p.items[0].imageUrl,h.personalMediaUrl);
});
test('public projection carries only its authorized media, with no private locator fields',()=>{
 const p=publicRoomPreview('other',{owner:{userId:'other'},private:false,room:{id:'public',style:styles[0],layout:{},placements:[{id:'public-placement',zoneId:'public-desk',slot:0,offset:null,transform:{x:0,y:0,z:0},surfaceId:null,holding:{templateId:'template',tradeStatus:'not-for-trade',personalMediaUrl:'https://fixture.invalid/authorized',privateHoldingId:'private-id',bucket:'private-bucket',path:'private-path',template:{name:'Album',kind:'album'}}}]}});
 assert.equal(p.items.length,1);assert.equal(p.items[0].holding.id,'public-placement');
 assert.doesNotMatch(JSON.stringify(p),/private-id|private-bucket|private-path/);
});
test('returning from Room refreshes saved style without using default or another owner',async()=>{
 const row={id:'saved',style:styles[0],layout:{}};
 const h=harness({rows:[row]});h.render('self',true);let blur=h.focus();await tick();assert.equal(h.render('self',true).preview.style.wall,'cream');
 blur();row.style=styles[1];h.render('self',true);blur=h.focus();await tick();assert.equal(h.render('self',true).preview.style.wall,'ink');blur();
});

test('native authenticated transport sends appearance and reads confirmed preference again (mock HTTP)',async()=>{
 let appearance={mode:'default'};const requests=[];
 const fetch=async(url,options)=>{requests.push({url,options});if(options.method==='PATCH')appearance=JSON.parse(options.body).appearance;return {ok:true,json:async()=>({identity:{user:{id:'self'},profile:{appearance}}})};};
 const api=loader({'expo/fetch':{},'./media/photoUpload':{},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'fixture-token'}}})}}}}, {fetch,process:{env:{EXPO_PUBLIC_API_URL:'http://fixture.local:3000'}}})('apps/mobile/src/api.ts');
 const original=(await api.resolveNativeIdentity()).profile.appearance;
 const choice={mode:'custom',background:'charcoal',primary:'mint',secondary:'rose'};
 assert.deepEqual(clean((await api.updateNativeProfile({appearance:choice})).identity.profile.appearance),choice);
 assert.deepEqual(clean((await api.resolveNativeIdentity()).profile.appearance),choice);
 await api.updateNativeProfile({appearance:original});assert.deepEqual(clean((await api.resolveNativeIdentity()).profile.appearance),original);
 assert.ok(requests.every(r=>r.options.headers.Authorization==='Bearer fixture-token'));
});
for(const failed of [false,true]) test(`actual native Edit Profile save handler: ${failed?'failure preserves draft and stays open':'confirmed response adopted before back'}`,async()=>{
 const source=fs.readFileSync('apps/mobile/app/edit-profile.tsx','utf8');
 const saveSource=source.slice(source.indexOf('async function save()'),source.indexOf('  async function signOut()'));
 const events=[];const choice={mode:'room-sync'};
 const save=vm.runInNewContext(`(${saveSource})`,{social:{kind:'production'},busy:false,displayName:' Collector ',tagline:'',bio:'',location:'',appearance:choice,
  copy:{profileSaveFailed:'retry',demoWriteBlocked:'demo'},setBusy:v=>events.push(['busy',v]),setMessage:v=>events.push(['message',v]),
  setIdentity:v=>events.push(['identity',v]),setAppearance:v=>events.push(['appearance',v]),router:{back:()=>events.push(['back'])},
  updateNativeProfile:async payload=>{assert.deepEqual(clean(payload.appearance),choice);if(failed)throw Error('offline');return {identity:{profile:{appearance:choice}}};}});
 await save();if(failed){assert.ok(events.some(e=>e[0]==='message'&&e[1]==='retry'));assert.ok(!events.some(e=>e[0]==='back'||e[0]==='appearance'));}
 else{assert.deepEqual(clean(events.find(e=>e[0]==='appearance')[1]),choice);assert.ok(events.findIndex(e=>e[0]==='appearance')<events.findIndex(e=>e[0]==='back'));}
});
