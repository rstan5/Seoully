const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props });
const moduleMock = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/mobile/src/ui/SeoullyMessageScreen.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
  module: moduleMock, exports: moduleMock.exports, require: name => ({
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { ScrollView: 'ScrollView', View: 'View', StyleSheet: { create: x => x } },
    '../components/KeyboardScreen': { KeyboardScreen: 'KeyboardScreen' },
    '../theme': { colors: { plum: 'plum' }, spacing: { lg: 24, sm: 12 } },
    './SeoullyScreen': { SeoullyScreen: 'SeoullyScreen' },
    './SeoullyText': { SeoullyText: 'SeoullyText' },
  })[name],
});
const render = props => moduleMock.exports.SeoullyMessageScreen({ children: jsx('button', { onPress() {} }), ...props });
const parts = tree => { const keyboard = tree.props.children; const scroll = Array.isArray(keyboard.props.children) ? keyboard.props.children.find(child=>child?.type==='ScrollView') : keyboard.props.children; const composition = scroll.props.children; return { keyboard, scroll, composition, copy: composition.props.children[0], actions: composition.props.children[1] }; };
test('all safe edges and keyboard avoidance enclose the dedicated composition', () => { const tree = render({}); assert.deepEqual(Array.from(tree.props.edges), ['top','bottom','left','right']); assert.equal(parts(tree).keyboard.type, 'KeyboardScreen'); });
test('safe viewport centers both axes as one composition with comfortable action spacing', () => { const { scroll, composition, actions } = parts(render({ title: 'Saved' })); const s = scroll.props.contentContainerStyle; assert.equal(s.flexGrow, 1); assert.equal(s.justifyContent, 'center'); assert.equal(s.alignItems, 'center'); assert.equal(s.padding, 24); assert.equal(composition.props.style.gap, 24); assert.equal(actions.props.style.width, '100%'); });
test('small-screen and dynamic text overflow can scroll without fixed height or clipping', () => { const { scroll, composition } = parts(render({})); assert.equal(scroll.type, 'ScrollView'); assert.equal(scroll.props.style.flex, 1); assert.equal(composition.props.style.width, '100%'); assert.equal(composition.props.style.maxWidth, 420); assert.equal(composition.props.style.height, undefined); assert.equal(scroll.props.contentContainerStyle.height, undefined); assert.equal(scroll.props.keyboardShouldPersistTaps, 'handled'); });
for (const title of ['Your collectible is saved ♡', '컬렉터블을 저장했어요 ♡']) test(`localized title is centered without truncation: ${title}`, () => { const { copy } = parts(render({ title })); const text = copy.props.children[0]; assert.equal(text.props.children, title); assert.equal(text.props.style.textAlign, 'center'); assert.equal(text.props.numberOfLines, undefined); });
test('recoverable message retains alert semantics and executable action', () => { let calls = 0; const child = jsx('button', { onPress: () => calls++ }); const { copy, actions } = parts(render({ message: 'Retry', alert: true, children: child })); assert.equal(copy.props.children[1].props.accessibilityRole, 'alert'); actions.props.children.props.onPress(); assert.equal(calls, 1); });
test('no duplicate heart or animation; loader and inline states stay independent', () => { const source = fs.readFileSync('apps/mobile/src/ui/SeoullyMessageScreen.tsx','utf8'); assert.doesNotMatch(source,/Animated|setTimeout|Companion|Heart|LoadingState/); });
test('success and dedicated errors use shared primitive; localized actions wrap', () => { for (const file of ['apps/mobile/app/add.tsx','apps/mobile/app/onboarding.tsx','apps/mobile/src/startup/AuthRouteTree.tsx']) { const source=fs.readFileSync(file,'utf8'); assert.match(source,/<SeoullyMessageScreen/); assert.match(source,/block multiline/); } const controls=fs.readFileSync('apps/mobile/src/ui/SeoullyControls.tsx','utf8'); assert.match(controls,/multiline = false/); assert.match(controls,/numberOfLines=\{multiline \? undefined/); assert.match(controls,/minHeight: 48/); });
test('optional Back header sits outside centered confirmation and preserves its action',()=>{
 let calls=0;const header=jsx('Back',{onPress:()=>calls++}),tree=render({title:'Saved',header});
 assert.equal(tree.props.children.props.children[0],header);header.props.onPress();assert.equal(calls,1);assert.equal(parts(tree).scroll.props.contentContainerStyle.justifyContent,'center');
});
