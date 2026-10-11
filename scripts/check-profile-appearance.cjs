const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file,mocks={}) {
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{
    module,exports:module.exports,require(name) {
      if(name==='server-only') return {};
      if(Object.hasOwn(mocks,name)) return mocks[name];
      if(name.startsWith('@/server/supabase/')) return {};
      return require(name);
    },Request,Response,Error,
  });return module.exports;
}
const themes=load('src/domain/profile-theme.ts');
const validation=load('src/domain/profile-appearance.ts',{'./profile-theme':themes});
const dal=load('src/server/dal/profile.ts',{'@/domain/profile-appearance':validation,'@/domain/session':{normalizeHandle:x=>x.trim().toLowerCase()}});
const clean=x=>JSON.parse(JSON.stringify(x));
const uid='a8060000-0000-4000-8000-000000000001';
function client({authenticated=true,appearance={mode:'default'},failWrite=false}={}) {
  const row={user_id:uid,handle:'appearance_a',display_name:'Collector',tagline:'Keep tagline',bio:'Keep bio',location:'Keep location',favorite_group_ids:['g'],bias_member_ids:['m'],favorite_era_ids:[],collector_interests:['photocards'],collector_type:'Collector',created_at:'2026-10-01T00:00:00Z',collection_public:false,wishlist_public:false,appearance,private_path:'must-not-project',auth_subject:'must-not-project'};
  const writes=[],reads=[],rpcs=[];
  const c={row,writes,reads,rpcs,auth:{getUser:async()=>({data:{user:authenticated?{id:'auth-fixture'}:null},error:null})},
    async rpc(name){rpcs.push(name);return {data:name==='ensure_current_seoully_identity'?uid:null,error:null}},
    from(table){let patch;const filters=[];
      const q={select(columns){reads.push({table,columns});return q},update(payload){patch=payload;return q},eq(k,v){filters.push([k,v]);return q},
        async maybeSingle(){return {data:table==='users'?{id:uid,status:'active',created_at:row.created_at}:filters.every(([k,v])=>row[k]===v)?row:null,error:null}},
        then(resolve,reject){if(patch&&!failWrite){assert.deepEqual(filters,[['user_id',uid]]);assert.equal(table,'profiles');writes.push(clean(patch));Object.assign(row,patch)}return Promise.resolve({data:[],count:0,error:patch&&failWrite?{code:'offline'}:null}).then(resolve,reject)}};return q;
    }};return c;
}
for(const mode of ['default','custom','room-sync']) test(`${mode}: authenticated update returns persisted choice without touching unrelated identity/Room`,async()=>{
  const c=client();const choice=mode==='custom'?{mode,background:'deep-navy',primary:'rose',secondary:'mint'}:{mode};
  const result=await dal.updateCurrentProfile({appearance:choice},c);
  assert.deepEqual(clean(result.profile.appearance),choice);
  assert.deepEqual(c.writes,[{appearance:choice}]);
  assert.equal(result.profile.bio,'Keep bio');assert.equal(result.profile.location,'Keep location');
  assert.ok(c.reads.every(x=>['users','profiles'].includes(x.table)));
  assert.ok(!c.rpcs.some(x=>x.includes('room')));
});
test('legacy omitted appearance reads Default and unrelated updates preserve Custom',async()=>{
  const old=client();delete old.row.appearance;
  assert.deepEqual(clean((await dal.getCurrentIdentityFromClient(old)).profile.appearance),{mode:'default'});
  const c=client({appearance:{mode:'custom',background:'mint'}});
  const result=await dal.updateCurrentProfile({bio:'Updated'},c);
  assert.deepEqual(c.writes,[{bio:'Updated'}]);assert.deepEqual(clean(result.profile.appearance),{mode:'custom',background:'mint'});
});
test('all existing background/accent presets, optional defaults and deprecated tint validate',()=>{
  for(const preset of themes.BACKGROUND_PRESETS) assert.ok(validation.profileAppearanceSchema.safeParse({mode:'custom',background:preset.id}).success);
  for(const preset of themes.ACCENT_PRESETS) for(const key of ['primary','secondary','tint']) assert.ok(validation.profileAppearanceSchema.safeParse({mode:'custom',[key]:preset.id}).success);
  assert.ok(validation.profileAppearanceSchema.safeParse({mode:'custom'}).success);
  const legacy={mode:'custom',tint:'soft-lilac'};
  assert.deepEqual(clean(validation.profileAppearanceSchema.parse(legacy)),legacy);
});
test('unknown modes, arbitrary colors, types, missing keys and private metadata reject before writes',async()=>{
  for(const appearance of [null,[],{},'custom',{mode:'unknown'},{mode:'custom',background:'#abcdef'},{mode:'custom',primary:1},{mode:'custom',primary:null},{mode:'default',privatePath:'hidden'},{mode:'custom',secondary:'url(private)'}]) {
    const c=client();await assert.rejects(dal.updateCurrentProfile({appearance},c));assert.equal(c.writes.length,0);
  }
});
test('unauthenticated and caller-supplied identity updates are rejected',async()=>{
  const c=client({authenticated:false});await assert.rejects(dal.updateCurrentProfile({appearance:{mode:'room-sync'}},c),/unauthenticated/);assert.equal(c.writes.length,0);
  for(const key of ['userId','user_id','auth_subject']) {const c=client();await assert.rejects(dal.updateCurrentProfile({[key]:'other',appearance:{mode:'default'}},c));assert.equal(c.writes.length,0)}
});
test('write failure never returns fake persisted success',async()=>{
  const c=client({failWrite:true});await assert.rejects(dal.updateCurrentProfile({appearance:{mode:'room-sync'}},c),/profile_update_failed/);assert.deepEqual(c.row.appearance,{mode:'default'});
});
for(const method of ['getPublicProfile','getPublicProfileByHandle']) test(`${method}: explicit safe projection includes preference without private data`,async()=>{
  const c=client({appearance:{mode:'room-sync'}});
  let result;
  if(method==='getPublicProfile') result=await dal.getPublicProfile(uid,c);
  else {
    const bound=load('src/server/dal/profile.ts',{'@/domain/profile-appearance':validation,'@/domain/session':{normalizeHandle:x=>x.trim().toLowerCase()},'@/server/supabase/server':{createSupabaseServerClient:async()=>c}});
    result=await bound.getPublicProfileByHandle('@appearance_a');
  }
  assert.deepEqual(clean(result.profile.appearance),{mode:'room-sync'});
  assert.deepEqual(Object.keys(result.profile).sort(),['appearance','userId','tagline','bio','favoriteGroupIds','biasMemberIds','favoriteEraIds','collectorInterests','collectorType','location'].sort());
  assert.ok(!JSON.stringify(result).includes('must-not-project'));
  assert.equal(result.visibility.collectionPublic,false);assert.equal(result.roomAvailable,false);
  for(const read of c.reads.filter(x=>x.table==='profiles')) {assert.ok(read.columns.includes('appearance'));assert.ok(!read.columns.includes('*'));assert.ok(!read.columns.includes('auth_subject'));}
});
test('native and web existing callers transport confirmed preference through existing Profile path',()=>{
  const api=fs.readFileSync('apps/mobile/src/api.ts','utf8');
  assert.match(api,/appearance\?: ProfileThemeChoice/);
  assert.match(api,/updateNativeProfile\(input:.*appearance\?: ProfileThemeChoice/);
  const production=fs.readFileSync('apps/mobile/src/data/production.ts','utf8');assert.match(production,/appearance: result.profile.profile.appearance/);
  const web=fs.readFileSync('src/world/ui/EditProfile.tsx','utf8');
  assert.match(web,/updateMySeoullyProfile\(\{ \.\.\.patch, appearance: persistAppearance\(appearance\) \}\)/);
  assert.match(web,/adoptAuthenticatedIdentity\(result.identity\)/);
  assert.doesNotMatch(web,/repository.updateProfile\(userId, \{ avatarUrl, appearance/);
});
test('SQL CHECK allowlist matches the typed presets and migration changes only Profile',()=>{
  const sql=fs.readFileSync('supabase/migrations/20261006000000_profile_appearance.sql','utf8');
  for(const preset of [...themes.BACKGROUND_PRESETS,...themes.ACCENT_PRESETS]) assert.ok(sql.includes("'"+preset.id+"'"));
  assert.match(sql,/add column appearance jsonb not null default/);
  assert.match(sql,/grant update \(appearance\) on public.profiles to authenticated/);
  assert.doesNotMatch(sql,/create (?:or replace )?function|(?:alter|create|drop) policy|update public\.|delete from|public\.rooms|to anon/);
});
function apiRoute(c) {
  return load('src/app/api/mobile/profile/route.ts',{'@/server/dal/profile':dal,'@/server/supabase/bearer':{createSupabaseBearerClient:()=>c}});
}
const request=body=>new Request('http://fixture.local/api/mobile/profile',{method:'PATCH',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});
test('existing PATCH endpoint saves and returns persisted appearance',async()=>{
  const c=client();const response=await apiRoute(c).PATCH(request({appearance:{mode:'room-sync'}}));
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).identity.profile.appearance,{mode:'room-sync'});
});
test('existing PATCH endpoint rejects absent and expired authentication with 401',async()=>{
  for(const c of [null,client({authenticated:false})]) {
    assert.equal((await apiRoute(c).PATCH(request({appearance:{mode:'default'}}))).status,401);
    if(c)assert.equal(c.writes.length,0);
  }
});
test('existing PATCH endpoint rejects malformed appearance with 400 and no write',async()=>{
  const c=client();assert.equal((await apiRoute(c).PATCH(request({appearance:{mode:'custom',primary:'#ff0000'}}))).status,400);assert.equal(c.writes.length,0);
});
