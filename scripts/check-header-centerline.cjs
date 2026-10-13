const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
function load(file,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>mocks[n]});return m.exports}
const theme=load('apps/mobile/src/theme.ts'),shell=load('apps/mobile/src/ui/shellLayout.ts',{'../theme':theme});
for(const scale of [1,1.3,2,3])for(const top of [0,20,47,59])test(`header centerline matches every control at font scale ${scale}, safe top ${top}`,()=>{
 const metrics=shell.topHeaderMetrics(scale);
 assert.equal(top+metrics.controlTop+metrics.controlHeight/2,top+metrics.center);
 assert.ok(metrics.controlHeight>=44);assert.ok(metrics.height>=52);assert.ok(metrics.controlTop>=0);
 assert.ok(metrics.height>=theme.type.title.lineHeight*scale);assert.equal(shell.topHeaderRow.alignItems,'center');
});
for(const label of ['Back','뒤로','Return to collection','컬렉션으로 돌아가기'])test(`real Back row centers original control and retains click target: ${label}`,()=>{
 const jsx=(type,props)=>({type,props});let tapped=0;
 const Back=load('apps/mobile/src/components/ScreenBack.tsx',{'../ui/shellLayout':shell,'../theme':theme,'../ui/SeoullyText':{SeoullyText:'Text'},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Pressable:'Pressable',StyleSheet:{create:x=>x},useWindowDimensions:()=>({fontScale:1})}}).ScreenBack;
 const tree=Back({label,onPress:()=>tapped++});assert.equal(tree.props.pointerEvents,'box-none');assert.equal(tree.props.style[0].alignItems,'center');assert.equal(tree.props.style[1].minHeight,52);
 const button=tree.props.children;assert.equal(button.props.style[1].minHeight,44);assert.equal(button.props.style[0].alignSelf,undefined);assert.equal(button.props.children.props.children,label);button.props.onPress();assert.equal(tapped,1);
});
test('toggle, social bell, and Room controls consume the same metrics; no per-screen axis offsets',()=>{
 const global=read('apps/mobile/src/ui/GlobalLanguageControl.tsx'),social=read('apps/mobile/src/ui/SeoullyHeader.tsx'),room=read('apps/mobile/src/room/RoomWorldScreen.tsx');
 for(const s of [global,social,room])assert.match(s,/topHeaderMetrics\(useWindowDimensions\(\).fontScale\)/);
 assert.match(global,/top: insets.top \+ header.controlTop/);assert.match(social,/top: header.controlTop/);assert.match(social,/topHeaderRow/);
 assert.match(room,/minHeight: header.controlHeight/);assert.match(read('apps/mobile/src/room/overlayLayout.ts'),/paddingTop: insets.top \+ topHeaderMetrics\(fontScale\).controlTop/);
 assert.match(global,/blocked \|\| boot.destination === "loading"/);assert.match(global,/pointerEvents="box-none"/);
});
test('onboarding keeps editorial title below navigation and reserves the same row even without Back',()=>{
 const source=read('apps/mobile/app/onboarding.tsx');assert.match(source,/paddingTop: header.height/);assert.match(source,/headline: \{ marginTop: 32/);assert.match(source,/<ScreenBack/);
 assert.match(read('apps/mobile/app/collect.tsx'),/paddingTop: header.height \+ 24/);
});
test('full-screen crop modal and Edit Profile center titles with shared rows; bottom sheets retain local headers',()=>{
 const crop=read('apps/mobile/src/media/PhotocardCropper.tsx'),edit=read('apps/mobile/app/edit-profile.tsx');
 assert.match(crop,/topHeaderRow, \{ minHeight: header.height/);assert.match(crop,/paddingRight: languageWidth \+ 18/);assert.match(crop,/<SeoullyText control variant="title"/);assert.match(crop,/paddingTop: 0/);
 assert.match(edit,/styles.top, topHeaderRow, \{ minHeight: header.height/);assert.match(edit,/<SeoullyText control variant="handle">\{copy.profileEdit\}/);
 for(const name of ['RoomShopSheet','RoomStyleSheet','StoredCollectionSheet','PhotoStringSheet'])assert.match(read(`apps/mobile/src/room/${name}.tsx`),/styles.header, roomMessageStyles.sheetHeader/);
});
for(const scale of [1,2,3])for(const locale of ['en','ko'])test(`actual global control and social bell share rendered center at ${locale}, font scale ${scale}`,()=>{
 const jsx=(type,props)=>({type,props}),insets={top:59,right:0,bottom:34,left:0};
 const react={createContext:value=>({value}),useContext:c=>c.value,useCallback:f=>f,useState:v=>[typeof v==='function'?v():v,()=>{}],useLayoutEffect:()=>{}};
 const rn={View:'View',Pressable:'Pressable',Modal:'Modal',StyleSheet:{create:x=>x,hairlineWidth:1},useWindowDimensions:()=>({width:320,height:568,fontScale:scale})};
 const common={'react':react,'react-native':rn,'react/jsx-runtime':{jsx,jsxs:jsx},'expo-router':{useFocusEffect:()=>{},useRouter:()=>({push(){}})},'../locale':{useCopy:()=>({switchLanguage:locale==='en'?'한국어':'English',notices:locale==='en'?'Notifications':'알림'}),useLocale:()=>({toggleLocale(){}})},'../theme':theme,'./shellLayout':shell,'./motion':{useReduceMotion:()=>false,pressShift:()=>null},'./SeoullyText':{SeoullyText:'Text'},'./ProfileIdentity':{usePublishedProfileIdentity:()=>null,useProfileIdentity:()=>null,useProfileInk:()=>theme.colors.ink,useProfileMute:()=>theme.colors.muted},'react-native-safe-area-context':{useSafeAreaInsets:()=>insets},'../startup/BootstrapProvider':{useBootstrap:()=>({destination:'app'})},'./SeoullyLoadingState':{useBlockingLoadingActive:()=>false}};
 const Global=load('apps/mobile/src/ui/GlobalLanguageControl.tsx',common).GlobalLanguageControl;
 const Header=load('apps/mobile/src/ui/SeoullyHeader.tsx',{...common,'../data':{isDemoWorldAllowed:()=>false,useDataMode:()=>({demo:false}),useSocialRepository:()=>({})},'./BrandMark':{BrandMark:'Brand'},'./icons':{IconBell:'Bell'},'./GlobalLanguageControl':{useLanguageControlWidth:()=>64}}).SeoullyHeader;
 const control=Global({}).props.children,header=Header({});const bell=header.props.children.find(node=>node?.type==='Pressable');
 const flatten=styles=>Object.assign({},...styles.filter(Boolean));const controlStyle=flatten(control.props.style({pressed:false})),bellStyle=flatten(bell.props.style({pressed:false}));
 assert.equal(controlStyle.top+controlStyle.minHeight/2,insets.top+bellStyle.top+bellStyle.height/2);
 assert.equal(controlStyle.right,16);assert.ok(bellStyle.right>controlStyle.right);assert.equal(header.props.style[1].alignItems,'center');
});
test('large-text Room guidance clears the shared top row before header measurement arrives',()=>{
 const layout=load('apps/mobile/src/room/overlayLayout.ts',{'../ui/shellLayout':shell,'../ui/heartMotion':{heartMotion:{travel:6}}}).roomOverlayLayout;
 for(const fontScale of [1,2,3]){
  const insets={top:59,right:0,left:0,bottom:34},result=layout({width:320,height:568,insets,fontScale});
  assert.ok(result.messages.top>=insets.top+shell.topHeaderMetrics(fontScale).height+24);
  assert.equal(result.navigation.paddingTop+shell.topHeaderMetrics(fontScale).controlHeight/2,insets.top+shell.topHeaderMetrics(fontScale).center);
 }
});
