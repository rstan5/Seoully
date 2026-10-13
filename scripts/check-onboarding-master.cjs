const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');function load(file,mocks={}){const m={exports:{}};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{module:m,exports:m.exports,require:n=>mocks[n]});return m.exports}
const presentation=load('apps/mobile/src/onboarding/presentation.ts'),journey=load('apps/mobile/src/onboarding/journey.ts');
for(const path of ['/onboarding','/collect','/add'])test(`guided ${path} does not mount or animate a persistent companion`,()=>{
 const jsx=(type,props)=>({type,props});let eligible=true;
 const Host=load('apps/mobile/src/ui/SeoullyCompanionHost.tsx',{'expo-router':{usePathname:()=>path,useGlobalSearchParams:()=>({from:'onboarding'})},'../onboarding/presentation':presentation,'../startup/BootstrapProvider':{useBootstrap:()=>({companionEligible:eligible})},'./SeoullyCompanion':{SeoullyCompanion:'Companion'},'react/jsx-runtime':{jsx,jsxs:jsx}}).SeoullyCompanionHost;
 assert.equal(Host(),null);eligible=false;assert.equal(Host(),null);
});
test('normal completed Profile mounts exactly one helper; final guided Room owns its existing handoff',()=>{
 const jsx=(type,props)=>({type,props});let eligible=true;
 const Host=load('apps/mobile/src/ui/SeoullyCompanionHost.tsx',{'expo-router':{usePathname:()=>'/profile',useGlobalSearchParams:()=>({})},'../onboarding/presentation':presentation,'../startup/BootstrapProvider':{useBootstrap:()=>({companionEligible:eligible})},'./SeoullyCompanion':{SeoullyCompanion:'Companion'},'react/jsx-runtime':{jsx,jsxs:jsx}}).SeoullyCompanionHost;
 assert.equal(Host().type,'Companion');eligible=false;assert.equal(Host(),null);
 assert.match(read('apps/mobile/app/_layout.tsx'),/<SeoullyCompanionHost \/>/);assert.doesNotMatch(read('apps/mobile/app/_layout.tsx'),/<SeoullyCompanion \/>/);
 assert.match(read('apps/mobile/src/onboarding/OnboardingWorldIntro.tsx'),/ready && handoff \? <SeoullyCompanion onboardingActive/);
});
test('Back from first collectible resumes interests without collecting again; owned destination still wins',()=>{
 assert.equal(journey.resolveOnboardingPhase({durableStep:'interest',holdingCount:0,interestsSaved:true,requestedPhase:'interest'}),'interest');
 assert.equal(journey.resolveOnboardingPhase({durableStep:'interest',holdingCount:1,interestsSaved:true,requestedPhase:'interest'}),'room');
 assert.equal(journey.resolveOnboardingPhase({durableStep:'done',holdingCount:1,requestedPhase:'interest'}),'app');
 assert.match(read('apps/mobile/app/collect.tsx'),/params: \{ phase: "interest", back: "1" \}/);
});
test('all normal identity stages share Back/header and anchored localized headings',()=>{
 const source=read('apps/mobile/app/onboarding.tsx');assert.match(source,/<ScreenBack disabled=\{saving \|\| tastePending > 0\} label=\{phase === "group" && !editingTastes \? t.signOut : t.back\}/);
 assert.doesNotMatch(source,/paddingTop: header.height|phase === "interest" \? \(\s*<ScreenBack/);
 assert.match(source,/styles.headline, onboardingHeading/);assert.match(source,/styles.lead, onboardingDescription/);
 assert.match(source,/phase === "bias"\) setPhase\("group"\)/);assert.match(source,/phase === "archetype"\) setPhase\("bias"\)/);
 assert.match(source,/supabase.auth.signOut\(\)/);assert.match(source,/saveOnboardingIdentityDraft\(identityUserId/);
 assert.match(source,/keyboardShouldPersistTaps="handled"/);assert.match(source,/keyboardDismissMode="on-drag"/);
});
for(const scale of [1,2,3])test(`comparable content starts header + 32 points at text scale ${scale}`,()=>{
 const theme=load('apps/mobile/src/theme.ts'),shell=load('apps/mobile/src/ui/shellLayout.ts',{'../theme':theme});const header=shell.topHeaderMetrics(scale);
 for(const safeTop of [20,47,59])for(const stage of ['group','bias','archetype','interest','collect']){
  assert.equal(safeTop+header.height+presentation.onboardingHeading.marginTop,safeTop+header.height+32);assert.equal(presentation.onboardingDescription.marginTop,6);
 }
 for(const file of ['apps/mobile/app/onboarding.tsx','apps/mobile/app/collect.tsx','apps/mobile/app/add.tsx'])assert.match(read(file),/onboardingHeading/);
});
test('auth, crop and saved-confirmation Back routes preserve existing draft and owned Holding',()=>{
 assert.match(read('apps/mobile/app/index.tsx'),/<ScreenBack disabled=\{submitting\} label=\{t.back\}/);
 assert.match(read('apps/mobile/src/media/PhotocardCropper.tsx'),/<ScreenBack label=\{backLabel\}/);
 const add=read('apps/mobile/app/add.tsx');assert.match(add,/header=\{fromOnboarding \? <View/);assert.match(add,/holdingId: savedHoldingId/);
 assert.match(read('apps/mobile/src/ui/SeoullyMessageScreen.tsx'),/\{header\}/);
});
test('loading cadence changes alone while helper rhythm and dialogue scheduling remain unchanged',()=>{
 const motion=load('apps/mobile/src/ui/heartMotion.ts');assert.equal(motion.heartMotion.halfCycleMs,1000);assert.equal(motion.loadingHeartHalfCycleMs,875);assert.equal(motion.heartMotion.travel,6);assert.equal(motion.heartMotion.characterMs,32);
 const scene=load('apps/mobile/src/ui/heartScene.ts');assert.equal(scene.dialogueMotionTiming.entrance,600);assert.equal(scene.dialogueMotionTiming.exit,500);assert.equal(scene.dialogueReadingMs(1),2500);assert.equal(scene.dialogueReadingMs(1000),5500);
 assert.match(read('apps/mobile/src/ui/HeartFarewell.tsx'),/Math.min\(150, Math.max\(110, height \* 0.17\)/);
});

test('explicit Back restores input stages without replaying completed heart dialogue',()=>{const source=read('apps/mobile/app/onboarding.tsx');assert.match(source,/params.back === "1" && resolved === "interest"/);assert.match(source,/new Set<OnboardingPhase>\(\[...previous, "group", "bias", "archetype", "interest", "collect"\]\)/);assert.match(source,/params.holdingId, params.back/)});
