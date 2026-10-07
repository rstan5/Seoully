/** No hosted URL/credentials. Creates an isolated disposable Docker PostgreSQL,
 * replays every migration, runs pgTAP, and tests real two-session concurrency.
 * Usage: node scripts/check-catalog-database.cjs /absolute/path/to/docker
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const docker = process.argv[2] || 'docker';
const image = 'public.ecr.aws/supabase/postgres:17.6.1.166';
const container = `seoully-catalog-test-${process.pid}`;
const run = args => execFileSync(docker,args,{encoding:'utf8',maxBuffer:16*1024*1024});
const sql = text => execFileSync(docker,['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','postgres'],{input:text,encoding:'utf8',maxBuffer:16*1024*1024,stdio:['pipe','pipe','pipe']}).trim();
const wait = ms => new Promise(r=>setTimeout(r,ms));
function session(){
  const proc=spawn(docker,['exec','-i',container,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','postgres']);
  let output='',error='';proc.stdout.on('data',x=>output+=x);proc.stderr.on('data',x=>error+=x);
  const done=new Promise((resolve,reject)=>proc.on('exit',code=>code===0?resolve(output.trim()):reject(Error(error))));
  return {proc,done};
}
async function main(){
  try {
    run(['run','-d','--name',container,'--network','none','--user','postgres','--entrypoint','/bin/sh',image,'-c','initdb -D /tmp/catalog-db -A trust >/tmp/init.log && exec postgres -D /tmp/catalog-db']);
    let ready=false;
    for(let i=0;i<60;i++){try{if(sql('select 1')==='1'){ready=true;break}}catch{}await wait(500)}
    assert.ok(ready,'disposable PostgreSQL ready');
    sql(fs.readFileSync('supabase/tests/bootstrap.sql','utf8'));
    const migrations=fs.readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort();
    for(const file of migrations){
      const body=fs.readFileSync(path.join('supabase/migrations',file),'utf8');
      if(file==='20261005000000_catalog_contribution_idempotency.sql'){
        // A historical contribution exists BEFORE the new migration. Roll this
        // fixture trial back, then apply the same migration cleanly below.
        const history=sql(`begin;
          insert into auth.users(id,raw_user_meta_data) values('a8050000-0000-4000-8000-000000000010','{"handle":"historytest","display_name":"History"}');
          set local role authenticated;
          select set_config('request.jwt.claim.sub','a8050000-0000-4000-8000-000000000010',true);
          select public.create_catalog_contribution('{"name":"Historical","groupName":"History","kind":"photocard"}');
          reset role;
          create temporary table original_history as select to_jsonb(c) snapshot from public.catalog_contributions c;
          ${body}
          select (select count(*)=1 from public.catalog_contributions) and
            (select to_jsonb(c)-'submission_key'-'submission_result'=h.snapshot and c.submission_key is null and c.submission_result is null from public.catalog_contributions c cross join original_history h);
          rollback;`);
        assert.equal(history.split('\n').at(-1),'t','historical contribution unchanged by migration');
      }
      sql(`begin;\n${body}\ncommit;`);
    }
    sql('create extension pgtap');
    let tapCount=0;
    for(const file of ['room_persistence.test.sql','catalog_idempotency.test.sql']){
      const result=sql(fs.readFileSync(path.join('supabase/tests',file),'utf8'));
      const lines=result.split('\n');const failures=lines.filter(l=>/^not ok |^# Looks like/.test(l));
      assert.deepEqual(failures,[],`${file} pgTAP failures`);
      const passed=lines.filter(l=>/^ok \d+ /.test(l)).length;
      assert.ok(passed>0);assert.ok(lines.includes(`1..${passed}`),'complete pgTAP plan');
      tapCount+=passed;console.log(`${file}: ${passed} pgTAP assertions passed`);
    }
    assert.equal(sql('select count(*) from public.catalog_contributions'),'0','fixtures rolled back');
    sql(`insert into auth.users(id,raw_user_meta_data) values('a8050000-0000-4000-8000-000000000020','{"handle":"concurrencytest","display_name":"Concurrent"}');`);
    const request=`select public.create_catalog_contribution('{"name":"Concurrent Card","groupName":"Concurrent","kind":"photocard","submissionKey":"b8050000-0000-4000-8000-000000000020"}');`;
    const start=`begin;set local role authenticated;set local request.jwt.claim.sub='a8050000-0000-4000-8000-000000000020';`;
    const first=session();first.proc.stdin.write(start+request+'\n');
    // First transaction holds its advisory lock after RPC completion.
    let held=false;for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_locks where locktype='advisory' and granted"))>0){held=true;break}await wait(50)}
    assert.ok(held,'first request holds transaction lock');
    const second=session();second.proc.stdin.end(start+request+'commit;\n');
    let blocked=false;for(let i=0;i<60;i++){if(Number(sql("select count(*) from pg_locks where locktype='advisory' and not granted"))>0){blocked=true;break}await wait(50)}
    assert.ok(blocked,'second real session blocks atomically on same operation');
    first.proc.stdin.end('commit;\n');
    const [a,b]=await Promise.all([first.done,second.done]);
    assert.deepEqual(JSON.parse(a),JSON.parse(b),'concurrent calls return identical original result');
    assert.equal(sql('select count(*) from public.catalog_contributions'),'1','two concurrent sessions created only one contribution');
    // Discard the first committed response; a new session retry returns it.
    const retry=JSON.parse(sql(start+request+'commit;'));
    assert.deepEqual(retry,JSON.parse(a),'committed-but-lost-response retry resolves original');
    assert.equal(sql('select count(*) from public.catalog_contributions'),'1');
    console.log(`${migrations.length} migrations replayed; ${tapCount} pgTAP assertions passed; historical preservation, real two-session concurrency and lost-response retry PASS.`);
    console.log('Disposable database only; hosted Supabase untouched.');
  } finally {try{run(['rm','-f',container])}catch{}}
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
