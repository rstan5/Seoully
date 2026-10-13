const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props, key) => ({ type, props, key });
const flatten = value => Array.isArray(value) ? Object.assign({}, ...value.filter(Boolean).map(flatten)) : value;
function load(file, mocks) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText, {module,exports:module.exports,require:name=>mocks[name]??require(name)});
 return module.exports;
}
const runtime = {'react/jsx-runtime':{jsx,jsxs:jsx},'react':{Fragment:'Fragment'},'react-native':{Text:'Text',StyleSheet:{flatten}}};
const hearts = load('apps/mobile/src/ui/InlineHeart.tsx',runtime);
for(const family of ['Baloo2','NotoSansKR'])for(const [weight,label] of [[400,'Regular'],[600,'SemiBold'],[700,'Bold']]) {
 test(`${family} ${weight}: selects exact font/weight and inherits size, line height and scaling`,()=>{
  const element=hearts.InlineHeart({fontFamily:`${family}_${weight}${label}`});
  assert.equal(element.props.children,'♡');assert.equal(element.props.style.fontFamily,`SeoullyHeart${family}${weight}`);
  for(const field of ['fontSize','lineHeight','transform','marginTop','height','allowFontScaling'])assert.equal(element.props.style[field],undefined);
 });
}
test('explicit weight resolves without synthesizing a second bold glyph',()=>{assert.equal(hearts.inlineHeartFont('Baloo2_400Regular','700'),'SeoullyHeartBaloo2700');assert.equal(hearts.InlineHeart({fontFamily:'Baloo2_700Bold'}).props.style.fontWeight,'normal')});
for(const text of ['Home ♡','내 세상 ♡','First ♡\nSecond ♡','♡','No decorative heart'])test(`literal/localized wrapping survives: ${text}`,()=>{
 const output=hearts.withInlineHearts(text,'Baloo2_400Regular');
 const recovered=Array.isArray(output)?output.map(item=>typeof item==='string'?item:item.type(item.props).props.children).join(''):output;
 assert.equal(recovered,text);
});
test('nested typewriter opacity and child handlers remain untouched',()=>{
 const reserved={type:'Text',props:{style:{opacity:0},children:'not yet ♡',onPress(){}}};
 const output=hearts.withInlineHearts(['Hello',reserved],'Baloo2_400Regular');assert.equal(output[1].props.children,reserved);
});
for(const locale of ['en','ko'])for(const size of [11,14,18,24,42,64])test(`shared rendered Text receives current ${locale} ${size}pt metrics`,()=>{
 const theme={faces:{en:{bold:'Baloo2_700Bold'},ko:{bold:'NotoSansKR_700Bold'}},type:{title:{face:'bold',fontSize:24,lineHeight:30}},colors:{ink:'#000'}};
 const {SeoullyText}=load('apps/mobile/src/ui/SeoullyText.tsx',{...runtime,'../locale':{useLocale:()=>({locale})},'../theme':theme,'./ProfileIdentity':{useProfileIdentity:()=>null},'./InlineHeart':hearts});
 const tree=SeoullyText({variant:'title',style:{fontSize:size,lineHeight:size*1.2},children:'Home ♡',allowFontScaling:true});
 assert.equal(flatten(tree.props.style).fontSize,size);assert.equal(tree.props.allowFontScaling,true);
 const glyph=tree.props.children[1];assert.equal(glyph.props.fontFamily,theme.faces[locale].bold);
 assert.equal(glyph.type(glyph.props).props.style.fontFamily,`SeoullyHeart${locale==='en'?'Baloo2':'NotoSansKR'}700`);
});
test('font assets are tiny, bundled before native content, with Unicode-only web fallback and icon exemption',()=>{
 const metrics=JSON.parse(fs.readFileSync('public/fonts/inline-heart/metrics.json'));
 const css=fs.readFileSync('src/design/inline-heart.css','utf8');const fonts=fs.readFileSync('apps/mobile/src/fonts.tsx','utf8');
 for(const item of metrics){assert.ok(fs.statSync(`public/fonts/inline-heart/${item.font}.ttf`).size<5000);assert.ok(item.top>0&&item.bottom<=0);if([400,600,700].includes(item.weight))assert.ok(fonts.includes(item.font));}
 assert.equal((css.match(/unicode-range: U\+2661/g)||[]).length,5);assert.match(css,/\.s-independent-heart/);
 assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/vertical-align|line-height:\s*\d|margin-top/);
});
test('auth reserves full-size inline heart until typewriter completion; welcome unchanged',()=>{
 const s=fs.readFileSync('apps/mobile/src/ui/HeartGreeting.tsx','utf8');assert.match(s,/opacity: shown >= text.length \? 1 : 0/);assert.match(s,/variant="title" style=\{\[large && styles.large/);assert.doesNotMatch(s,/fontSize: 30/);
 const account=fs.readFileSync('apps/mobile/app/index.tsx','utf8');assert.match(account,/showHeart=\{false\} inlineHeart/);assert.match(account,/<HeartGreeting key=\{[^\n]+\} large text=/);
});
