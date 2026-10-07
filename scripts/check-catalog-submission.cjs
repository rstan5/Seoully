const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const box = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/mobile/src/catalogSubmission.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:box,exports:box.exports});
const { createCatalogSubmitter } = box.exports;
const details = { name:'Card',kind:'photocard',groupName:'Group' };
function setup(send) {
  const records = new Map(); let keys = 0;
  const storage = {async getItem(k){return records.get(k) ?? null},async setItem(k,v){records.set(k,v)},async removeItem(k){records.delete(k)}};
  const factory = () => createCatalogSubmitter(storage, () => `key-${++keys}`, send);
  return { factory,records,storage,keys:()=>keys };
}
test('lost response retry and relaunch keep one durable operation key',async()=>{
  const seen=[];let calls=0;
  const s=setup(async(owner,p)=>{seen.push(p.submissionKey);if(++calls===1)throw Error('lost response');return {template:'original'}});
  await assert.rejects(s.factory()('owner',details));
  assert.equal(s.records.size,1);
  const result=await s.factory()('owner',details);
  assert.equal(result.template,'original');assert.deepEqual(seen,['key-1','key-1']);assert.equal(s.keys(),1);assert.equal(s.records.size,0);
});
test('rapid duplicate presses coalesce request and generate only one key',async()=>{
  let resolve;const wait=new Promise(r=>resolve=r);let calls=0;
  const s=setup(async()=>{calls++;await wait;return 'ok'}),submit=s.factory();
  const a=submit('owner',details),b=submit('owner',details);
  assert.equal(a,b);resolve();await Promise.all([a,b]);assert.equal(calls,1);assert.equal(s.keys(),1);
});
test('confirmed operation followed by intentional new submission gets new key',async()=>{
  const seen=[];const s=setup(async(_,p)=>{seen.push(p.submissionKey);return 'ok'}),submit=s.factory();
  await submit('owner',details);await submit('owner',details);assert.deepEqual(seen,['key-1','key-2']);
});
test('different collectors do not share pending keys',async()=>{
  const seen=[];const s=setup(async(owner,p)=>{seen.push([owner,p.submissionKey]);throw Error('offline')}),submit=s.factory();
  await assert.rejects(submit('a',details));await assert.rejects(submit('b',details));assert.deepEqual(seen,[['a','key-1'],['b','key-2']]);
});
test('edited details are distinct; returning to unresolved details reuses original key',async()=>{
  const seen=[];const s=setup(async(_,p)=>{seen.push(p.submissionKey);throw Error('offline')}),submit=s.factory();
  await assert.rejects(submit('a',details));await assert.rejects(submit('a',{...details,name:'Different'}));await assert.rejects(submit('a',details));assert.deepEqual(seen,['key-1','key-2','key-1']);
});
test('storage failure never sends an operation whose key is not durable',async()=>{
  let calls=0;const s=setup(async()=>{calls++});s.storage.setItem=async()=>{throw Error('disk')};
  await assert.rejects(s.factory()('a',details));assert.equal(calls,0);
});
test('draft canonicalization preserves retry identity despite optional fields/order',async()=>{
  const seen=[];const s=setup(async(_,p)=>{seen.push(p.submissionKey);throw Error('offline')}),submit=s.factory();
  await assert.rejects(submit('a',details));await assert.rejects(submit('a',{groupName:' Group ',kind:'photocard',name:' Card ',memberName:''}));assert.deepEqual(seen,['key-1','key-1']);
});
test('native orchestration only contributes catalog metadata; no Holding/Media writes',()=>{
  const collect=fs.readFileSync('apps/mobile/app/collect.tsx','utf8');
  assert.match(collect,/await submitManualCatalog\(/);assert.match(collect,/if \(submitting.current\) return/);
  assert.match(collect,/openPhoto\(result.contribution.template/);
  for(const file of ['apps/mobile/src/catalogSubmission.ts','apps/mobile/src/manualCatalog.ts']) {
    assert.doesNotMatch(fs.readFileSync(file,'utf8'),/createHolding|uploadHolding|createMediaAsset|\.from\(/);
  }
  const api=fs.readFileSync('apps/mobile/src/api.ts','utf8');assert.match(api,/contributeCatalogItem\(input: \{ submissionKey: string/);
  assert.match(fs.readFileSync('src/server/dal/catalog.ts','utf8'),/submissionKey: z.string\(\).uuid\(\).optional\(\)/);
});
function load(file,mocks={},globals={}) {
  const module={exports:{}};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {module,exports:module.exports,require(name){if(name==='server-only')return {};if(Object.hasOwn(mocks,name))return mocks[name];return require(name)},...globals});
  return module.exports;
}
test('real native API sends the durable submission key unchanged over retries',async()=>{
  const sent=[];let calls=0;
  const api=load('apps/mobile/src/api.ts',{'./config-rules':{isProductApiConfigured:()=>true},'./supabase':{supabase:{auth:{async getSession(){return {data:{session:{access_token:'fixture-only'}}}}}}}},
    {process:{env:{EXPO_PUBLIC_API_URL:'http://fixture.local'}},fetch:async(url,request)=>{sent.push(JSON.parse(request.body));if(++calls===1)throw Error('lost');return {ok:true,json:async()=>({contribution:{template:{id:'original'}}})}}});
  const s=setup((_,payload)=>api.contributeCatalogItem(payload));
  await assert.rejects(s.factory()('owner',details));const result=await s.factory()('owner',details);
  assert.equal(result.contribution.template.id,'original');assert.equal(sent.length,2);assert.equal(sent[0].submissionKey,sent[1].submissionKey);
});
test('real DAL accepts keyed and legacy requests, rejects malformed/forged identity, forwards key',async()=>{
  const identity={user:{id:'collector'}};
  const dal=load('src/server/dal/catalog.ts',{
    '@/server/dal/profile':{getCurrentIdentityFromClient:async()=>identity,getCurrentIdentity:async()=>identity},
    '@/server/supabase/server':{},'@/server/supabase/request-client':{}
  });
  const key='b8050000-0000-4000-8000-000000000001';
  const payload=dal.catalogContributionSchema.parse({...details,submissionKey:key});assert.equal(payload.submissionKey,key);
  assert.equal(dal.catalogContributionSchema.parse(details).submissionKey,undefined);
  assert.throws(()=>dal.catalogContributionSchema.parse({...details,submissionKey:'bad'}));
  assert.throws(()=>dal.catalogContributionSchema.parse({...details,contributorUserId:'forged'}));
  let calls=0;
  const client={async rpc(name,args){calls++;assert.equal(name,'create_catalog_contribution');assert.equal(args.p_payload.submissionKey,key);return {data:{template:{id:'template',group_id:'group',name:'Card',kind:'photocard'},contributor_user_id:'collector',created:true}}},
    from(){return {select(){return {in:async()=>({data:[{id:'group',name:'Group'}]})}}}}};
  const result=await dal.createSharedCatalogContribution(payload,client);assert.equal(result.template.id,'template');assert.equal(calls,1);
});
function manualHandler(overrides={}) {
  const source=fs.readFileSync('apps/mobile/app/collect.tsx','utf8');
  const start=source.indexOf('  async function submitManual()');
  const end=source.indexOf('\n  return (',start);
  const scope={social:{kind:'live'},copy:{demoWriteBlocked:'demo',collectibleNameRequired:'name',groupNameRequired:'group',collectibleCreateFailed:'failed'},
    name:'Card',groupName:'Group',memberName:'',releaseName:'',kind:'photocard',versionName:'',submitting:{current:false},
    setWorking:()=>{},setMessage:()=>{},...overrides};
  vm.runInNewContext(source.slice(start,end)+'\nthis.submit = submitManual;',scope);
  return scope.submit;
}
test('actual manual screen double-tap opens existing Add flow once after catalog confirmation',async()=>{
  let resolve;const response=new Promise(r=>resolve=r);let creates=0,opened=0;
  const submit=manualHandler({submitManualCatalog:async()=>{creates++;return response},openPhoto:()=>{opened++}});
  const first=submit();await submit();assert.equal(creates,1);assert.equal(opened,0);
  resolve({contribution:{template:{id:'template'}}});await first;assert.equal(opened,1);
});
test('actual manual screen keeps failed catalog creation retryable without opening Holding/media flow',async()=>{
  let calls=0,opened=0;const messages=[];
  const submit=manualHandler({submitManualCatalog:async()=>{if(++calls===1)throw Error('lost');return {contribution:{template:{id:'same'}}}},openPhoto:()=>{opened++},setMessage:m=>messages.push(m)});
  await submit();assert.equal(opened,0);assert.ok(messages.includes('failed'));
  await submit();assert.equal(opened,1);assert.equal(calls,2);
});
test('actual manual Demo path retains write-blocked behavior',async()=>{
  let creates=0;const messages=[];
  await manualHandler({social:{kind:'demo'},submitManualCatalog:async()=>{creates++},setMessage:m=>messages.push(m)})();
  assert.equal(creates,0);assert.deepEqual(messages,['demo']);
});
