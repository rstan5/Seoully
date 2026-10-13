const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const clean = x => JSON.parse(JSON.stringify(x));
function load(file, mocks, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { module, exports: module.exports, require: name => mocks[name] ?? require(name), ...globals });
  return module.exports;
}
function disk() {
  const rows = new Map();
  return { rows, mocks: { '@react-native-async-storage/async-storage': { __esModule: true, default: { getItem: async k => rows.get(k) ?? null, setItem: async (k, v) => { rows.set(k, v); }, removeItem: async k => rows.delete(k) } } } };
}
const onboardingSource = fs.readFileSync('apps/mobile/app/onboarding.tsx', 'utf8');
function handler(name, scope) {
  const ast = ts.createSourceFile('onboarding.tsx', onboardingSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found; function walk(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node; ts.forEachChild(node, walk); } walk(ast);
  return vm.runInNewContext(ts.transpileModule(`(${found.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);
}
test('canonical single archetype catalog reused; Biases advances to Archetype before interests/collectible', () => {
  assert.match(onboardingSource, /COLLECTOR_ARCHETYPES.map/); assert.match(onboardingSource, /collectorType === value \? "Collector" : value/);
  assert.match(onboardingSource, /else setPhase\("archetype"\)/); assert.match(onboardingSource, /phase === "archetype" \? t.onboardingArchetypeGreeting/);
  let phase; const back = handler('backIdentity', { phase: 'archetype', setPhase: x => phase = x }); back(); assert.equal(phase, 'bias');
});
for (const collectorType of ['Photocard Hunter', 'Collector']) test(`confirmed ${collectorType} saves only real Profile field, then checkpoint; failed save stays retryable`, async () => {
  let fail = true, next, complete = false, error; const patches = [], drafts = [];
  const scope = { state: {}, savingIdentity: { current: false }, tastePending: 0, collectorType, archetypeComplete: false, phase: 'archetype', identityUserId: 'one', groupIds: ['bts'], biasIds: ['jungkook'], setSaving() {}, setError: x => error = x, t: { onboardingSaveFailed: 'retry' }, saveOnboardingIdentityDraft: async (_, draft) => drafts.push(clean(draft)), updateNativeProfile: async patch => { patches.push(clean(patch)); if (fail) throw Error('offline'); return { identity: { profile: { collectorType } } }; }, setArchetypeComplete: x => complete = x, setPhase: x => next = x };
  const advance = handler('advanceIdentity', scope); await advance(); assert.equal(next, undefined); assert.equal(complete, false); assert.equal(error, 'retry');
  fail = false; await advance(); assert.equal(next, 'interest'); assert.equal(complete, true); assert.deepEqual(patches, [{ collectorType }, { collectorType }]); assert.equal(drafts.at(-1).archetypeComplete, true);
});
test('selection/removal and confirmed checkpoint survive relaunch without losing tastes', async () => {
  const s = disk(), file = 'apps/mobile/src/onboarding/identityDraft.ts'; let api = load(file, s.mocks);
  for (const collectorType of ['Multi-Stan', 'Collector']) { await api.saveOnboardingIdentityDraft('one', { groupIds: ['bts'], biasIds: ['jungkook'], collectorType, archetypeComplete: true }); api = load(file, s.mocks); const draft = await api.readOnboardingIdentityDraft('one'); assert.equal(draft.collectorType, collectorType); assert.equal(draft.archetypeComplete, true); assert.deepEqual(clean(draft.groupIds), ['bts']); }
  assert.equal(await api.readOnboardingIdentityDraft('two'), null);
  assert.match(onboardingSource, /!draft\?\.archetypeComplete \? "archetype"/);
});
test('arrival presentation claim is scoped, concurrent-safe, durable and never writes ownership', async () => {
  const s = disk(), file = 'apps/mobile/src/onboarding/roomArrival.ts'; let api = load(file, s.mocks);
  assert.deepEqual(await Promise.all([api.claimRoomArrival('one', 'card'), api.claimRoomArrival('one', 'card')]), [true, false]);
  api = load(file, s.mocks); assert.equal(await api.claimRoomArrival('one', 'card'), false); assert.equal(await api.claimRoomArrival('two', 'card'), true);
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /createMyHolding|updateNativeOnboarding|supabase/);
});
function intro({ photocard = true, reduced = false, playArrival = true, fail = false } = {}) {
  let index = 0, slots = [], effects = [], timers = new Map(), next = 0, animations = [], appListener, focusedCleanup, profile = 0, requests = 0;
  const react = { useState(initial) { const i = index++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; }, useRef(value) { const i = index++; return slots[i] ?? (slots[i] = { current: value }); }, useCallback: (fn, deps) => { const i = index++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) slots[i] = { fn, deps }; return slots[i].fn; }, useEffect(fn, deps) { const i = index++; if (!slots[i] || deps.some((v, j) => v !== slots[i].deps[j])) effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; }); } };
  class Value { constructor(value) { this.value = value; } }
  const copy = { roomArrivalHome: 'Home ♡', roomArrivalEdit: 'Edit', roomArrivalFinish: 'Find people', roomArrivalProfile: 'Profile', onboardingSaveFailed: 'retry', close: 'Close', onboardPlaceFirst: 'Place', onboardOwnershipHandoff: 'handoff' };
  const api = load('apps/mobile/src/onboarding/OnboardingWorldIntro.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'expo-router': { useFocusEffect(fn) { react.useEffect(() => { focusedCleanup = fn(); return focusedCleanup; }, [fn]); } },
    'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x, absoluteFill: {} }, Animated: { View: 'Animated', Value, timing(value, config) { return { start(fn) { animations.push({ config, finish: () => { value.value = config.toValue; fn({ finished: true }); } }); }, stop() {} }; } }, AppState: { currentState: 'active', addEventListener(_, fn) { appListener = fn; return { remove() { appListener = null; } }; } } },
    '../ui/HeartFarewell': { HeartFarewell: 'Heart' }, '../room/RoomWorldScreen': { RoomWorldScreen: 'Room' }, '../room/RoomMessage': { RoomMessage: 'Message', roomMessageStyles: { text: {} } }, '../ui/SeoullyText': { SeoullyText: 'Text' }, '../ui/SeoullyCompanion': { SeoullyCompanion: 'Companion' }, '../ui/motion': { useMotionPreference: () => reduced }, '../theme': { colors: { canvas: 'pink' } }, '../data': { useSocialRepository: () => ({ capabilities: { persistRoom: true } }) }, '../api': { updateNativeOnboarding: async () => { requests++; if (fail) throw Error('offline'); return { step: 'done' }; } }, '../room/roomStyle': { DEFAULT_ROOM_STYLE: {}, resolveRoomLook: x => x }, '../room/theme': { roomOverlayChrome: () => ({ color: 'ink', border: 'line' }) }, './roomArrival': { nextArrivalMessage: current => current === 'home' ? 'edit' : current === 'edit' ? 'profile' : current },
  }, { setTimeout(fn, ms) { assert.equal(ms, 3000); const id = ++next; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id) });
  return { copy, render() { index = 0; effects = []; const tree = api.default({ holdingId: 'card', photocard, playArrival, copy, onContinue: () => profile++, onBack() {} }); effects.forEach(fn => fn()); return tree; }, fade() { const a = animations.at(-1); assert.equal(a.config.duration, reduced ? 0 : 280); a.finish(); }, tick() { assert.equal(timers.size, 1); [...timers.values()][0](); }, background() { appListener('background'); }, foreground() { appListener('active'); }, blur() { focusedCleanup(); }, cleanup() { slots.forEach(s => s?.cleanup?.()); }, get timers() { return timers.size; }, get profile() { return profile; }, get requests() { return requests; } };
}
function room(tree) { return tree.props.children[0]; }
function descendants(node) { if (!node || typeof node !== 'object') return []; return [node, ...[node.props?.children].flat(Infinity).flatMap(descendants)]; }
async function arrive(h, photocard = true) {
  let tree = h.render(); const world = room(tree); world.props.onLiveSnapshotReady({ placements: [] }); world.props.onWorldReady();
  tree = h.render(); assert.equal(tree.props.children[2].props.ready, true); tree.props.children[2].props.onContinue();
  tree = h.render(); assert.equal(room(tree).props.initialHoldingId, undefined); h.fade(); tree = h.render();
  if (photocard) { assert.equal(room(tree).props.initialHoldingId, 'card'); room(tree).props.onLiveBinderConfirmed(['card']); room(tree).props.onBinderArrivalReady(); }
  else { assert.equal(room(tree).props.initialHoldingId, undefined); room(tree).props.onLivePlacementConfirmed('card'); }
  await new Promise(setImmediate); return h.render();
}
test('heart waits for actual world; fade precedes Binder; one companion and no full-screen input blocker', async () => {
  const h = intro(); const first = h.render(); assert.equal(first.props.children[2].props.ready, false); assert.equal(h.requests, 0);
  const tree = await arrive(h); assert.equal(tree.props.children.filter(x => x?.type === 'Companion').length, 1); assert.equal(tree.props.children.some(x => x?.type === 'Heart'), false);
  assert.equal(room(tree).props.suppressAmbientGuidance, true); assert.equal(tree.type, 'View'); assert.equal(h.requests, 1); h.cleanup();
});
test('messages run visible 3s → 3s → persistent Profile; action never repeats Holding creation', async () => {
  const h = intro(); let tree = await arrive(h); assert.ok(descendants(room(tree).props.roomGuidance).some(x => x.props.children === 'Home ♡'));
  h.tick(); tree = h.render(); assert.ok(descendants(room(tree).props.roomGuidance).some(x => x.props.children === 'Edit'));
  h.tick(); tree = h.render(); assert.equal(h.timers, 0); const action = descendants(room(tree).props.roomGuidance).find(x => x.type === 'Pressable' && x.props.disabled === false); action.props.onPress(); assert.equal(h.profile, 1); assert.equal(h.requests, 1); h.cleanup();
});
test('dismissal cancels future messages; background and navigation clean timers', async () => {
  const h = intro(); let tree = await arrive(h); h.background(); h.render(); assert.equal(h.timers, 0); h.foreground(); h.render(); assert.equal(h.timers, 1);
  descendants(room(tree).props.roomGuidance).find(x => x.props.accessibilityLabel === 'Close').props.onPress(); tree = h.render(); assert.equal(h.timers, 0); assert.equal(room(tree).props.roomGuidance, null); h.cleanup();
  const other = intro(); await arrive(other); other.blur(); other.render(); assert.equal(other.timers, 0); other.cleanup();
});
test('non-photocard waits for real placement and does not open unrelated Binder', async () => { const h = intro({ photocard: false }); const tree = await arrive(h, false); assert.equal(room(tree).props.initialHoldingId, undefined); assert.equal(h.requests, 1); assert.equal(h.timers, 1); h.cleanup(); });
test('failed completion stays retryable and cannot enable Profile success', async () => { const h = intro({ fail: true }); const tree = await arrive(h); assert.ok(descendants(room(tree).props.roomGuidance).some(x => x.props.accessibilityRole === 'alert')); h.tick(); h.render(); h.tick(); const final = h.render(); assert.ok(descendants(room(final).props.roomGuidance).some(x => x.props.disabled === true)); h.cleanup(); });
test('reduced motion uses direct fade and same messages; interrupted arrival does not replay heart', async () => { const h = intro({ reduced: true }); await arrive(h); h.cleanup(); assert.equal(h.timers, 0); const resumed = intro({ playArrival: false }); assert.equal(resumed.render().props.children.some(x => x?.type === 'Heart'), false); resumed.cleanup(); });
test('EN/KO includes archetype introduction and all three Room welcome messages', () => { const { copy } = load('apps/mobile/src/i18n.ts', {}); for (const lang of ['en', 'ko']) for (const key of ['onboardingArchetypeTitle', 'onboardingArchetypeLead', 'onboardingArchetypeGreeting', 'roomArrivalHome', 'roomArrivalEdit', 'roomArrivalFinish', 'roomArrivalProfile']) assert.ok(copy(lang)[key]); assert.notEqual(copy('en').onboardingArchetypeGreeting, copy('ko').onboardingArchetypeGreeting); });
test('actual render readiness waits one drawn frame and observes existing Binder/camera settling only once', () => {
  const file = fs.readFileSync('apps/mobile/src/room/NativeRoomRenderer.tsx', 'utf8');
  const ast = ts.createSourceFile('renderer.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ArrivalReadiness');
  let frame, ready = 0, binder = 0;
  class Vector3 { constructor() { this.x = 0; } distanceTo(other) { return Math.abs(this.x - other.x); } copy(other) { this.x = other.x; } }
  const scope = { useRef: current => ({ current }), Vector3, useFrame: callback => frame = callback };
  const observe = vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);
  const view = { kind: 'home' }, motion = { current: 0 }, camera = { position: new Vector3() };
  observe({ onWorldReady: () => ready++, onBinderArrivalReady: () => binder++, view, motion });
  frame({ camera }); assert.equal(ready, 0); frame({ camera }); assert.equal(ready, 1);
  view.kind = 'binder'; motion.current = 0.5; frame({ camera }); assert.equal(binder, 0);
  motion.current = 1; camera.position.x = 2; frame({ camera }); assert.equal(binder, 0);
  frame({ camera }); assert.equal(binder, 1); frame({ camera }); assert.equal(binder, 1); assert.equal(ready, 1);
});
test('initial Binder request uses normal open path once, refuses unavailable card, never overwrites later interaction', () => {
  const file = fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx', 'utf8');
  const start = file.indexOf('  const initialBinderOpened'), end = file.indexOf('  function clearPendingPress', start);
  let effect, called = 0, exists = false; const refs = [];
  const scope = { useRef(value) { const ref = { current: value }; refs.push(ref); return ref; }, useEffect(fn) { effect = fn; }, initialHoldingId: 'card', spreads: [{}], roomLayout: { objects: [] }, objectHasKind: () => true, spreadIndexForHolding: () => exists ? 0 : -1, openBinderFromWorld: id => { assert.equal(id, 'card'); called++; } };
  vm.runInNewContext(ts.transpileModule(file.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, scope);
  effect(); assert.equal(called, 0); exists = true; effect(); effect(); assert.equal(called, 1);
});
