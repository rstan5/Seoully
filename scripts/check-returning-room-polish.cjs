const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const jsx = (type, props) => ({ type, props });
function load(file, mocks = {}, globals = {}) { const module = { exports: {} }; vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { module, exports: module.exports, URL, AbortController, require: name => (name.endsWith('onboardingTrace') ? {onboardingTrace(){}} : mocks[name]) ?? (name.endsWith('.png') ? 1 : require(name)), ...globals }); return module.exports; }
function harness() {
  let index = 0, slots = [], effects = [], now = 0, id = 0; const timers = new Map(), animations = [];
  const react = { createContext: value => ({ Provider: 'Provider', value }), useContext: context => context.value, useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; }, useRef(current) { const i = index++; return slots[i] ?? (slots[i] = { current }); }, useEffect(fn, deps) { const i = index++; if (!slots[i] || deps.some((x, j) => x !== slots[i].deps[j])) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); }, useMemo(fn, deps) { const i = index++; if (!slots[i] || deps.some((x, j) => x !== slots[i].deps[j])) slots[i] = { deps, value: fn() }; return slots[i].value; }, useCallback(fn, deps) { return react.useMemo(() => fn, deps); } };
  class Value { constructor(value) { this.value = value; } interpolate(x) { return x; } stopAnimation() {} }
  const appListeners = new Set();
  const native = { AppState: {currentState:'active',addEventListener(_,fn){appListeners.add(fn);return {remove(){appListeners.delete(fn)}}}}, View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', Image: 'Image', useWindowDimensions: () => ({ width: 390, height: 844 }), StyleSheet: { create: x => x }, Easing: { inOut: x => x, sin: 1 }, Animated: { Value, View: 'Animated', timing(value, config) { let stopped = false; return { start(fn) { animations.push({ config, finish() { if (!stopped) { value.value = config.toValue; fn?.({ finished: true }); } } }); }, stop() { stopped = true; } }; }, sequence: x => x, loop: () => ({ start() {}, stop() {} }) } };
  const globals = { Date: { now: () => now }, setTimeout(fn, ms) { const key = ++id; timers.set(key, { fn, due: now + ms }); return key; }, clearTimeout: key => timers.delete(key), setInterval(fn, ms) { const key = ++id; timers.set(key, { fn, due: now + ms, period: ms }); return key; }, clearInterval: key => timers.delete(key) };
  return { react, native, globals, animations, timers, background(){appListeners.forEach(fn=>fn("background"))}, foreground(){appListeners.forEach(fn=>fn("active"))}, stall(ms){now+=ms}, deliverNext(){const [key,timer]=[...timers].sort((a,b)=>a[1].due-b[1].due)[0];if(timer.period)timer.due+=timer.period;else timers.delete(key);timer.fn();}, now:()=>now, load(file, mocks = {}) { return load(file, { react, 'react-native': native, 'react/jsx-runtime': { jsx, jsxs: jsx }, ...mocks }, globals); }, render(fn, props) { index = 0; effects = []; const tree = fn(props); effects.forEach(fn => fn()); return tree; }, advance(ms) { const target = now + ms; while (true) { const entry = [...timers].sort((a, b) => a[1].due - b[1].due)[0]; if (!entry || entry[1].due > target) break; const [key, timer] = entry; now = timer.due; if (timer.period) timer.due += timer.period; else timers.delete(key); timer.fn(); } now = target; }, cleanup() { slots.forEach(s => s?.cleanup?.()); } };
}
const eligibility = load('apps/mobile/src/startup/welcomeEligibility.ts');
const snapshot = { destination: 'app', authenticated: true, onboardingStep: 'done', errorKind: null };
for (const url of [null, 'exp://192.168.1.2:8081', 'exp://192.168.1.2:8081/--/']) test(`restored completed collector cold launch qualifies: ${url}`, () => assert.equal(eligibility.isReturningWelcomeLaunch(true, snapshot, url), true));
for (const [name, initial, next, url] of [
  ['sign in / refresh', false, snapshot, null], ['signup/onboarding', true, { ...snapshot, destination: 'onboarding', onboardingStep: 'bias' }, null], ['signed out', true, { ...snapshot, destination: 'welcome', authenticated: false }, null], ['auth failure', true, { ...snapshot, destination: 'error', errorKind: 'auth' }, null], ['specific Expo route', true, snapshot, 'exp://host/--/thread?id=one'], ['auth deep link', true, snapshot, 'seoully://auth?code=private'], ['unknown link', true, snapshot, 'unknown-deep-link'],
]) test(`${name} excludes welcome`, () => assert.equal(eligibility.isReturningWelcomeLaunch(initial, next, url), false));
test('countdown retains exact remaining visible time across a long background pause and cancels on unmount', () => {
  const h = harness(), { usePausedCountdown } = h.load('apps/mobile/src/ui/usePausedCountdown.ts'); let fired = 0;
  const render = (enabled, key = 'home') => h.render(() => usePausedCountdown(5000, enabled, key, () => fired++));
  render(true); h.advance(2000); render(false); assert.equal(h.timers.size, 0); h.advance(60000); render(true); h.advance(2999); assert.equal(fired, 0); h.advance(1); assert.equal(fired, 1);
  render(true, 'edit'); h.advance(4999); assert.equal(fired, 1); h.advance(1); assert.equal(fired, 2); render(true, 'new'); h.cleanup(); assert.equal(h.timers.size, 0); h.advance(5000); assert.equal(fired, 2);
});
for (const reduced of [false, true]) test(`shared typewriter completes once and reveals inline heart at completion; reduced=${reduced}`, () => {
  const h = harness(), { HeartGreeting } = h.load('apps/mobile/src/ui/HeartGreeting.tsx', { './SeoullyText': { SeoullyText: 'Text' }, './motion': { useMotionPreference: () => reduced }, './heartMotion': { heartMotion: { characterMs: 32, halfCycleMs: 1000, travel: 6 } } });
  let completed = 0; const props = { text: 'Welcome home, 지민.', large: true, showHeart: false, inlineHeart: true, interactive: false, onTypingComplete: () => completed++ };
  let tree = h.render(HeartGreeting, props); assert.equal(tree.type, 'View'); assert.equal(tree.props.onPress, undefined); assert.equal(tree.props.children[0], null);
  if (!reduced) { assert.equal(completed, 0); h.advance(props.text.length * 32 - 1); tree = h.render(HeartGreeting, props); assert.equal(completed, 0); assert.equal(tree.props.children[1].props.children[2].props.style.at(-1).opacity, 0); h.advance(1); }
  tree = h.render(HeartGreeting, props); assert.equal(completed, 1); assert.equal(tree.props.children[1].props.children[2].props.style.at(-1).opacity, 1); h.render(HeartGreeting, props); assert.equal(completed, 1); h.cleanup(); assert.equal(h.timers.size, 0);
});
async function welcome({ name = 'Mina', reduced = false, never = false } = {}) {
  const h = harness(); let blocked = true, finished = 0;
  const countdown = h.load('apps/mobile/src/ui/usePausedCountdown.ts');
  const { ReturningWelcome } = h.load('apps/mobile/src/startup/ReturningWelcome.tsx', { 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) }, '../ui/usePausedCountdown': countdown, './trace': {startupTrace(){}}, '../api': { resolveNativeIdentity: () => never ? new Promise(() => {}) : Promise.resolve({ user: { displayName: name } }) }, '../locale': { useCopy: () => ({ returningWelcomeNamed: 'Welcome home, {name}.', returningWelcome: 'Welcome home.' }) }, '../theme': { colors: { canvas: 'pink' } }, '../ui/HeartGreeting': { HeartGreeting: 'Greeting' }, '../ui/SeoullyLoadingState': { useBlockingLoadingActive: () => blocked }, '../ui/motion': { useMotionPreference: () => reduced }, './eligibility': { withTimeout: (promise, ms) => new Promise((resolve, reject) => { const t = h.globals.setTimeout(() => reject(Error('timeout')), ms); promise.then(x => { h.globals.clearTimeout(t); resolve(x); }, reject); }) } });
  const render = () => h.render(ReturningWelcome, { onFinished: finish, displayName: name }); function finish() { finished++; }
  render(); await new Promise(setImmediate);
  return { ...h, render, show() { blocked = false; }, block(){blocked=true;}, get finished() { return finished; } };
}
for (const name of ['Mina', '', 'A very long collector display name that wraps naturally across several lines on an iPhone']) test(`welcome centers canonical display name/fallback and holds after typing: ${name || 'missing'}`, async () => {
  const h = await welcome({ name }); assert.equal(h.render().props.children.props.children.props.active, false); h.show(); let tree = h.render(); const greeting = tree.props.children.props.children;
  assert.equal(greeting.props.text, name ? `Welcome home, ${name}.` : 'Welcome home.'); assert.equal(greeting.props.inlineHeart, true); assert.equal(greeting.props.showHeart, false); assert.equal(greeting.props.interactive, false);
  assert.equal(tree.props.children.props.contentContainerStyle[0].justifyContent, 'center'); assert.equal(h.animations.length, 0); h.advance(4000); assert.equal(h.animations.length, 0);
  greeting.props.onTypingComplete(); h.render(); h.advance(1999); h.render(); assert.equal(h.animations.length, 0); h.advance(1); h.render(); assert.equal(h.animations[0].config.duration, 350); assert.equal(h.finished, 0); h.animations[0].finish(); assert.equal(h.finished, 1); h.cleanup();
});
test('missing startup Profile name falls back immediately; reduced motion omits fade; unmount cancels callbacks', async () => {
  const h = await welcome({ name: '', reduced: true }); h.show(); await new Promise(setImmediate); let tree = h.render(); assert.equal(tree.props.children.props.children.props.text, 'Welcome home.'); tree.props.children.props.children.props.onTypingComplete(); h.render(); h.advance(2000); h.render(); assert.equal(h.animations[0].config.duration, 0); h.cleanup(); h.animations[0].finish(); assert.equal(h.finished, 0); assert.equal(h.timers.size, 0);
});
test('Room uses 600ms completed fade → paused 300ms Binder entrance → settled messages; close is vertically centered', () => {
  const source = fs.readFileSync('apps/mobile/src/onboarding/OnboardingWorldIntro.tsx', 'utf8');
  assert.match(source, /duration: reduced \? 0 : 600/); assert.match(source, /usePausedCountdown\(reduced \? 0 : 300, visible && active && focused/); assert.match(source, /initialHoldingId=\{binderMayEnter && photocard/); assert.match(source, /usePausedCountdown\(5000, messagesVisible/); assert.match(source, /messageRow: \{ flexDirection: "row", alignItems: "center"/); assert.match(source, /alignSelf: "center", marginLeft: -8/); assert.doesNotMatch(source, /marginTop: -8/);
  const world = fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx', 'utf8'); assert.match(world, /if \(viewRef.current.kind !== "home"\)/);
});
test('startup presentation is one-shot; signout/deep links clear it; real feed stays mounted behind welcome', () => {
  const boot = fs.readFileSync('apps/mobile/src/startup/BootstrapProvider.tsx', 'utf8'); assert.match(boot, /coldLaunch.current = false/); assert.match(boot, /isReturningWelcomeLaunch\(initial && !linkInterrupted.current/); assert.match(boot, /companionIsEligible\(eligibility\) && !returningWelcome/);
  const route = fs.readFileSync('apps/mobile/src/startup/AuthRouteTree.tsx', 'utf8'); assert.ok(route.indexOf('<Stack screenOptions') < route.indexOf('<ReturningWelcome')); assert.match(route, /accessibilityElementsHidden=\{boot.returningWelcome\}/);
  const component = fs.readFileSync('apps/mobile/src/startup/ReturningWelcome.tsx', 'utf8'); assert.match(component, /displayName.trim\(\)/); assert.doesNotMatch(component, /resolveNativeIdentity|optional_identity_timeout/); assert.doesNotMatch(component, /\.email|router\.|SeoullyButton|BrandMark/);
  const { copy } = load('apps/mobile/src/i18n.ts'); for (const lang of ['en', 'ko']) { assert.ok(copy(lang).returningWelcomeNamed.includes('{name}')); assert.ok(copy(lang).returningWelcome); }
});
async function bootProvider(step = 'done', url = null, profileDelay = 0) {
  const h = harness(); let authEvent, linkEvent;
  const eligibility = h.load('apps/mobile/src/startup/eligibility.ts');
  const { BootstrapProvider } = h.load('apps/mobile/src/startup/BootstrapProvider.tsx', {
    'expo-linking': { getInitialURL: async () => url, addEventListener(_, callback) { linkEvent = callback; return { remove() {} }; } },
    './welcomeEligibility': load('apps/mobile/src/startup/welcomeEligibility.ts'), '../api': { loadNativeOnboarding: async () => { if(profileDelay) await new Promise(resolve=>h.globals.setTimeout(resolve,profileDelay)); return { step, displayName: 'Saved Collector' }; } }, '../config': { mobileConfig: { authConfigured: true, productApiConfigured: true } }, '../supabase': { supabase: { auth: { getSession: async () => ({ data: { session: {} } }), onAuthStateChange(callback) { authEvent = callback; return { data: { subscription: { unsubscribe() {} } } }; } } } }, './eligibility': eligibility, './trace': { startupTrace() {} },
  });
  const render = () => h.render(BootstrapProvider, { children: null }).props.value;
  render(); h.advance(0); await new Promise(setImmediate);
  return { ...h, render, signOut: () => authEvent('SIGNED_OUT'), deepLink: () => linkEvent({ url: 'seoully://thread/one' }) };
}
test('actual provider shows restored welcome once; refresh and foreground do not replay; expiration clears welcome', async () => {
  const h = await bootProvider(); let value = h.render(); assert.equal(value.returningWelcome, true); assert.equal(value.companionEligible, false); assert.equal(value.destination, 'app');
  value.finishReturningWelcome(); value = h.render(); assert.equal(value.returningWelcome, false); assert.equal(value.companionEligible, true);
  h.advance(60000); assert.equal(h.render().returningWelcome, false); value.refresh(); await new Promise(setImmediate); assert.equal(h.render().returningWelcome, false); h.cleanup();
  const expired = await bootProvider(); assert.equal(expired.render().returningWelcome, true); expired.signOut(); assert.equal(expired.render().destination, 'welcome'); assert.equal(expired.render().returningWelcome, false); expired.cleanup();
});
test('actual provider excludes onboarding and deep links, and cancels active welcome on new link', async () => {
  const fresh = await bootProvider('group'); assert.equal(fresh.render().returningWelcome, false); assert.equal(fresh.render().destination, 'onboarding'); fresh.cleanup();
  const linked = await bootProvider('done', 'exp://host/--/thread/one'); assert.equal(linked.render().returningWelcome, false); linked.cleanup();
  const interrupted = await bootProvider(); assert.equal(interrupted.render().returningWelcome, true); interrupted.deepLink(); assert.equal(interrupted.render().returningWelcome, false); interrupted.cleanup();
});
test('enabling reduced motion changes a pending cinematic pause to immediate without duplicating callback', () => {
  const h = harness(), { usePausedCountdown } = h.load('apps/mobile/src/ui/usePausedCountdown.ts'); let fired = 0;
  const render = duration => h.render(() => usePausedCountdown(duration, true, 'binder', () => fired++));
  render(300); h.advance(50); render(0); h.advance(0); assert.equal(fired, 1); h.cleanup(); assert.equal(h.timers.size, 0);
});
test('delayed canonical startup Profile hydrates the name atomically; no optional welcome lookup can time it out', async () => {
  const h=await bootProvider('done',null,2500);assert.equal(h.render().destination,'loading');h.advance(2500);await new Promise(setImmediate);
  const value=h.render();assert.equal(value.returningWelcome,true);assert.equal(value.welcomeName,'Saved Collector');h.cleanup();
});
test('queued Profile handoff waits for the protected app navigator, dispatches once, and consumes its intent', () => {
  const h=harness(),file=fs.readFileSync('apps/mobile/src/startup/AuthRouteTree.tsx','utf8'),ast=ts.createSourceFile('routes.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='ProfileEntryNavigation');let mounted=false,pending=true,calls=0,focused=false;
  const router={replace(path){assert.ok(mounted);assert.equal(path,'/(tabs)/profile');calls++}};
  const scope={useRef:h.react.useRef,useEffect:h.react.useEffect,startupTrace(){},onboardingTrace(){},useBootstrap:()=>({profileEntryRequested:pending,consumeProfileEntry(){pending=false}}),useRouter:()=>router,useRootNavigationState:()=>({key:'root',routeNames:mounted?['(tabs)','collect']:['onboarding','collect'],routes:mounted?[{name:'(tabs)',state:{key:'tabs-ready',index:0,routes:[{name:focused?'profile':'index'}]}}]:[{name:'onboarding'}]})};
  const navigate=vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
  h.render(navigate);assert.equal(calls,0);mounted=true;h.render(navigate);assert.equal(calls,1);assert.equal(pending,true);focused=true;h.render(navigate);assert.equal(pending,false);h.render(navigate);h.render(navigate);assert.equal(calls,1);h.cleanup();
});
test('a stalled JS thread cannot burst multiple missed character ticks; background cancels stale callbacks and resumes progress', () => {
  const h=harness(),{HeartGreeting}=h.load('apps/mobile/src/ui/HeartGreeting.tsx',{'./SeoullyText':{SeoullyText:'Text'},'./motion':{useMotionPreference:()=>false},'./heartMotion':{heartMotion:{characterMs:32,halfCycleMs:1000,travel:6}}});
  const props={text:'Welcome home, Collector.',showHeart:false,interactive:false,active:true};let tree=h.render(HeartGreeting,props);
  h.stall(1000);h.deliverNext();tree=h.render(HeartGreeting,props);assert.equal(tree.props.children[1].props.children[0],'W');assert.ok([...h.timers.values()].every(timer=>timer.due>h.now()));
  h.advance(31);tree=h.render(HeartGreeting,props);assert.equal(tree.props.children[1].props.children[0],'W');h.advance(1);tree=h.render(HeartGreeting,props);assert.equal(tree.props.children[1].props.children[0],'We');
  const stale=[...h.timers.values()][0].fn;h.render(HeartGreeting,{...props,active:false});h.stall(60000);stale();tree=h.render(HeartGreeting,{...props,active:false});assert.equal(tree.props.children[1].props.children[0],'We');assert.equal(h.timers.size,0);
  h.render(HeartGreeting,props);h.advance(32);tree=h.render(HeartGreeting,props);assert.equal(tree.props.children[1].props.children[0],'Wel');h.cleanup();assert.equal(h.timers.size,0);
});
test('temporary blocking loader pauses the same welcome headline and its hold instead of unmounting/restarting it', async () => {
  const h=await welcome({name:'Saved Collector'});h.show();let tree=h.render();const greeting=tree.props.children.props.children;assert.equal(greeting.props.active,true);
  greeting.props.onTypingComplete();h.render();h.advance(1000);h.block();tree=h.render();assert.equal(tree.props.children.props.children.type,'Greeting');assert.equal(tree.props.children.props.children.props.active,false);h.advance(60000);assert.equal(h.animations.length,0);
  h.show();h.render();h.advance(999);h.render();assert.equal(h.animations.length,0);h.advance(1);h.render();assert.equal(h.animations.length,1);h.cleanup();
});
test('Profile handoff starts the app directly on Profile and consumes readiness without replacing the same tab twice', () => {
  const tabs=fs.readFileSync('apps/mobile/app/(tabs)/_layout.tsx','utf8');assert.match(tabs,/initialRouteName=\{boot.profileEntryRequested \? "profile" : "index"\}/);
  const h=harness(),file=fs.readFileSync('apps/mobile/src/startup/AuthRouteTree.tsx','utf8'),ast=ts.createSourceFile('routes.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='ProfileEntryNavigation');let ready=false,consumed=0;
  const scope={useRef:h.react.useRef,useEffect:h.react.useEffect,startupTrace(){},onboardingTrace(){},useBootstrap:()=>({profileEntryRequested:true,consumeProfileEntry(){consumed++}}),useRouter:()=>({replace(){throw Error('duplicate tab replacement')}}),useRootNavigationState:()=>({key:'root',routeNames:ready?['(tabs)']:['onboarding'],routes:[{name:'(tabs)',state:ready?{key:'tabs-ready',index:0,routes:[{name:'profile'}]}:undefined}]})};
  const navigate=vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);h.render(navigate);assert.equal(consumed,0);ready=true;h.render(navigate);h.render(navigate);assert.equal(consumed,1);h.cleanup();
});
test('signout or a competing deep link clears pending Profile entry rather than replaying it later',async()=>{
  const h=await bootProvider();h.render().enterApp('profile');assert.equal(h.render().profileEntryRequested,true);h.deepLink();assert.equal(h.render().profileEntryRequested,false);h.render().enterApp('profile');h.signOut();assert.equal(h.render().profileEntryRequested,false);h.cleanup();
});
test('completion plus delayed guards resolves to Profile and stays there after stale bootstrap and Profile hydration',async()=>{
  const provider=await bootProvider('interest',null,2500),h=harness();
  // The Room completion handler supplies this only after the authenticated server returns done.
  provider.render().enterApp('profile');assert.equal(provider.render().onboardingStep,'done');
  const source=fs.readFileSync('apps/mobile/src/startup/AuthRouteTree.tsx','utf8'),ast=ts.createSourceFile('routes.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='ProfileEntryNavigation');
  let state={key:'root',routeNames:['onboarding','collect'],index:1,routes:[{name:'(tabs)',state:{key:'new-app',index:0,routes:[{name:'index'}]}},{name:'onboarding'}]},queued=null,calls=0;
  const scope={useRef:h.react.useRef,useEffect:h.react.useEffect,startupTrace(){},onboardingTrace(){},useBootstrap:()=>provider.render(),useRootNavigationState:()=>state,useRouter:()=>({replace(route){calls++;queued=route}})};
  const navigate=vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
  h.render(navigate);assert.equal(calls,0,'background tab state is not readiness');assert.equal(provider.render().profileEntryRequested,true);
  state={...state,routeNames:['(tabs)','collect'],index:0,routes:[state.routes[0]]};h.render(navigate);assert.equal(queued,'/(tabs)/profile');assert.equal(provider.render().profileEntryRequested,true,'uncommitted replace must not consume intent');
  h.render(navigate);assert.equal(calls,1);
  state.routes[0].state.routes=[{name:'profile'}];h.render(navigate);assert.equal(provider.render().profileEntryRequested,false);
  provider.advance(2500);await new Promise(setImmediate);assert.equal(provider.render().destination,'app','late interest snapshot is rejected by generation');
  // Hydration and locale rerenders cannot restore the protected onboarding screen.
  for(let i=0;i<3;i++){h.render(navigate);assert.equal(provider.render().onboardingStep,'done');assert.equal(state.routes[state.index].state.routes[0].name,'profile')}
  const profile=fs.readFileSync('apps/mobile/app/(tabs)/profile.tsx','utf8');assert.doesNotMatch(profile,/router.replace\([^\n]*onboarding|boot.refresh\(/);
  assert.equal(calls,1);h.cleanup();provider.cleanup();
});
