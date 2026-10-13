const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const flatten = x => Array.isArray(x) ? Object.assign({}, ...x.filter(Boolean).map(flatten)) : x;
function greeting(reduced) {
  let cursor = 0, slots = [], pending = [], timer, cleanup, stopped = false;
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => slots[i] = typeof value === 'function' ? value(slots[i]) : value]; },
    useRef(value) { const i = cursor++; return slots[i] ?? (slots[i] = { current: value }); },
    useEffect(fn) { pending.push(fn); },
  };
  class Value { interpolate(x) { return x; } stopAnimation() { stopped = true; } }
  const jsx = (type, props) => ({ type, props });
  const mocks = {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, './SeoullyText': { SeoullyText: 'Text' },
    './motion': { useMotionPreference: () => reduced }, './heartMotion': { heartMotion: { characterMs: 32, halfCycleMs: 1000, travel: 6 } },
    'react-native': { Animated: { Value, View: 'Animated', timing: () => ({}), sequence: x => x, loop: () => ({ start() {}, stop() { stopped = true; } }) }, Easing: { inOut: x => x, sin: 1 }, Image: 'Image', Pressable: 'Pressable', StyleSheet: { create: x => x } },
  };
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/mobile/src/ui/HeartGreeting.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    module, exports: module.exports, require: n => n.endsWith('.png') ? 1 : mocks[n],
    setTimeout(fn, ms) { assert.equal(ms, 32); timer = fn; return 1; }, clearTimeout() { timer = undefined; },
  });
  return {
    render(props) { cursor = 0; pending = []; const tree = module.exports.HeartGreeting(props); if (!cleanup) cleanup = pending[0](); return tree; },
    tick() { const task = timer; timer = undefined; task?.(); }, cleanup() { cleanup?.(); }, get active() { return !!timer; }, get stopped() { return stopped; },
  };
}
for (const large of [false, true]) for (const text of ['Turn your fandom\ninto a home.', '내 K-pop 세상을\n만들어 볼까요?', 'A longer heading that wraps naturally']) {
  test(`visible and reserved text retain identical metrics: ${large}/${text}`, () => {
    const h = greeting(false), props = { text, large, inlineHeart: true };
    for (let i = 0; i <= text.length; i++) {
      const tree = h.render(props), title = tree.props.children[1], [visible, hidden, heart] = title.props.children;
      assert.equal(visible + hidden.props.children, text);
      assert.equal(hidden.props.variant, title.props.variant);
      const { opacity, ...hiddenStyle } = flatten(hidden.props.style);
      assert.deepEqual(hiddenStyle, flatten(title.props.style));
      assert.equal(opacity, 0);
      assert.equal(flatten(heart.props.style).opacity, i === text.length ? 1 : 0);
      h.tick();
    }
    assert.equal(h.active, false); h.cleanup(); assert.equal(h.stopped, true);
  });
}
test('tap completes reveal and interruption cleans the timer without advancing navigation', () => {
  const h = greeting(false); let continued = 0;
  const props = { text: 'Enter your world.', onContinue: () => continued++ };
  h.render(props).props.onPress();
  assert.equal(h.render(props).props.children[1].props.children[0], props.text);
  assert.equal(continued, 0); h.cleanup(); assert.equal(h.active, false);
  h.tick(); assert.equal(continued, 0);
});
test('reduced motion shows full localized heading and inline heart immediately', () => {
  const h = greeting(true), text = '내 세상으로 들어와요.';
  const title = h.render({ text, inlineHeart: true }).props.children[1];
  assert.equal(title.props.children[0], text);
  assert.equal(flatten(title.props.children[2].props.style).opacity, 1);
  assert.equal(h.active, false);
});
test('speech bubble reserves its final font size and line height throughout typing', () => {
  const file = fs.readFileSync('apps/mobile/src/ui/HeartFarewell.tsx', 'utf8');
  assert.match(file, /variant="secondary" style=\{\[styles\.speech, \{ opacity: 0 \}\]\}/);
  assert.match(file, /variant="secondary" style=\{styles\.speech\}/);
});
test('choice layout reduces flexible space while retaining large targets, gap and navigation', () => {
  const file = fs.readFileSync('apps/mobile/app/collect.tsx', 'utf8');
  assert.match(file, /choices: \{ flexGrow: 0\.5, justifyContent: "center", gap: 24, paddingVertical: 24 \}/);
  assert.match(file, /choice: \{ minHeight: 120/);
  assert.match(file, /onPress=\{\(\) => setStep\("search"\)\}/);
  assert.match(file, /onPress=\{\(\) => setStep\("manual"\)\}/);
  assert.match(file, /contentContainerStyle=\{styles.container\}/);
  assert.match(file, /container: \{ flexGrow: 1/);
});
