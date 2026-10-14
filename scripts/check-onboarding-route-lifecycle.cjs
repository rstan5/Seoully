// Uses the installed Expo stack reducer and production guard/component logic.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {StackRouter,StackActions}=require('../apps/mobile/node_modules/expo-router/build/react-navigation/routers/StackRouter');
function compile(text, scope={}) { return vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,scope); }
function named(file,name,scope) {const ast=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);return compile(`(${fn.getText(ast).replace(/^export /,'')})`,scope);}
const guards=named('apps/mobile/src/startup/routing.ts','screensForDestination');
const destination=named('apps/mobile/src/startup/eligibility.ts','resolveAuthDestination');
const tree=fs.readFileSync('apps/mobile/src/startup/AuthRouteTree.tsx','utf8');
function names(mode){const policy=guards(mode);return [...tree.matchAll(/<Stack.Protected guard=\{screens\.(\w+)\}>([\s\S]*?)<\/Stack.Protected>/g)].flatMap(([,key,children])=>policy[key]?[...children.matchAll(/<Stack.Screen name="([^"]+)"/g)].map(m=>m[1]):[]);}
function lifecycle(){
 const reducer=StackRouter({initialRouteName:'onboarding'});let mode='onboarding',pending=false,consume=()=>{};
 let options={routeNames:names(mode),routeParamList:{},routeGetIdList:{},routeKeyChanges:[]};let state=reducer.getInitialState(options);
 const reduce=action=>{const next=reducer.getStateForAction(state,action,options);if(next)state=next;return next};
 const reconcile=()=>{options={...options,routeNames:names(mode)};state=reducer.getStateForRouteNamesChange(state,options)};
 const active=()=>state.routes[state.index];
 // These are the actual replace/push/replace operations in onboarding, collect and add.
 reduce(StackActions.replace('collect'));reduce(StackActions.push('add'));reduce(StackActions.replace('onboarding'));
 let slots=[],cursor=0,effects=[],dispatches=0;
 const useRef=current=>{const i=cursor++;return slots[i]??(slots[i]={current})};
 const useEffect=(fn,deps)=>{const i=cursor++;if(!slots[i]||deps.some((v,j)=>v!==slots[i][j])){slots[i]=deps;effects.push(fn)}};
 const navigate=named('apps/mobile/src/startup/AuthRouteTree.tsx','AppEntryNavigation',{
  useRef,useEffect,startupTrace(){},onboardingTrace(){},useBootstrap:()=>({appEntryTarget:pending?"profile":null,consumeAppEntry(){pending=false;consume()}}),useAppNavigationState:()=>state,
  useRouter:()=>({replace(path){assert.equal(path,'/(tabs)/profile');dispatches++;assert.ok(reduce(StackActions.replace('(tabs)',{screen:'profile'})),'destination accepted by real router')}})
 });
 const render=()=>{cursor=0;effects=[];navigate();effects.forEach(fn=>fn())};
 return {get state(){return state},get pending(){return pending},get dispatches(){return dispatches},active,reduce,reconcile,render,
 applyBootstrap(boot){mode=boot.destination;pending=Boolean(boot.appEntryTarget);consume=boot.consumeAppEntry;reconcile()},
 complete(){mode=destination({authenticated:true,onboardingStep:'done'});pending=true;},
 fail(){mode=destination({authenticated:true,onboardingStep:'interest'});},
 focus(){const route=active();assert.equal(route.name,'(tabs)');route.state={key:'actual-child-mount',index:0,routes:[{name:route.params.screen}]};render()},
 remount(){slots=[]},};
}
test('reproduces original failure: real protected history retains collect; waiting for mounted tabs deadlocks',()=>{
 const h=lifecycle();assert.deepEqual(h.state.routes.map(r=>r.name),['collect','onboarding']);h.complete();h.reconcile();assert.equal(h.active().name,'collect');assert.equal(h.state.routes.some(r=>r.name==='(tabs)'),false);assert.equal(h.reduce(StackActions.replace('onboarding')),null,'old saved confirmation destination is forbidden');
});
test('completion dispatches from retained shared route; final resolved Profile survives guard and hydration reevaluation',()=>{
 const h=lifecycle();h.complete();h.render();assert.equal(h.dispatches,0,'old root registry is not ready');h.reconcile();h.render();assert.equal(h.active().name,'(tabs)');assert.equal(h.pending,true);h.focus();assert.equal(h.pending,false);for(let i=0;i<4;i++){h.reconcile();h.render();assert.equal(h.active().state.routes[0].name,'profile')}assert.equal(h.dispatches,1);
});
test('completion failure and delay retain onboarding; retry succeeds without any Holding creation',()=>{
 const h=lifecycle();h.fail();h.reconcile();h.render();assert.equal(h.active().name,'onboarding');assert.equal(h.dispatches,0);h.complete();h.reconcile();h.render();h.focus();assert.equal(h.active().state.routes[0].name,'profile');
});
test('repeated intent renders and layout remount do not replace focused Profile or consume intent early',()=>{
 const h=lifecycle();h.complete();h.reconcile();for(let i=0;i<5;i++)h.render();assert.equal(h.dispatches,1);assert.equal(h.pending,true);h.focus();h.remount();h.render();assert.equal(h.dispatches,1);assert.equal(h.pending,false);
});
test('saved confirmation Back and View in Room execute the same real handler and choose an allowed route',()=>{
 const source=fs.readFileSync('apps/mobile/app/add.tsx','utf8');const ast=ts.createSourceFile('add.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='viewSavedHolding')handler=n;ts.forEachChild(n,visit)}visit(ast);
 assert.match(source,/onPress=\{\(\) => viewSavedHolding\("back"\)\}/);assert.match(source,/onPress=\{\(\) => viewSavedHolding\("view"\)\}/);
 for(const completed of [false,true]){const h=lifecycle();if(completed){h.complete();h.reconcile()}
 const invoke=compile(`(${handler.getText(ast)})`,{onboardingTrace(){},boot:{destination:completed?'app':'onboarding',onboardingStep:completed?'done':'interest'},savedHoldingId:'test-only-saved-holding',fromOnboarding:true,copy:{},setMessage(){throw Error('unexpected navigation error')},router:{replace(target){assert.ok(h.reduce(StackActions.replace(target.pathname.slice(1),target.params)))}}});invoke();assert.equal(h.active().name,completed?'room':'onboarding');}
});
test('auth guard prevents a stale checkpoint from exposing onboarding after authoritative done',()=>{
 assert.equal(destination({authenticated:true,onboardingStep:'done'}),'app');assert.equal(guards('app').onboarding,false);assert.equal(guards('app').shared,true);assert.equal(destination({authenticated:false,onboardingStep:'done'}),'welcome');
});
test('diagnostics are dev-only and include no route parameters or private fields',()=>{
 const s=fs.readFileSync('apps/mobile/src/startup/onboardingTrace.ts','utf8');const module={exports:{}};const logs=[];compile(s,{module,exports:module.exports,__DEV__:false,console:{log:x=>logs.push(x)}});module.exports.onboardingTrace('test');assert.equal(logs.length,0);assert.doesNotMatch(s,/access_token|holdingId\??:|userId\??:|displayName\??:/);
});
// Reuse existing hook/DB test utilities without substituting production transitions.
const jsx=(type,props)=>({type,props});
const load=named('scripts/check-returning-room-polish.cjs','load',{fs,vm,ts,jsx,require,URL,AbortController});
const harness=named('scripts/check-returning-room-polish.cjs','harness',{load,jsx});
const bootProvider=named('scripts/check-returning-room-polish.cjs','bootProvider',{harness,load,setImmediate});
const user='a8080000-0000-4000-8000-000000000001',hid='b8080000-0000-4000-8000-000000000001',rid='c8080000-0000-4000-8000-000000000001',tid='d8080000-0000-4000-8000-000000000001';
const fakeClient=named('scripts/check-first-home.cjs','fakeClient',{user,hid,rid,tid});
function moduleLoad(file,mocks={}) {const module={exports:{}};compile(fs.readFileSync(file,'utf8'),{module,exports:module.exports,require:name=>mocks[name]??(name==='server-only'?{}:require(name)),Request,Response});return module.exports;}
const rules=moduleLoad('src/domain/first-home.ts');
const {readFirstHome}=moduleLoad('src/server/dal/first-home.ts');
function backend(client){return moduleLoad('src/app/api/mobile/onboarding/route.ts',{'@/domain/first-home':rules,'@/server/dal/first-home':{readFirstHome},'@/domain/fixtures/catalog':{GROUPS:[],MEMBERS:[]},'@/server/dal/profile':{getCurrentIdentityFromClient:async()=>({user:{id:user}})},'@/server/supabase/bearer':{createSupabaseBearerClient:()=>client}})}
test('actual completion endpoint → real bootstrap → installed protected stack resolves and remains Profile',async()=>{
 const client=fakeClient({placed:true}),api=backend(client),provider=await bootProvider('interest',null,2500),h=lifecycle();
 assert.equal(client.tables.profiles[0].onboarding_step,'interest');assert.equal(h.active().name,'onboarding');
 const response=await api.PATCH(new Request('http://fixture.local/api/mobile/onboarding',{method:'PATCH',body:JSON.stringify({action:'complete'})}));assert.equal(response.status,200);const confirmed=await response.json();assert.equal(confirmed.step,'done');
 provider.render().enterApp('profile');assert.equal(provider.render().destination,'app');assert.equal(provider.render().appEntryTarget,"profile");
 h.applyBootstrap(provider.render());h.render();h.focus();assert.equal(provider.render().appEntryTarget,null);
 const reloaded=await (await api.GET(new Request('http://fixture.local/api/mobile/onboarding'))).json();assert.equal(reloaded.step,'done');
 provider.advance(2500);await new Promise(setImmediate);assert.equal(provider.render().onboardingStep,'done','late interest bootstrap cannot overwrite confirmed done');
 h.reconcile();h.render();assert.equal(h.active().state.routes[0].name,'profile');assert.equal(client.writes.length,1);assert.deepEqual(Object.keys(client.writes[0].patch),['onboarding_step']);provider.cleanup();
});
for(const fail of [true,false])test(`actual Room completion handler ${fail?'fails then retries':'awaits delayed response'} before Profile intent`,async()=>{
 const h=lifecycle(),client=fakeClient({placed:true}),api=backend(client);let release,complete=false,error=false;
 const scope={holdingId:hid,confirmed:{current:hid},completing:{current:false},mounted:{current:true},get complete(){return complete},startupTrace(){},onboardingTrace(){},setError:v=>error=v,setComplete:v=>complete=v,updateNativeOnboarding:async()=>{await new Promise(r=>release=r);if(fail&&!error)throw Error('offline');return (await api.PATCH(new Request('http://fixture.local',{method:'PATCH',body:JSON.stringify({action:'complete'})}))).json()}};
 const source=fs.readFileSync('apps/mobile/src/onboarding/OnboardingWorldIntro.tsx','utf8'),ast=ts.createSourceFile('intro.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn;function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='finish')fn=n;ts.forEachChild(n,walk)}walk(ast);const finish=compile(`(${fn.getText(ast)})`,scope);
 let pending=finish(hid);assert.equal(complete,false);assert.equal(h.dispatches,0);release();await pending;
 if(fail){assert.equal(error,true);assert.equal(complete,false); // Actual handler resets error at retry start; change transport to restored connectivity.
 scope.updateNativeOnboarding=async()=> (await api.PATCH(new Request('http://fixture.local',{method:'PATCH',body:JSON.stringify({action:'complete'})}))).json();await finish(hid);}
 assert.equal(complete,true);h.complete();h.reconcile();h.render();h.focus();assert.equal(h.active().state.routes[0].name,'profile');assert.equal(client.writes.length,1);
});

const arrivalLoad=named('scripts/check-archetype-room-arrival.cjs','load',{fs,vm,ts,jsx,require});
const intro=named('scripts/check-archetype-room-arrival.cjs','intro',{load:arrivalLoad,assert,jsx});
const room=tree=>tree.props.children[0];
const arrive=named('scripts/check-archetype-room-arrival.cjs','arrive',{room,setImmediate,assert});
function descendants(node){return node&&typeof node==='object'?[node,...[node.props?.children].flat(Infinity).flatMap(descendants)]:[]}
test('first physical Go to Profile action awaits actual server completion, then real guards resolve Profile (not collect)',async()=>{
 const client=fakeClient({placed:true}),api=backend(client),provider=await bootProvider('interest'),h=lifecycle();let release;
 const scene=intro({completionRequest:async()=>{await new Promise(r=>release=r);return (await api.PATCH(new Request('http://fixture.local',{method:'PATCH',body:JSON.stringify({action:'complete'})}))).json()},onContinue:()=>provider.render().enterApp('profile')});
 await arrive(scene);scene.tick();scene.render();scene.tick();let tree=scene.render();
 const button=descendants(room(tree).props.roomGuidance).find(n=>n.props.onPress?.name==='requestDiscover');assert.ok(button);button.props.onPress();scene.render();
 assert.equal(provider.render().destination,'onboarding');assert.equal(scene.profile,0);assert.equal(h.active().name,'onboarding');
 release();await new Promise(setImmediate);scene.render();assert.equal(scene.profile,1);assert.equal(provider.render().onboardingStep,'done');
 h.applyBootstrap(provider.render());assert.equal(h.active().name,'collect','real guard preserves shared history before handoff');h.render();h.focus();h.reconcile();h.render();
 assert.equal(h.active().state.routes[0].name,'profile');assert.equal(provider.render().appEntryTarget,null);assert.equal(client.tables.holdings.length,1);assert.equal(client.writes.length,1);
 scene.cleanup();provider.cleanup();
});

const path=require('node:path'),{createRequire}=require('node:module');
function installed(file,mocks={}){const absolute=path.resolve('apps/mobile/node_modules/expo-router/build',file),module={exports:{}};vm.runInNewContext(fs.readFileSync(absolute,'utf8'),{module,exports:module.exports,require:n=>mocks[n]??createRequire(absolute)(n),console,URL});return module.exports;}
const {authoredRootState}=moduleLoad('apps/mobile/src/startup/navigationState.ts');
const pathParser=installed('fork/getStateFromPath.js',{'../react-navigation/native':require('../apps/mobile/node_modules/expo-router/build/react-navigation/core/validatePathConfig')}).getStateFromPath;
const {TabRouter}=require('../apps/mobile/node_modules/expo-router/build/react-navigation/routers/TabRouter');
function wrappedLifecycle(target='discover'){
 const h=harness(),reducer=StackRouter({initialRouteName:'onboarding'}),shellReducer=StackRouter({initialRouteName:'__root'}),tabs=TabRouter({initialRouteName:target==='profile'?'profile':'index'});
 let policy='onboarding',pending=target,dispatches=0,notifications=0;
 let opts={routeNames:names(policy),routeParamList:{},routeGetIdList:{},routeKeyChanges:[]};
 let app=reducer.getInitialState(opts);
 for(const action of [StackActions.replace('collect'),StackActions.push('add'),StackActions.replace('onboarding')])app=reducer.getStateForAction(app,action,opts);
 let outer=shellReducer.getInitialState({...opts,routeNames:['__root']});outer.routes[0].state=app;
 const listeners=new Map();const ref={isReady:()=>true,getRootState:()=>outer,addListener(event,fn){const group=listeners.get(event)??new Set();group.add(fn);listeners.set(event,group);return()=>group.delete(fn)}};
 const emit=()=>{outer={...outer,routes:[{...outer.routes[0],state:app}]};listeners.get('state')?.forEach(fn=>fn())};
 const react={...h.react,useSyncExternalStore(subscribe,get){const [value,set]=h.react.useState(get);h.react.useEffect(()=>subscribe(()=>{notifications++;set(get())}),[subscribe,get]);return value}};
 const hook=h.load('apps/mobile/src/startup/useAppNavigationState.ts',{react,'expo-router':{useNavigationContainerRef:()=>ref},'./navigationState':{authoredRootState}}).useAppNavigationState;
 const linking={config:{screens:{__root:{path:'',screens:{...Object.fromEntries(names('app').filter(n=>n!=='(tabs)').map(n=>[n,n])),'(tabs)':{path:'(tabs)',screens:{index:'',profile:'profile'}},onboarding:'onboarding'}}}},getStateFromPath:pathParser};
 const store={assertIsReady(){},navigationRef:{current:ref},linking,getRouteInfo:()=>({segments:[]}),redirects:[]};
 const navigateAction=installed('global-state/getNavigationAction.js',{'./store':{store},'../getRoutesRedirects':{applyRedirects:href=>href},'../link/href':{resolveHrefStringWithSegments:href=>href}}).getNavigateAction;
 function replace(href){dispatches++;const action=navigateAction(href,{},'REPLACE');assert.equal(action.target,app.key,'actual Expo action targets authored stack inside __root');app=reducer.getStateForAction(app,action,opts);assert.ok(app);const active=app.routes[app.index];if(active.name==='(tabs)'&&!active.state){
   // React Navigation mounts the nested tab navigator only after root reducer accepts the action.
   active.state=tabs.getRehydratedState({stale:true,routes:[{name:active.params?.screen??(target==='profile'?'profile':'index')}],index:0},{routeNames:['index','search','create','messages','profile'],routeParamList:{},routeGetIdList:{}});
 }emit();}
 const boot={get appEntryTarget(){return pending},consumeAppEntry(){pending=null}};
 const entry=named('apps/mobile/src/startup/AuthRouteTree.tsx','AppEntryNavigation',{useRef:react.useRef,useEffect:react.useEffect,useAppNavigationState:hook,useBootstrap:()=>boot,useRouter:()=>({replace}),startupTrace(){},onboardingTrace(){}});
 return {render:()=>h.render(entry),get root(){return outer},get app(){return app},get pending(){return pending},get dispatches(){return dispatches},get notifications(){return notifications},listeners,
  complete(){policy='app';opts={...opts,routeNames:names(policy)};app=reducer.getStateForRouteNamesChange(app,opts);emit()},
  reconcile(){app=reducer.getStateForRouteNamesChange(app,opts);emit()},replace,
  tab(name){const route=app.routes[app.index];route.state=tabs.getStateForAction(route.state,{type:'JUMP_TO',payload:{name}},{routeNames:route.state.routeNames,routeParamList:{},routeGetIdList:{}});emit()},
  enterRoom(){replace('/room')},cleanup:()=>h.cleanup()};
}
test('installed SDK root hook returns generated wrapper, proving old flat readiness check can never see tabs',()=>{
 const h=wrappedLifecycle();h.complete();const hook=installed('hooks/useRootNavigationState.js',{'../react-navigation/native':{useNavigation:()=>({getParent:id=>{assert.equal(id,'__root');return{getState:()=>h.root}}})}}).useRootNavigationState;
 assert.deepEqual(hook().routeNames,['__root']);assert.equal(hook().routeNames.includes('(tabs)'),false);assert.ok(authoredRootState(hook()).routeNames.includes('(tabs)'));h.cleanup();
});
for(const target of ['discover','profile'])test(`wrapped Expo registration event alone wakes pending ${target} handoff; final resolved route stays social`,()=>{
 const h=wrappedLifecycle(target);h.render();assert.equal(h.dispatches,0);assert.ok(h.listeners.get('state').size);h.complete();assert.ok(h.notifications>0,'navigation event schedules hook update without any bootstrap rerender');h.render();h.render();assert.equal(h.dispatches,1);assert.equal(h.pending,null);const expected=target==='profile'?'profile':'index';assert.equal(h.app.routes[h.app.index].state.routes[h.app.routes[h.app.index].state.index].name,expected);h.reconcile();h.render();assert.equal(h.app.routes[h.app.index].name,'(tabs)');assert.equal(h.dispatches,1);h.cleanup();assert.equal(h.listeners.get('state').size,0);assert.equal(h.listeners.get('ready').size,0);
});
test('Discover → Profile → Room → explicit Home → Profile uses actual wrapped Expo actions, not history',()=>{
 const h=wrappedLifecycle();h.render();h.complete();h.render();h.render();h.tab('profile');h.enterRoom();assert.equal(h.app.routes[h.app.index].name,'room');h.replace('/(tabs)/profile');assert.equal(h.app.routes[h.app.index].name,'(tabs)');assert.equal(h.app.routes[h.app.index].state.routes[h.app.routes[h.app.index].state.index].name,'profile');h.reconcile();h.render();assert.equal(h.app.routes[h.app.index].name,'(tabs)');h.cleanup();
});
for(const kind of ['home','binder','edit'])test(`Room Home from ${kind} preserves save boundary and explicitly resolves Profile`,async()=>{
 const h=wrappedLifecycle();h.render();h.complete();h.render();h.render();h.enterRoom();let leave;
 const ast=ts.createSourceFile('world.tsx',fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='leaveHome')leave=n;ts.forEachChild(n,walk)}walk(ast);
 let saved=0,idle=0;const scope={leaving:{current:false},setHomeSaving(){},onboardingTrace(){},viewRef:{current:{kind}},saveEditing:async()=>{saved++;return true},demo:false,liveSync:{idle:async()=>{idle++}},onLeave:()=>h.replace('/(tabs)/profile')};const press=compile(`(${leave.getText(ast)})`,scope);await press();assert.equal(saved,kind==='edit'?1:0);assert.equal(idle,1);assert.equal(h.app.routes[h.app.index].state.routes[h.app.routes[h.app.index].state.index].name,'profile');h.cleanup();
});
test('Room Home does not discard a failed edit save or invoke duplicate exits during an in-flight save',async()=>{
 const ast=ts.createSourceFile('world.tsx',fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let node;function walk(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='leaveHome')node=n;ts.forEachChild(n,walk)}walk(ast);let release,exits=0;
 const scope={leaving:{current:false},setHomeSaving(){},onboardingTrace(){},viewRef:{current:{kind:'edit'}},saveEditing:()=>new Promise(r=>release=r),demo:false,liveSync:{idle:async()=>{}},onLeave:()=>exits++};const press=compile(`(${node.getText(ast)})`,scope);const first=press();await press();release(false);await first;assert.equal(exits,0);assert.equal(scope.leaving.current,false);
});
test('first Room Home waits for server-confirmed done and chooses Profile; Explore chooses Discover',async()=>{
 for(const action of ['home','explore']){const provider=await bootProvider('interest');const scene=intro({pendingCompletion:true,onContinue:()=>provider.render().enterApp('discover'),onHome:()=>provider.render().enterApp('profile')});let tree=await arrive(scene);scene.tick();scene.render();scene.tick();tree=scene.render();if(action==='home')room(tree).props.onLeave();else descendants(room(tree).props.roomGuidance).find(n=>n.props.onPress?.name==='requestDiscover').props.onPress();scene.render();assert.equal(provider.render().destination,'onboarding');scene.resolveCompletion();await new Promise(setImmediate);scene.render();assert.equal(provider.render().onboardingStep,'done');assert.equal(provider.render().appEntryTarget,action==='home'?'profile':'discover');scene.cleanup();provider.cleanup();}
});
