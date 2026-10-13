const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { test } = require('node:test');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  file = path.resolve(root, file);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const requireLocal = name => {
    if (name === 'react-native') return { StyleSheet: { create: x => x }, View: 'View' };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name.startsWith('seoully-domain/')) return load('src/domain/' + name.split('/')[1] + '.ts');
    if (name.startsWith('.')) {
      const base = path.resolve(path.dirname(file), name);
      return load(fs.existsSync(base + '.ts') ? base + '.ts' : base + '.tsx');
    }
    return require(name);
  };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: requireLocal });
  return module.exports;
}
const { roomOverlayLayout } = load('apps/mobile/src/room/overlayLayout.ts');
const { companionPlacement } = load('apps/mobile/src/ui/shellLayout.ts');
const { roomOverlayChrome } = load('apps/mobile/src/room/theme.ts');
const { DEFAULT_ROOM_STYLE, resolveRoomLook } = load('apps/mobile/src/room/roomStyle.ts');
const { contrastRatio } = load('apps/mobile/src/ui/profileContrast.ts');
const { RoomMessage, roomMessageStyles } = load('apps/mobile/src/room/RoomMessage.tsx');
const screen = fs.readFileSync('apps/mobile/src/room/RoomWorldScreen.tsx', 'utf8');
for (const [width,height,top,bottom] of [[320,568,20,0],[375,667,20,0],[390,844,47,34],[393,852,59,34]]) {
  test(`${width}x${height}: measured EN/KO controls, safe areas and modes stay separated`, () => {
    for (const headerRows of [1,2,3]) for (const footerHeight of [0,44,108,240]) {
      const insets = { top,bottom,left:0,right:0 };
      const headerHeight = top+16+44*headerRows+16*(headerRows-1);
      const layout = roomOverlayLayout({ width,height,insets,headerHeight,footerHeight,hasFooter: footerHeight>0 });
      assert.equal(layout.messages.top-headerHeight,24);
      assert.ok(layout.messages.left>=16);
      assert.ok(layout.messages.left+layout.messages.width<=width-16);
      assert.ok(layout.messages.maxHeight>=0);
      if (layout.messages.maxHeight>0) assert.ok(height-(layout.messages.top+layout.messages.maxHeight)>=layout.footer.bottom+footerHeight+16);
      const heart=companionPlacement({insets,hasBottomNav:false});
      assert.ok(layout.footer.right >= heart.right+52+16);
    }
  });
}
test('asymmetric horizontal safe areas and rotation recompute bounds',()=>{
  const layout=roomOverlayLayout({width:844,height:390,insets:{top:0,bottom:21,left:59,right:0},headerHeight:60,footerHeight:90,hasFooter:true});
  assert.equal(layout.navigation.paddingLeft,75); assert.equal(layout.navigation.paddingRight,16);
  assert.ok(layout.messages.left>=75); assert.equal(layout.messages.top,84);
  assert.ok(layout.messages.left+layout.messages.width<=828);
});
for(const [wall,floor,furniture] of [['cream','oak','oak'],['ink','charcoal','ink'],['plum','walnut','walnut'],['blush','blush-wood','blush']]) {
  test(`${wall}/${floor}: shared message uses actual Room palette with readable text`,()=>{
    const chrome=roomOverlayChrome(resolveRoomLook({...DEFAULT_ROOM_STYLE,wall,floor,furniture}));
    assert.ok(contrastRatio(chrome.background,chrome.color)>=4.5);
    const node=RoomMessage({chrome,children:'message'});
    assert.equal(node.props.pointerEvents,'box-none');
    assert.equal(node.props.style[1].backgroundColor,chrome.background);
    assert.equal(node.props.style[1].borderColor,chrome.border);
    assert.equal(roomMessageStyles.surface.borderRadius,18);
    assert.ok(roomMessageStyles.surface.padding>=12);
  });
}
test('measured navigation/footer and bounded scroll stack integrate with normal, edit and inspection modes',()=>{
  assert.match(screen,/onLayout=\{measureHeader\}/);
  assert.match(screen,/onLayout=\{measureFooter\}/);
  assert.match(screen,/hasFooter: Boolean\(editing \|\| binderHeld/);
  assert.match(screen,/styles.messageStack, overlayLayout.messages/);
  assert.match(screen,/overlayActions:.*flexWrap: "wrap"/);
  assert.match(screen,/toolRow:.*flexWrap: "wrap"/);
  assert.doesNotMatch(screen,/top: insets.top \+ 52|bottom: insets.bottom \+ chrome.companionSize/);
});
test('placement feedback passes through, actionable save errors retain retry and accessibility',()=>{
  assert.match(screen,/<RoomMessage chrome=\{overlayTheme\} pointerEvents="none"><SeoullyText[^>]*>\{hint\}/);
  assert.match(screen,/<Pressable accessibilityRole="button" onPress=\{\(\) => void refresh\(\)\}><RoomMessage/);
  assert.match(screen,/accessibilityRole="alert" style=\{roomMessageStyles.text\}/);
  assert.match(screen,/<View pointerEvents="none" style=\{styles.overlaySpacer\}/);
  assert.match(screen,/<ScrollView pointerEvents="box-none"/);
  assert.match(screen,/messageStack: \{ position: "absolute" \}/);
});
test('first-home EN/KO guidance shares layout while completion, dismissal and retry stay unchanged',()=>{
  const intro=fs.readFileSync('apps/mobile/src/onboarding/OnboardingWorldIntro.tsx','utf8');
  assert.match(intro,/roomGuidance=\{\(\(messagesVisible/);
  assert.match(intro,/<RoomMessage chrome=\{chrome\}/);
  assert.match(intro,/setMessage\("dismissed"\)/);
  assert.match(intro,/void finish\(confirmed.current\)/);
  assert.match(intro,/onContinue\(\)/);
  assert.doesNotMatch(intro,/bottom: insets|numberOfLines/);
  for (const label of ['roomArrivalHome','roomArrivalEdit','roomArrivalFinish','onboardPlaceFirst']) assert.ok(intro.includes('copy.'+label));
  assert.equal(roomMessageStyles.text.lineHeight,19);
  assert.equal(roomMessageStyles.text.flexShrink,1);
});
test('all four existing sheet headers share spacing and keep their Modal behavior',()=>{
  for(const name of ['RoomShopSheet','RoomStyleSheet','StoredCollectionSheet','PhotoStringSheet']) {
    const source=fs.readFileSync(`apps/mobile/src/room/${name}.tsx`,'utf8');
    assert.match(source,/styles.header, roomMessageStyles.sheetHeader/);
    assert.match(source,/<Modal/);
    assert.match(source,/onRequestClose=\{onClose\}/);
    assert.match(source,/minHeight: 44/);
  }
  assert.equal(roomMessageStyles.sheetHeader.gap,16);
  assert.equal(roomMessageStyles.sheetHeader.marginBottom,16);
});
const sourceFile = ts.createSourceFile('RoomWorldScreen.tsx', screen, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const chromeFunction = sourceFile.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'OverlayChrome');
const context = {
  exports: {}, styles: {}, View: 'View', Pressable: 'Pressable', SeoullyText: 'Text',
  roomChromeSurface: load('apps/mobile/src/room/theme.ts').roomChromeSurface,
  require: () => ({ jsx: (type,props) => ({type,props}), jsxs: (type,props) => ({type,props}) }),
};
vm.createContext(context);
vm.runInContext(ts.transpileModule(chromeFunction.getText(sourceFile)+';this.renderChrome=OverlayChrome;', {
  compilerOptions: { module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX },
}).outputText, context);
function flatten(node) {
  if (!node || typeof node !== 'object') return [];
  return [node,...[node.props?.children].flat(Infinity).flatMap(flatten)];
}
for (const mode of ['normal','edit','public']) test(`${mode}: rendered top controls retain handlers and clear touch boundaries in EN/KO`,()=>{
  for(const labels of [{back:'Back',storedAccess:'Storage',editRoom:'Edit Room',cancelEditing:'Cancel'}, {back:'뒤로',storedAccess:'보관함 열기',editRoom:'나의 방 꾸미기',cancelEditing:'편집 취소'}]) {
    const called=[];
    const measure=()=>{};
    const tree=context.renderChrome({copy:labels,chrome:roomOverlayChrome(resolveRoomLook(DEFAULT_ROOM_STYLE)),onBack:()=>called.push('back'),onStorage:()=>called.push('storage'),onEdit:()=>called.push('edit'),onCancel:()=>called.push('cancel'),onLayout:measure,showStorage:true,editing:mode==='edit',readOnly:mode==='public'});
    assert.equal(tree.props.pointerEvents,'box-none');
    assert.equal(tree.props.onLayout,measure);
    const nodes=flatten(tree);
    assert.ok(nodes.filter(node=>node.type==='View').every(node=>['none','box-none'].includes(node.props.pointerEvents)));
    const buttons=nodes.filter(node=>node.type==='Pressable');
    assert.equal(buttons.length,mode==='public'?1:3);
    buttons.forEach(node=>node.props.onPress());
    assert.deepEqual(called,mode==='public'?['back']:['back','storage',mode==='edit'?'cancel':'edit']);
  }
});
